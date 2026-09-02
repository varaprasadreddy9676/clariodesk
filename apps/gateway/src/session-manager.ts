import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { pino } from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  downloadMediaMessage,
  getContentType,
  normalizeMessageContent,
  jidNormalizedUser,
  isJidGroup,
  DisconnectReason,
  type WASocket,
  type WAMessage,
  type WAMessageKey,
  type Chat,
  type Contact,
  type ChatModification,
} from "baileys";

export type SessionStatus =
  | "created"
  | "initializing"
  | "qr_required"
  | "authenticating"
  | "ready"
  | "disconnected"
  | "failed";

export type GatewayMessage = {
  id: string;
  chatId: string;
  senderId: string | null;
  body: string | null;
  type: string;
  timestamp: number;
  fromMe: boolean;
  hasMedia: boolean;
  quotedMessageId: string | null;
};

export type GatewayGroup = {
  id: string;
  name: string | null;
  avatarUrl?: string | null;
  participantsCount?: number;
};

export type GatewayChatState = GatewayGroup & {
  channelType: "group" | "direct";
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
};

export type ChatStateAction =
  | { action: "mark_unread"; markedUnread: true }
  | { action: "pin"; pinned: boolean }
  | { action: "mute"; muted: boolean }
  | { action: "archive"; archived: boolean };

// A chat is only surfaced as a "conversation" once we've actually seen a
// message in it — matches the previous whatsapp-web.js behaviour of only
// listing chats WhatsApp itself considers active.
type ChatMeta = {
  id: string;
  isGroup: boolean;
  name: string | null;
  participantsCount?: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  lastMessage?: { key: WAMessageKey; messageTimestamp: number };
};

const MAX_MESSAGES_PER_CHAT = 200;
const HISTORY_SYNC_WAIT_MS = 10_000;
const HISTORY_SYNC_POLL_MS = 300;
const DEFAULT_MUTE_MS = 8 * 60 * 60 * 1000; // 8 hours — WhatsApp's shortest preset
const VERSION_FETCH_TIMEOUT_MS = 5_000;
// A recent, known-good WhatsApp Web protocol version to fall back to if the
// remote version check is unreachable or hangs — baileys' own
// fetchLatestBaileysVersion() has no timeout of its own and can hang the
// whole connect() call indefinitely on a blocked/slow network.
const FALLBACK_WA_VERSION: [number, number, number] = [2, 3000, 1023223821];
const BROWSER_IDENTITY: [string, string, string] = [
  "ClarioDesk",
  "Chrome",
  "120.0.0",
];

// Resolves the WhatsApp Web protocol version to present during the pairing
// handshake. A stale/wrong version here is a known cause of WhatsApp
// rejecting a new device link outright ("Couldn't link device"), so this
// tries the most authoritative sources first:
//   1. WhatsApp's own live service-worker version (fetchLatestWaWebVersion)
//   2. baileys' GitHub-hosted reference version (can lag behind WhatsApp's
//      actual deployed version by hours/days)
//   3. a hardcoded fallback, only if both network calls are unreachable —
//      neither fetch function has a built-in timeout, so each is raced
//      against one here to avoid hanging connect() indefinitely.
async function withVersionTimeout(
  label: string,
  fetcher: () => Promise<{
    version: [number, number, number];
    isLatest: boolean;
  }>,
): Promise<[number, number, number] | null> {
  try {
    const result = await Promise.race([
      fetcher(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), VERSION_FETCH_TIMEOUT_MS),
      ),
    ]);
    if (!result) {
      console.error(
        `gateway: ${label} timed out after ${VERSION_FETCH_TIMEOUT_MS}ms`,
      );
      return null;
    }
    console.log(
      `gateway: ${label} resolved WA web version ${result.version.join(".")} (isLatest=${result.isLatest})`,
    );
    return result.version;
  } catch (err) {
    console.error(`gateway: ${label} failed`, err);
    return null;
  }
}

let cachedVersion: Promise<[number, number, number]> | null = null;
function getWaVersion(): Promise<[number, number, number]> {
  cachedVersion ??= (async () => {
    const fromWaWeb = await withVersionTimeout(
      "fetchLatestWaWebVersion",
      fetchLatestWaWebVersion,
    );
    if (fromWaWeb) return fromWaWeb;
    const fromBaileys = await withVersionTimeout(
      "fetchLatestBaileysVersion",
      fetchLatestBaileysVersion,
    );
    if (fromBaileys) return fromBaileys;
    console.error(
      `gateway: all WA version sources unavailable, using fallback ${FALLBACK_WA_VERSION.join(".")}`,
    );
    return FALLBACK_WA_VERSION;
  })();
  return cachedVersion;
}

export class GatewaySession extends EventEmitter {
  readonly id: string;
  readonly name: string;
  private socket: WASocket | null = null;
  private status: SessionStatus = "created";
  private qr: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private historySynced = false;
  private reconnecting = false;

  private readonly chatMeta = new Map<string, ChatMeta>();
  private readonly messagesByChat = new Map<string, GatewayMessage[]>();
  private readonly rawMessages = new Map<string, WAMessage>();
  private readonly contactNames = new Map<string, string>();

  constructor(input: { id: string; name: string; dataDir: string }) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.dataDir = input.dataDir;
  }

  private readonly dataDir: string;

  snapshot() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      phone: this.phone,
      pushName: this.pushName,
    };
  }

  async start(): Promise<void> {
    if (this.socket) return;
    this.setStatus("initializing");
    try {
      await this.launch();
    } catch (err) {
      // A failed launch must not leave `this.socket` set — that would make
      // every future start() call return early via the guard above,
      // wedging the session until the whole gateway process restarts.
      this.socket = null;
      this.setStatus("failed");
      throw err;
    }
  }

  private async launch(): Promise<void> {
    const authDir = path.resolve(this.dataDir, `session-${this.id}`);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const version = await getWaVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      browser: BROWSER_IDENTITY,
      logger: pino({ level: "silent" }),
      // Baileys defaults shouldSyncHistoryMessage to `() => !!syncFullHistory`
      // — leaving both unset (as an earlier version of this file did) means
      // WhatsApp never sends chats, contacts, or recent messages at all, not
      // just a full archive. Returning true here enables that initial sync;
      // syncFullHistory itself stays false so WhatsApp only sends the recent
      // window rather than the entire message history.
      shouldSyncHistoryMessage: () => true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      // Without this, WhatsApp's message-retry protocol (used whenever a
      // recipient fails to decrypt a message on the first attempt) has
      // nothing to resend, so the recipient's client is stuck indefinitely
      // instead of the retry resolving in seconds.
      getMessage: async (key) => {
        if (!key.id) return undefined;
        return this.rawMessages.get(key.id)?.message ?? undefined;
      },
    });
    this.socket = socket;

    socket.ev.on("creds.update", () => void saveCreds());

    socket.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) {
        void QRCode.toDataURL(qr).then((dataUrl) => {
          this.qr = dataUrl;
          this.setStatus("qr_required");
        });
      }
      if (connection === "connecting" && !this.qr) {
        this.setStatus("authenticating");
      }
      if (connection === "open") {
        this.qr = null;
        this.phone = jidNormalizedUser(socket.user?.id).split("@")[0] ?? null;
        this.pushName = socket.user?.name ?? socket.user?.notify ?? null;
        this.setStatus("ready");
      }
      if (connection === "close") {
        this.socket = null;
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          this.setStatus("disconnected");
          return;
        }
        // Any other close (network blip, server-initiated restart, etc.) is
        // transient — reconnect automatically rather than requiring the app
        // to notice and call connect() again.
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    });

    socket.ev.on("messaging-history.set", ({ chats, contacts, messages }) => {
      for (const contact of contacts) this.upsertContact(contact);
      for (const chat of chats) this.upsertChatMeta(chat);
      for (const message of messages) this.recordMessage(message, false);
      this.historySynced = true;
    });
    socket.ev.on("chats.upsert", (chats) => {
      for (const chat of chats) this.upsertChatMeta(chat);
    });
    socket.ev.on("chats.update", (updates) => {
      for (const update of updates) this.upsertChatMeta(update);
    });
    socket.ev.on("contacts.upsert", (contacts) => {
      for (const contact of contacts) this.upsertContact(contact);
    });
    socket.ev.on("contacts.update", (updates) => {
      for (const update of updates) this.upsertContact(update);
    });
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      for (const message of messages) {
        this.recordMessage(message, type !== "notify");
        if (type === "notify") {
          const normalized = normalizeMessage(message, this.contactNames);
          if (normalized) this.emit("message", normalized);
        }
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(() => {
      this.reconnecting = false;
      if (this.socket || this.status === "disconnected") {
        void this.launch().catch((err: unknown) => {
          console.error(
            `gateway: reconnect failed for session ${this.id}`,
            err,
          );
        });
      }
    }, 3_000);
  }

  getQr(): { qr: string | null; status: SessionStatus } {
    return { qr: this.qr, status: this.status };
  }

  async stop(): Promise<void> {
    if (this.socket) {
      await this.socket.end(undefined);
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  /**
   * Fully unlink the device and clear the saved auth so the next `start()`
   * generates a fresh QR (true re-pair). `stop()` only closes the socket and
   * keeps the auth state, which would silently resume the existing link.
   */
  async logout(): Promise<void> {
    this.qr = null;
    this.phone = null;
    this.pushName = null;
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch {
        // device may already be unlinked; fall through to data removal
      }
      try {
        await this.socket.end(undefined);
      } catch {
        // ignore — we are tearing this session down regardless
      }
      this.socket = null;
    }
    this.chatMeta.clear();
    this.messagesByChat.clear();
    this.rawMessages.clear();
    await this.removeAuthData();
    this.setStatus("disconnected");
  }

  private async removeAuthData(): Promise<void> {
    const dir = path.resolve(this.dataDir, `session-${this.id}`);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  async chats(): Promise<
    Array<GatewayGroup & { channelType: "group" | "direct" }>
  > {
    this.requireClient();
    // The chat list only exists once WhatsApp's history sync has delivered
    // it — give it a short window rather than returning an empty list the
    // instant a phone connects.
    const deadline = Date.now() + HISTORY_SYNC_WAIT_MS;
    while (
      !this.historySynced &&
      this.chatMeta.size === 0 &&
      Date.now() < deadline
    ) {
      await sleep(HISTORY_SYNC_POLL_MS);
    }
    return [...this.chatMeta.values()].map((chat) => ({
      id: chat.id,
      name: chat.name,
      avatarUrl: null,
      participantsCount: chat.participantsCount,
      channelType: chat.isGroup ? ("group" as const) : ("direct" as const),
    }));
  }

  async groups(): Promise<GatewayGroup[]> {
    return (await this.chats())
      .filter((chat) => chat.channelType === "group")
      .map((chat) => ({
        id: chat.id,
        name: chat.name,
        avatarUrl: chat.avatarUrl,
        participantsCount: chat.participantsCount,
      }));
  }

  async chat(chatId: string): Promise<GatewayChatState> {
    const socket = this.requireClient();
    const meta = this.chatMeta.get(chatId);
    const isGroup = isJidGroup(chatId);
    let avatarUrl: string | undefined;
    try {
      avatarUrl = await socket.profilePictureUrl(chatId, "preview");
    } catch {
      // No photo set, or privacy settings withhold it.
    }
    return {
      id: chatId,
      name: meta?.name ?? null,
      avatarUrl: avatarUrl ?? null,
      participantsCount: meta?.participantsCount,
      channelType: isGroup ? "group" : "direct",
      isPinned: Boolean(meta?.pinned),
      isMuted: Boolean(meta?.muted),
      isArchived: Boolean(meta?.archived),
    };
  }

  async setChatState(
    chatId: string,
    action: ChatStateAction,
  ): Promise<GatewayChatState> {
    const socket = this.requireClient();
    const meta = this.chatMeta.get(chatId);
    const lastMessages = meta?.lastMessage ? [meta.lastMessage] : [];
    let mod: ChatModification;
    switch (action.action) {
      case "pin":
        mod = { pin: action.pinned };
        break;
      case "mute":
        mod = { mute: action.muted ? Date.now() + DEFAULT_MUTE_MS : null };
        break;
      case "archive":
        mod = { archive: action.archived, lastMessages };
        break;
      case "mark_unread":
        mod = { markRead: false, lastMessages };
        break;
    }
    await withTimeout(socket.chatModify(mod, chatId), 20_000);
    if (meta) {
      if (action.action === "pin") meta.pinned = action.pinned;
      if (action.action === "mute") meta.muted = action.muted;
      if (action.action === "archive") meta.archived = action.archived;
    }
    return this.chat(chatId);
  }

  async messages(chatId: string, limit: number): Promise<GatewayMessage[]> {
    this.requireClient();
    const messages = this.messagesByChat.get(chatId) ?? [];
    return messages.slice(-limit);
  }

  async sendText(chatId: string, body: string): Promise<{ messageId: string }> {
    const socket = this.requireClient();
    const message = await socket.sendMessage(chatId, { text: body });
    if (!message) throw new Error("WhatsApp did not confirm the send");
    this.recordMessage(message, false);
    return { messageId: message.key.id ?? crypto.randomUUID() };
  }

  async resolveNumber(phoneNumber: string): Promise<{
    registered: boolean;
    providerContactId: string | null;
  }> {
    const normalized = phoneNumber.replace(/\D/g, "");
    if (normalized.length < 7 || normalized.length > 15) {
      throw new Error("Phone number must contain 7 to 15 digits");
    }
    const results = await this.requireClient().onWhatsApp(normalized);
    const match = results?.[0];
    return {
      registered: Boolean(match?.exists),
      providerContactId: match?.exists ? match.jid : null,
    };
  }

  async createGroup(
    title: string,
    participantIds: string[],
  ): Promise<{ providerChatId: string }> {
    if (!participantIds.length) {
      throw new Error("At least one participant is required");
    }
    const result = await this.requireClient().groupCreate(
      title.trim(),
      participantIds,
    );
    if (!result.id)
      throw new Error("WhatsApp did not return the created group id");
    return { providerChatId: result.id };
  }

  async sendMedia(input: {
    chatId: string;
    mediaBase64: string;
    mimeType: string;
    fileName?: string | null;
    caption?: string | null;
  }): Promise<{ messageId: string }> {
    const socket = this.requireClient();
    const buffer = Buffer.from(input.mediaBase64, "base64");
    const kind = mediaKindForMimeType(input.mimeType);
    const message = await socket.sendMessage(input.chatId, {
      [kind]: buffer,
      mimetype: input.mimeType,
      ...(kind === "document" ? { fileName: input.fileName ?? "file" } : {}),
      ...(input.caption ? { caption: input.caption } : {}),
    } as Parameters<WASocket["sendMessage"]>[1]);
    if (!message) throw new Error("WhatsApp did not confirm the send");
    this.recordMessage(message, false);
    return { messageId: message.key.id ?? crypto.randomUUID() };
  }

  async reply(
    chatId: string,
    messageId: string,
    body: string,
  ): Promise<{ messageId: string }> {
    const target = this.rawMessages.get(messageId);
    if (!target) throw new Error(`Message ${messageId} not found in ${chatId}`);
    const socket = this.requireClient();
    const message = await socket.sendMessage(
      chatId,
      { text: body },
      { quoted: target },
    );
    if (!message) throw new Error("WhatsApp did not confirm the send");
    this.recordMessage(message, false);
    return { messageId: message.key.id ?? crypto.randomUUID() };
  }

  async react(messageId: string, reaction: string): Promise<{ ok: true }> {
    const target = this.rawMessages.get(messageId);
    if (!target) throw new Error(`Message ${messageId} not found`);
    const socket = this.requireClient();
    const chatId = target.key.remoteJid;
    if (!chatId) throw new Error(`Message ${messageId} has no chat`);
    await socket.sendMessage(chatId, {
      react: { text: reaction, key: target.key },
    });
    return { ok: true };
  }

  async downloadMedia(
    _chatId: string,
    messageId: string,
  ): Promise<{
    data: string;
    mimeType?: string;
    fileName?: string | null;
  }> {
    const target = this.rawMessages.get(messageId);
    if (!target) throw new Error(`Media message ${messageId} not found`);
    const normalized = normalizeMessageContent(target.message ?? undefined);
    const contentType = getContentType(normalized ?? undefined);
    const content =
      contentType && normalized
        ? (normalized[contentType] as
            | { mimetype?: string; fileName?: string }
            | undefined)
        : undefined;
    const buffer = await downloadMediaMessage(target, "buffer", {});
    return {
      data: buffer.toString("base64"),
      mimeType: content?.mimetype,
      fileName: content?.fileName ?? null,
    };
  }

  private requireClient(): WASocket {
    if (!this.socket || this.status !== "ready") {
      throw new Error(`Session ${this.id} is not ready`);
    }
    return this.socket;
  }

  private upsertChatMeta(chat: Partial<Chat>): void {
    const id = chat.id;
    if (!id || !isTrackableChat(id)) return;
    const existing = this.chatMeta.get(id);
    const isGroup = Boolean(isJidGroup(id));
    this.chatMeta.set(id, {
      id,
      isGroup,
      name:
        chat.name?.trim() ||
        existing?.name ||
        (!isGroup ? (this.contactNames.get(id) ?? null) : null),
      participantsCount: existing?.participantsCount,
      pinned:
        chat.pinned != null
          ? Boolean(chat.pinned)
          : (existing?.pinned ?? false),
      muted:
        chat.muteEndTime != null
          ? Boolean(Number(chat.muteEndTime))
          : (existing?.muted ?? false),
      archived: chat.archived ?? existing?.archived ?? false,
      lastMessage: existing?.lastMessage,
    });
  }

  private upsertContact(contact: Partial<Contact>): void {
    const id = contact.id;
    const name = contact.name?.trim() || contact.notify?.trim();
    if (!id || !name) return;
    this.contactNames.set(id, name);
    const chat = this.chatMeta.get(id);
    if (chat && !chat.name) chat.name = name;
  }

  private recordMessage(message: WAMessage, isHistory: boolean): void {
    const chatId = message.key.remoteJid;
    const id = message.key.id;
    if (!chatId || !id || !isTrackableChat(chatId)) return;
    this.rawMessages.set(id, message);

    if (!this.chatMeta.has(chatId)) {
      this.upsertChatMeta({ id: chatId });
    }
    const meta = this.chatMeta.get(chatId);
    const timestamp = Number(message.messageTimestamp ?? 0);
    if (
      meta &&
      (!meta.lastMessage || timestamp >= meta.lastMessage.messageTimestamp)
    ) {
      meta.lastMessage = { key: message.key, messageTimestamp: timestamp };
    }

    const normalized = normalizeMessage(message, this.contactNames);
    if (!normalized) return;
    const list = this.messagesByChat.get(chatId) ?? [];
    if (!list.some((existing) => existing.id === normalized.id)) {
      if (isHistory) list.unshift(normalized);
      else list.push(normalized);
      if (list.length > MAX_MESSAGES_PER_CHAT)
        list.splice(0, list.length - MAX_MESSAGES_PER_CHAT);
      this.messagesByChat.set(chatId, list);
    }
  }

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.emit("status", this.snapshot());
  }
}

// Only 1:1 chats and groups are conversations our product tracks — status
// broadcasts, newsletters/channels, and other special jids are noise here.
function isTrackableChat(jid: string): boolean {
  return (
    jid.endsWith("@g.us") ||
    jid.endsWith("@s.whatsapp.net") ||
    jid.endsWith("@lid")
  );
}

function mediaKindForMimeType(
  mimeType: string,
): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("WhatsApp did not confirm this change")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, GatewaySession>();

  constructor(private readonly opts: { dataDir: string }) {}

  list() {
    return [...this.sessions.values()].map((session) => session.snapshot());
  }

  getOrCreate(id: string, name = id): GatewaySession {
    let session = this.sessions.get(id);
    if (!session) {
      session = new GatewaySession({ id, name, dataDir: this.opts.dataDir });
      this.sessions.set(id, session);
    }
    return session;
  }

  get(id: string): GatewaySession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session ${id} not found`);
    return session;
  }
}

function normalizeMessage(
  message: WAMessage,
  contactNames: Map<string, string>,
): GatewayMessage | null {
  const chatId = message.key.remoteJid;
  const id = message.key.id;
  if (!chatId || !id) return null;
  // Disappearing/view-once messages, edits, etc. wrap the real content one
  // level deeper (e.g. { ephemeralMessage: { message: {...} } }) —
  // getContentType() alone doesn't unwrap that, so it reads as an unknown
  // message type with no body unless normalized first.
  const normalized = normalizeMessageContent(message.message ?? undefined);
  const contentType = getContentType(normalized ?? undefined);
  const content =
    contentType && normalized ? normalized[contentType] : undefined;
  const { type, body, hasMedia } = describeContent(contentType, content);
  const senderId = message.key.fromMe
    ? null
    : (jidNormalizedUser(message.key.participant ?? chatId) ?? chatId);
  if (senderId) {
    const known = contactNames.get(senderId);
    if (!known && message.pushName)
      contactNames.set(senderId, message.pushName);
  }
  const contextInfo =
    content && typeof content === "object" && "contextInfo" in content
      ? (content.contextInfo as { stanzaId?: string | null } | null | undefined)
      : undefined;
  return {
    id,
    chatId,
    senderId,
    body,
    type,
    timestamp: Number(
      message.messageTimestamp ?? Math.floor(Date.now() / 1000),
    ),
    fromMe: Boolean(message.key.fromMe),
    hasMedia,
    quotedMessageId: contextInfo?.stanzaId ?? null,
  };
}

function describeContent(
  contentType: string | undefined,
  content: unknown,
): { type: string; body: string | null; hasMedia: boolean } {
  const c = content as Record<string, unknown> | undefined;
  switch (contentType) {
    case "conversation":
      return {
        type: "chat",
        body: (content as string) ?? null,
        hasMedia: false,
      };
    case "extendedTextMessage":
      return {
        type: "chat",
        body: (c?.text as string) ?? null,
        hasMedia: false,
      };
    case "imageMessage":
      return {
        type: "image",
        body: (c?.caption as string) ?? null,
        hasMedia: true,
      };
    case "videoMessage":
      return {
        type: "video",
        body: (c?.caption as string) ?? null,
        hasMedia: true,
      };
    case "audioMessage":
      return { type: "audio", body: null, hasMedia: true };
    case "documentMessage":
      return {
        type: "document",
        body: (c?.caption as string) ?? (c?.fileName as string) ?? null,
        hasMedia: true,
      };
    case "stickerMessage":
      return { type: "sticker", body: null, hasMedia: true };
    case "locationMessage":
      return {
        type: "location",
        body: (c?.name as string) ?? null,
        hasMedia: false,
      };
    case "contactMessage":
    case "contactsArrayMessage":
      return { type: "vcard", body: null, hasMedia: false };
    default:
      return { type: "unknown", body: null, hasMedia: false };
  }
}

import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth, MessageMedia } = pkg;

type WWebMessage = {
  id?: {
    _serialized?: string;
    id?: string;
    fromMe?: boolean;
    remote?: string;
    participant?: string;
  };
  from?: string;
  to?: string;
  author?: string;
  body?: string;
  type?: string;
  timestamp?: number;
  fromMe?: boolean;
  hasMedia?: boolean;
  hasQuotedMsg?: boolean;
  getQuotedMessage?: () => Promise<WWebMessage>;
  downloadMedia?: () => Promise<{
    mimetype?: string;
    filename?: string | null;
    data?: string;
  } | null>;
  reply?: (body: string) => Promise<WWebMessage>;
  react?: (reaction: string) => Promise<void>;
};

type WWebChat = {
  id?: { _serialized?: string };
  name?: string;
  isGroup?: boolean;
  pinned?: boolean;
  isMuted?: boolean;
  archived?: boolean;
  participants?: unknown[];
  getContact?: () => Promise<WWebContact>;
  fetchMessages: (opts: { limit: number }) => Promise<WWebMessage[]>;
  pin?: () => Promise<boolean>;
  unpin?: () => Promise<boolean>;
  mute?: () => Promise<unknown>;
  unmute?: () => Promise<unknown>;
  archive?: () => Promise<void>;
  unarchive?: () => Promise<void>;
  markUnread?: () => Promise<void>;
};

type WWebContact = {
  name?: string;
  pushname?: string;
  shortName?: string;
  getFormattedNumber?: () => Promise<string>;
};

type WWebClient = InstanceType<typeof Client> & {
  info?: { wid?: { user?: string }; pushname?: string };
  pupPage?: {
    evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
  };
  getChats: () => Promise<WWebChat[]>;
  getProfilePicUrl: (contactId: string) => Promise<string | undefined>;
  getChatById: (id: string) => Promise<WWebChat>;
  getMessageById: (id: string) => Promise<WWebMessage | null>;
  getNumberId: (
    phoneNumber: string,
  ) => Promise<{ _serialized?: string } | null>;
  createGroup: (
    title: string,
    participantIds: string[],
  ) => Promise<
    string | { gid?: string | { _serialized?: string }; id?: string }
  >;
  sendMessage: (
    chatId: string,
    content: string | unknown,
    options?: Record<string, unknown>,
  ) => Promise<WWebMessage>;
};

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

export class GatewaySession extends EventEmitter {
  readonly id: string;
  readonly name: string;
  private client: WWebClient | null = null;
  private status: SessionStatus = "created";
  private qr: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private readyRecoveryScheduled = false;

  constructor(input: {
    id: string;
    name: string;
    dataDir: string;
    puppeteerArgs: string[];
  }) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.dataDir = input.dataDir;
    this.puppeteerArgs = input.puppeteerArgs;
  }

  private readonly dataDir: string;
  private readonly puppeteerArgs: string[];

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
    if (this.client) return;
    this.setStatus("initializing");
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.id,
        dataPath: path.resolve(this.dataDir),
      }),
      puppeteer: {
        headless: true,
        args: this.puppeteerArgs,
      },
    }) as WWebClient;

    client.on("qr", (qr: string) => {
      void QRCode.toDataURL(qr).then((dataUrl) => {
        this.qr = dataUrl;
        this.setStatus("qr_required");
      });
    });
    client.on("authenticated", () => {
      this.qr = null;
      this.setStatus("authenticating");
      this.scheduleReadyRecovery(client);
    });
    client.on("ready", () => {
      this.phone = client.info?.wid?.user ?? null;
      this.pushName = client.info?.pushname ?? null;
      this.setStatus("ready");
    });
    // `message_create` includes inbound messages and outbound messages sent
    // from the linked phone. Listening only to `message` misses phone replies.
    client.on("message_create", (message: WWebMessage) => {
      this.emit("message", normalizeMessage(message));
    });
    client.on("disconnected", () => {
      this.client = null;
      this.setStatus("disconnected");
    });
    client.on("auth_failure", () => {
      this.setStatus("failed");
    });

    this.client = client;
    await client.initialize();
  }

  getQr(): { qr: string | null; status: SessionStatus } {
    return { qr: this.qr, status: this.status };
  }

  async stop(): Promise<void> {
    if (!this.client) {
      this.setStatus("disconnected");
      return;
    }
    await this.client.destroy();
    this.client = null;
    this.setStatus("disconnected");
  }

  /**
   * Fully unlink the device and clear the saved auth so the next `start()`
   * generates a fresh QR (true re-pair). `stop()` only destroys the client and
   * keeps LocalAuth, which would silently resume the existing link.
   */
  async logout(): Promise<void> {
    this.qr = null;
    this.phone = null;
    this.pushName = null;
    const client = this.client;
    if (client) {
      try {
        await client.logout();
      } catch {
        // device may already be unlinked; fall through to data removal
      }
      try {
        await client.destroy();
      } catch {
        // ignore — we are tearing this session down regardless
      }
      this.client = null;
    }
    await this.removeAuthData();
    this.setStatus("disconnected");
  }

  private async removeAuthData(): Promise<void> {
    // LocalAuth persists under `${dataDir}/session-${clientId}`.
    const dir = path.resolve(this.dataDir, `session-${this.id}`);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  async chats(): Promise<
    Array<GatewayGroup & { channelType: "group" | "direct" }>
  > {
    const client = this.requireClient();
    const chats = (await client.getChats()) as unknown as WWebChat[];
    const supportedChats = chats.filter((chat) => {
      const id = chat.id?._serialized ?? "";
      return (
        id.endsWith("@g.us") || id.endsWith("@c.us") || id.endsWith("@lid")
      );
    });
    return mapWithConcurrency(supportedChats, 12, async (chat) => {
      const id = chat.id?._serialized ?? "";
      const channelType = chat.isGroup
        ? ("group" as const)
        : ("direct" as const);
      let name = chat.name?.trim() || null;
      if (!name && channelType === "direct" && chat.getContact) {
        try {
          const contact = await chat.getContact();
          name =
            contact.name?.trim() ||
            contact.pushname?.trim() ||
            contact.shortName?.trim() ||
            (await contact.getFormattedNumber?.())?.trim() ||
            null;
        } catch {
          // Contact metadata can be unavailable for privacy or deleted users.
        }
      }
      const avatarUrl = id
        ? await client.getProfilePicUrl(id).catch(() => undefined)
        : undefined;
      return {
        id,
        name,
        avatarUrl: avatarUrl ?? null,
        participantsCount: chat.participants?.length,
        channelType,
      };
    }).then((items) => items.filter((chat) => chat.id));
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
    const client = this.requireClient();
    const chat = (await client.getChatById(chatId)) as unknown as WWebChat;
    const id = chat.id?._serialized ?? chatId;
    const channelType = chat.isGroup ? ("group" as const) : ("direct" as const);
    let name = chat.name?.trim() || null;
    if (!name && channelType === "direct" && chat.getContact) {
      try {
        const contact = await chat.getContact();
        name =
          contact.name?.trim() ||
          contact.pushname?.trim() ||
          contact.shortName?.trim() ||
          (await contact.getFormattedNumber?.())?.trim() ||
          null;
      } catch {
        // WhatsApp may withhold contact metadata because of privacy settings.
      }
    }
    const avatarUrl = await client.getProfilePicUrl(id).catch(() => undefined);
    return {
      id,
      name,
      avatarUrl: avatarUrl ?? null,
      participantsCount: chat.participants?.length,
      channelType,
      isPinned: Boolean(chat.pinned),
      isMuted: Boolean(chat.isMuted),
      isArchived: Boolean(chat.archived),
    };
  }

  async setChatState(
    chatId: string,
    action: ChatStateAction,
  ): Promise<GatewayChatState> {
    const chat = (await this.requireClient().getChatById(
      chatId,
    )) as unknown as WWebChat;
    const operation = async () => {
      switch (action.action) {
        case "pin":
          if (Boolean(chat.pinned) === action.pinned) break;
          await requireChatMethod(chat, action.pinned ? "pin" : "unpin")();
          break;
        case "mute":
          if (Boolean(chat.isMuted) === action.muted) break;
          await requireChatMethod(chat, action.muted ? "mute" : "unmute")();
          break;
        case "archive":
          if (Boolean(chat.archived) === action.archived) break;
          await requireChatMethod(
            chat,
            action.archived ? "archive" : "unarchive",
          )();
          break;
        case "mark_unread":
          await requireChatMethod(chat, "markUnread")();
          break;
      }
    };
    await withTimeout(operation(), 20_000);
    return this.chat(chatId);
  }

  async messages(chatId: string, limit: number): Promise<GatewayMessage[]> {
    const chat = (await this.requireClient().getChatById(
      chatId,
    )) as unknown as WWebChat;
    const messages = (await chat.fetchMessages({ limit })) as WWebMessage[];
    return messages.map(normalizeMessage);
  }

  async sendText(chatId: string, body: string): Promise<{ messageId: string }> {
    const message = (await this.requireClient().sendMessage(
      chatId,
      body,
    )) as WWebMessage;
    return { messageId: normalizeMessage(message).id };
  }

  async resolveNumber(phoneNumber: string): Promise<{
    registered: boolean;
    providerContactId: string | null;
  }> {
    const normalized = phoneNumber.replace(/\D/g, "");
    if (normalized.length < 7 || normalized.length > 15) {
      throw new Error("Phone number must contain 7 to 15 digits");
    }
    const result = await this.requireClient().getNumberId(normalized);
    const providerContactId = result?._serialized ?? null;
    return {
      registered: Boolean(providerContactId),
      providerContactId,
    };
  }

  async createGroup(
    title: string,
    participantIds: string[],
  ): Promise<{ providerChatId: string }> {
    if (!participantIds.length) {
      throw new Error("At least one participant is required");
    }
    const result = await this.requireClient().createGroup(
      title.trim(),
      participantIds,
    );
    const groupResult = result as unknown as
      | string
      | { gid?: string | { _serialized?: string }; id?: string };
    const providerChatId =
      typeof groupResult === "string"
        ? groupResult
        : typeof groupResult.gid === "string"
          ? groupResult.gid
          : (groupResult.gid?._serialized ?? groupResult.id);
    if (!providerChatId) {
      throw new Error("WhatsApp did not return the created group id");
    }
    return { providerChatId };
  }

  async sendMedia(input: {
    chatId: string;
    mediaBase64: string;
    mimeType: string;
    fileName?: string | null;
    caption?: string | null;
  }): Promise<{ messageId: string }> {
    const media = new MessageMedia(
      input.mimeType,
      input.mediaBase64,
      input.fileName ?? undefined,
    );
    const message = (await this.requireClient().sendMessage(
      input.chatId,
      media,
      {
        ...(input.caption ? { caption: input.caption } : {}),
      },
    )) as WWebMessage;
    return { messageId: normalizeMessage(message).id };
  }

  async reply(
    chatId: string,
    messageId: string,
    body: string,
  ): Promise<{ messageId: string }> {
    const chat = (await this.requireClient().getChatById(
      chatId,
    )) as unknown as WWebChat;
    const messages = (await chat.fetchMessages({
      limit: 100,
    })) as WWebMessage[];
    const target = messages.find(
      (message) => normalizeMessage(message).id === messageId,
    );
    if (!target?.reply)
      throw new Error(`Message ${messageId} not found in ${chatId}`);
    const reply = (await target.reply(body)) as WWebMessage;
    return { messageId: normalizeMessage(reply).id };
  }

  async react(messageId: string, reaction: string): Promise<{ ok: true }> {
    const message = await this.requireClient().getMessageById(messageId);
    if (!message?.react) throw new Error(`Message ${messageId} not found`);
    await message.react(reaction);
    return { ok: true };
  }

  async downloadMedia(
    chatId: string,
    messageId: string,
  ): Promise<{
    data: string;
    mimeType?: string;
    fileName?: string | null;
  }> {
    const chat = (await this.requireClient().getChatById(
      chatId,
    )) as unknown as WWebChat;
    const messages = (await chat.fetchMessages({
      limit: 100,
    })) as WWebMessage[];
    const target = messages.find(
      (message) => normalizeMessage(message).id === messageId,
    );
    if (!target?.downloadMedia)
      throw new Error(`Media message ${messageId} not found in ${chatId}`);
    const media = await target.downloadMedia();
    if (!media?.data)
      throw new Error(`Media bytes unavailable for ${messageId}`);
    return {
      data: media.data,
      mimeType: media.mimetype,
      fileName: media.filename ?? null,
    };
  }

  private requireClient(): WWebClient {
    if (!this.client || this.status !== "ready") {
      throw new Error(`Session ${this.id} is not ready`);
    }
    return this.client;
  }

  private scheduleReadyRecovery(client: WWebClient): void {
    if (this.readyRecoveryScheduled) return;
    this.readyRecoveryScheduled = true;
    setTimeout(() => {
      void (async () => {
        try {
          if (this.status !== "authenticating" || !client.pupPage) return;
          await client.pupPage.evaluate(async () => {
            const pageWindow = globalThis as unknown as {
              AuthStore?: { AppState?: { hasSynced?: boolean } };
              onAppStateHasSyncedEvent?: () => Promise<void>;
            };
            if (
              pageWindow.AuthStore?.AppState?.hasSynced &&
              pageWindow.onAppStateHasSyncedEvent
            ) {
              await pageWindow.onAppStateHasSyncedEvent();
            }
          });
        } finally {
          this.readyRecoveryScheduled = false;
        }
      })();
    }, 1_000);
  }

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.emit("status", this.snapshot());
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

type ChatOperationName =
  | "pin"
  | "unpin"
  | "mute"
  | "unmute"
  | "archive"
  | "unarchive"
  | "markUnread";

function requireChatMethod(
  chat: WWebChat,
  name: ChatOperationName,
): () => Promise<unknown> {
  const method = chat[name];
  if (typeof method !== "function") {
    throw new Error(`Connected WhatsApp session does not support ${name}`);
  }
  return method.bind(chat) as () => Promise<unknown>;
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

  constructor(
    private readonly opts: { dataDir: string; puppeteerArgs: string[] },
  ) {}

  list() {
    return [...this.sessions.values()].map((session) => session.snapshot());
  }

  getOrCreate(id: string, name = id): GatewaySession {
    let session = this.sessions.get(id);
    if (!session) {
      session = new GatewaySession({
        id,
        name,
        dataDir: this.opts.dataDir,
        puppeteerArgs: this.opts.puppeteerArgs,
      });
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

function normalizeMessage(message: WWebMessage): GatewayMessage {
  const id = message.id?._serialized ?? message.id?.id ?? crypto.randomUUID();
  const chatId = message.fromMe ? message.to : message.from;
  return {
    id,
    chatId: chatId ?? message.id?.remote ?? "",
    senderId: message.author ?? message.from ?? null,
    body: message.body ?? null,
    type: message.type ?? "unknown",
    timestamp: Number(message.timestamp ?? Math.floor(Date.now() / 1000)),
    fromMe: Boolean(message.fromMe ?? message.id?.fromMe),
    hasMedia: Boolean(message.hasMedia),
    quotedMessageId: null,
  };
}

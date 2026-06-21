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
};

type WWebChat = {
  id?: { _serialized?: string };
  name?: string;
  isGroup?: boolean;
  participants?: unknown[];
  fetchMessages: (opts: { limit: number }) => Promise<WWebMessage[]>;
};

type WWebClient = InstanceType<typeof Client> & {
  info?: { wid?: { user?: string }; pushname?: string };
  pupPage?: {
    evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
  };
  getChats: () => Promise<WWebChat[]>;
  getChatById: (id: string) => Promise<WWebChat>;
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
  participantsCount?: number;
};

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
    return chats
      .map((chat) => ({
        id: chat.id?._serialized ?? "",
        name: chat.name ?? null,
        participantsCount: (chat as { participants?: unknown[] }).participants
          ?.length,
        channelType: chat.isGroup ? ("group" as const) : ("direct" as const),
      }))
      .filter((chat) => chat.id);
  }

  async groups(): Promise<GatewayGroup[]> {
    return (await this.chats())
      .filter((chat) => chat.channelType === "group")
      .map((chat) => ({
        id: chat.id,
        name: chat.name,
        participantsCount: chat.participantsCount,
      }));
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

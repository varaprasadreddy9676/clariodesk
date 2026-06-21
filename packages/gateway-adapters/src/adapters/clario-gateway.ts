import type {
  NormalizedGatewayEvent,
  MessageDirection,
  MessageType,
} from "@clariodesk/types";
import type {
  ConnectInput,
  ConnectResult,
  ConnectionInfo,
  ConnectionStatus,
  DownloadMediaInput,
  GatewayCapabilities,
  GatewayChatMessage,
  GatewayChat,
  GatewayMediaResult,
  GatewaySendResult,
  RawGatewayWebhook,
  SendMediaInput,
  SendTextInput,
  WhatsAppGatewayAdapter,
} from "../interface.js";

export type ClarioGatewayConfig = {
  baseUrl: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

type GatewaySession = {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  pushName?: string | null;
};

type GatewayMessagePayload = {
  id?: string;
  chatId?: string;
  senderId?: string | null;
  body?: string | null;
  type?: string;
  timestamp?: number;
  fromMe?: boolean;
  quotedMessageId?: string | null;
  hasMedia?: boolean;
};

const CAPABILITIES: GatewayCapabilities = {
  supportsGroups: true,
  supportsQuotedReply: true,
  supportsReactions: false,
  supportsTypingEvents: false,
  supportsReadReceipts: false,
  supportsParticipantEvents: false,
  supportsHistorySync: true,
  supportsMediaDownload: true,
  supportsMessageDeleteEvents: false,
  supportsOfficialTemplates: false,
};

export class ClarioGatewayAdapter implements WhatsAppGatewayAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: ClarioGatewayConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.apiKey = cfg.apiKey;
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  getAdapterType() {
    return "clario_gateway" as const;
  }

  getCapabilities(): GatewayCapabilities {
    return CAPABILITIES;
  }

  async connect(input: ConnectInput): Promise<ConnectResult> {
    await this.req("POST", "/sessions", {
      id: input.providerInstanceId,
      name: input.providerInstanceId,
    });
    await this.req(
      "POST",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/start`,
      {},
    );
    const qr = await this.waitForQr(input.providerInstanceId);
    return {
      providerInstanceId: input.providerInstanceId,
      ...(qr.qr ? { qr: qr.qr } : {}),
    };
  }

  async disconnect(input: { providerInstanceId: string }): Promise<void> {
    await this.req(
      "POST",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/stop`,
      {},
    );
  }

  async logout(input: { providerInstanceId: string }): Promise<void> {
    await this.req(
      "POST",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/logout`,
      {},
    );
  }

  async getConnectionStatus(input: {
    providerInstanceId: string;
  }): Promise<ConnectionStatus> {
    return (await this.getConnectionInfo(input)).status;
  }

  async getConnectionInfo(input: {
    providerInstanceId: string;
  }): Promise<ConnectionInfo> {
    const session = await this.req<GatewaySession>(
      "GET",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/status`,
    );
    return {
      status: mapStatus(session.status),
      phoneNumber: session.phone ?? null,
      displayName: session.pushName ?? session.name ?? null,
    };
  }

  async fetchChats(input: {
    providerInstanceId: string;
  }): Promise<GatewayChat[]> {
    const chats = await this.req<
      Array<{ id?: string; name?: string | null; participantsCount?: number }>
    >("GET", `/sessions/${encodeURIComponent(input.providerInstanceId)}/chats`);
    return chats
      .filter(
        (
          chat,
        ): chat is {
          id: string;
          name?: string | null;
          participantsCount?: number;
        } => Boolean(chat.id),
      )
      .map((chat) => ({
        providerChatId: chat.id,
        title: chat.name ?? null,
        channelType: chat.id.endsWith("@g.us") ? "group" : "direct",
        participantCount: chat.participantsCount,
      }));
  }

  async fetchGroups(input: {
    providerInstanceId: string;
  }): Promise<GatewayChat[]> {
    const chats = await this.fetchChats(input);
    return chats.filter((chat) => chat.channelType === "group");
  }

  async fetchMessages(input: {
    providerInstanceId: string;
    providerChatId: string;
    limit: number;
  }): Promise<GatewayChatMessage[]> {
    const messages = await this.req<GatewayMessagePayload[]>(
      "GET",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/chats/${encodeURIComponent(input.providerChatId)}/messages?limit=${input.limit}`,
    );
    return messages.map((message) =>
      toGatewayChatMessage(message, input.providerChatId),
    );
  }

  async sendText(input: SendTextInput): Promise<GatewaySendResult> {
    const path = input.quotedProviderMessageId
      ? `/sessions/${encodeURIComponent(input.providerInstanceId)}/messages/reply`
      : `/sessions/${encodeURIComponent(input.providerInstanceId)}/messages/send-text`;
    const body = input.quotedProviderMessageId
      ? {
          chatId: input.providerChatId,
          messageId: input.quotedProviderMessageId,
          text: input.body,
        }
      : { chatId: input.providerChatId, text: input.body };
    const res = await this.req<{ messageId?: string }>("POST", path, body);
    return { providerMessageId: res.messageId ?? crypto.randomUUID() };
  }

  async sendMedia(input: SendMediaInput): Promise<GatewaySendResult> {
    const mediaBase64 =
      input.mediaBase64 ??
      (input.mediaUrl ? await this.fetchMediaAsBase64(input.mediaUrl) : null);
    if (!mediaBase64 || !input.mimeType) {
      throw new Error(
        "mediaBase64/mediaUrl and mimeType are required for Clario Gateway media send",
      );
    }
    const res = await this.req<{ messageId?: string }>(
      "POST",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/messages/send-media`,
      {
        chatId: input.providerChatId,
        mediaBase64,
        mimeType: input.mimeType,
        fileName: input.fileName,
        caption: input.caption,
      },
    );
    return { providerMessageId: res.messageId ?? crypto.randomUUID() };
  }

  async downloadMedia(input: DownloadMediaInput): Promise<GatewayMediaResult> {
    const handle = decodeMediaHandle(input.providerMediaId);
    const media = await this.req<{
      data?: string;
      mimeType?: string;
      fileName?: string | null;
    }>(
      "GET",
      `/sessions/${encodeURIComponent(input.providerInstanceId)}/chats/${encodeURIComponent(handle.chatId)}/messages/${encodeURIComponent(handle.messageId)}/media`,
    );
    if (!media.data)
      throw new Error("Clario Gateway media response did not include data");
    return {
      bytes: Uint8Array.from(Buffer.from(media.data, "base64")),
      mimeType: media.mimeType,
      fileName: media.fileName ?? undefined,
    };
  }

  normalizeWebhook(input: RawGatewayWebhook): NormalizedGatewayEvent[] {
    const payload = input.payload;
    if (!payload || typeof payload !== "object") return [];
    const event = payload as { event?: unknown; message?: unknown };
    if (event.event !== "message.received") return [];
    const message = event.message as GatewayMessagePayload | undefined;
    if (!message) return [];
    return [
      toNormalizedEvent(
        toGatewayChatMessage(message, message.chatId ?? ""),
        false,
      ),
    ];
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { "x-api-key": this.apiKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Clario Gateway ${method} ${path} failed: ${res.status} ${text}`.trim(),
      );
    }
    return (await res.json().catch(() => ({}))) as T;
  }

  private async waitForQr(
    providerInstanceId: string,
  ): Promise<{ qr?: string | null }> {
    const path = `/sessions/${encodeURIComponent(providerInstanceId)}/qr`;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const qr = await this.req<{ qr?: string | null }>("GET", path);
      if (qr.qr) return qr;
      await sleep(500);
    }
    return {};
  }

  private async fetchMediaAsBase64(mediaUrl: string): Promise<string> {
    const res = await this.fetchFn(mediaUrl, { method: "GET" });
    if (!res.ok)
      throw new Error(`Failed to fetch mediaUrl for send: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.toString("base64");
  }
}

export function clarioMessageToNormalizedEvent(
  message: GatewayChatMessage,
  isHistorySync: boolean,
): NormalizedGatewayEvent {
  return toNormalizedEvent(message, isHistorySync);
}

function toGatewayChatMessage(
  message: GatewayMessagePayload,
  fallbackChatId: string,
): GatewayChatMessage {
  const providerChatId = message.chatId ?? fallbackChatId;
  const messageType = mapMessageType(message.type);
  const providerMessageId = message.id ?? crypto.randomUUID();
  return {
    providerMessageId,
    providerChatId,
    providerSenderId: message.senderId ?? null,
    body: message.body ?? null,
    messageType,
    direction: message.fromMe ? "outbound" : "inbound",
    providerTimestampMs:
      Number(message.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
    quotedProviderMessageId: message.quotedMessageId ?? null,
    hasMedia: Boolean(message.hasMedia),
    ...(message.hasMedia
      ? {
          media: [
            {
              mediaType: messageType as MessageType,
              providerMediaId: encodeMediaHandle(
                providerChatId,
                providerMessageId,
              ),
            },
          ],
        }
      : {}),
  };
}

function toNormalizedEvent(
  message: GatewayChatMessage,
  isHistorySync: boolean,
): NormalizedGatewayEvent {
  return {
    adapterType: "clario_gateway",
    providerMessageId: message.providerMessageId,
    providerChatId: message.providerChatId,
    providerSenderId: message.providerSenderId ?? undefined,
    channelType: message.providerChatId.endsWith("@g.us") ? "group" : "direct",
    messageType: message.messageType as MessageType,
    direction: message.direction as MessageDirection,
    body: message.body ?? undefined,
    ...(message.hasMedia
      ? {
          media: [
            {
              mediaType: message.messageType as MessageType,
              providerMediaId: encodeMediaHandle(
                message.providerChatId,
                message.providerMessageId,
              ),
            },
          ],
        }
      : {}),
    quotedProviderMessageId: message.quotedProviderMessageId ?? undefined,
    providerTimestampMs: message.providerTimestampMs,
    isHistorySync,
    raw: message,
  };
}

function encodeMediaHandle(chatId: string, messageId: string): string {
  return Buffer.from(JSON.stringify({ chatId, messageId }), "utf8").toString(
    "base64url",
  );
}

function decodeMediaHandle(providerMediaId: string): {
  chatId: string;
  messageId: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(providerMediaId, "base64url").toString("utf8"),
    ) as {
      chatId?: unknown;
      messageId?: unknown;
    };
    if (
      typeof parsed.chatId === "string" &&
      typeof parsed.messageId === "string"
    ) {
      return { chatId: parsed.chatId, messageId: parsed.messageId };
    }
  } catch {
    // Fall through to the explicit error below.
  }
  throw new Error("Invalid Clario Gateway media handle");
}

function mapStatus(status: string): ConnectionStatus {
  switch (status) {
    case "ready":
      return "connected";
    case "initializing":
    case "authenticating":
      return "syncing";
    case "created":
    case "qr_required":
      return "qr_required";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "degraded";
    default:
      return "degraded";
  }
}

function mapMessageType(value: string | undefined): string {
  switch (value) {
    case "chat":
      return "text";
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
    case "location":
      return value;
    case "vcard":
      return "contact_card";
    default:
      return "unknown";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import type {
  ChannelType,
  MessageType,
  NormalizedGatewayEvent,
  NormalizedMediaRef,
} from "@clariodesk/types";
import type {
  ConnectInput,
  ConnectResult,
  ConnectionStatus,
  DownloadMediaInput,
  GatewayCapabilities,
  GatewayChat,
  GatewayMediaResult,
  GatewaySendResult,
  RawGatewayWebhook,
  SendMediaInput,
  SendTextInput,
  WhatsAppGatewayAdapter,
} from "../interface.js";

export type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
};

const CAPABILITIES: GatewayCapabilities = {
  supportsGroups: true,
  supportsQuotedReply: true,
  supportsReactions: true,
  supportsTypingEvents: true,
  supportsReadReceipts: true,
  supportsParticipantEvents: true,
  supportsHistorySync: true,
  supportsMediaDownload: true,
  supportsMessageDeleteEvents: true,
  supportsOfficialTemplates: false,
};

/** History/backlog event names — their messages must be flagged backfill. */
const HISTORY_EVENTS = new Set([
  "messaging-history.set",
  "messages.set",
  "history.sync",
]);

/**
 * Evolution API (Baileys-based) adapter — first production linked-device
 * gateway (TDD §7.3). HTTP methods talk to the Evolution REST API;
 * {@link EvolutionAdapter.normalizeWebhook} is pure and total.
 */
export class EvolutionAdapter implements WhatsAppGatewayAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: EvolutionConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.apiKey = cfg.apiKey;
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  getAdapterType() {
    return "evolution" as const;
  }

  getCapabilities(): GatewayCapabilities {
    return CAPABILITIES;
  }

  async connect(input: ConnectInput): Promise<ConnectResult> {
    const create = await this.req<{
      qrcode?: { base64?: string; code?: string };
      code?: string;
      pairingCode?: string;
    }>(
      "POST",
      "/instance/create",
      {
        instanceName: input.providerInstanceId,
        integration: "WHATSAPP-BAILEYS",
        pairingCode: false,
        qrcode: true,
      },
      { ignoreStatuses: [400, 403, 409] },
    );
    const createQr = extractQr(create);
    if (createQr) {
      return {
        providerInstanceId: input.providerInstanceId,
        qr: createQr,
      };
    }

    const res = await this.req<{
      qrcode?: { base64?: string; code?: string };
      base64?: string;
      code?: string;
      pairingCode?: string;
    }>("GET", `/instance/connect/${input.providerInstanceId}`);
    return {
      providerInstanceId: input.providerInstanceId,
      ...(extractQr(res) ? { qr: extractQr(res) } : {}),
    };
  }

  async disconnect(input: { providerInstanceId: string }): Promise<void> {
    await this.req("DELETE", `/instance/logout/${input.providerInstanceId}`);
  }

  async getConnectionStatus(input: {
    providerInstanceId: string;
  }): Promise<ConnectionStatus> {
    const res = await this.req<{ instance?: { state?: string } }>(
      "GET",
      `/instance/connectionState/${input.providerInstanceId}`,
    );
    return mapConnectionState(res.instance?.state);
  }

  async fetchGroups(input: {
    providerInstanceId: string;
  }): Promise<GatewayChat[]> {
    const res = await this.req<
      Array<{ id?: string; subject?: string; size?: number }>
    >(
      "GET",
      `/group/fetchAllGroups/${input.providerInstanceId}?getParticipants=false`,
    );
    const groups = Array.isArray(res) ? res : [];
    return groups
      .filter((g): g is { id: string; subject?: string; size?: number } =>
        Boolean(g?.id),
      )
      .map((g) => ({
        providerChatId: g.id,
        title: g.subject ?? null,
        channelType: "group" as const,
        ...(typeof g.size === "number" ? { participantCount: g.size } : {}),
      }));
  }

  async sendText(input: SendTextInput): Promise<GatewaySendResult> {
    const res = await this.req<{ key?: { id?: string } }>(
      "POST",
      `/message/sendText/${input.providerInstanceId}`,
      {
        number: input.providerChatId,
        text: input.body,
        ...(input.quotedProviderMessageId
          ? { quoted: { key: { id: input.quotedProviderMessageId } } }
          : {}),
      },
    );
    return { providerMessageId: requireId(res.key?.id) };
  }

  async sendMedia(input: SendMediaInput): Promise<GatewaySendResult> {
    const res = await this.req<{ key?: { id?: string } }>(
      "POST",
      `/message/sendMedia/${input.providerInstanceId}`,
      {
        number: input.providerChatId,
        ...(input.mediaUrl ? { media: input.mediaUrl } : {}),
        ...(input.mediaBase64 ? { media: input.mediaBase64 } : {}),
        ...(input.fileName ? { fileName: input.fileName } : {}),
        ...(input.mimeType ? { mimetype: input.mimeType } : {}),
        ...(input.caption ? { caption: input.caption } : {}),
      },
    );
    return { providerMessageId: requireId(res.key?.id) };
  }

  async downloadMedia(input: DownloadMediaInput): Promise<GatewayMediaResult> {
    const res = await this.req<{ base64?: string; mimetype?: string }>(
      "POST",
      `/chat/getBase64FromMediaMessage/${input.providerInstanceId}`,
      { message: { key: { id: input.providerMediaId } } },
    );
    if (!res.base64) throw new Error("Evolution returned no media bytes");
    return {
      bytes: Uint8Array.from(Buffer.from(res.base64, "base64")),
      ...(res.mimetype ? { mimeType: res.mimetype } : {}),
    };
  }

  normalizeWebhook(input: RawGatewayWebhook): NormalizedGatewayEvent[] {
    return normalizeEvolutionWebhook(input.payload);
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { ignoreStatuses?: number[] } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { apikey: this.apiKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok && !options.ignoreStatuses?.includes(res.status)) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Evolution ${method} ${path} failed: ${res.status} ${text}`.trim(),
      );
    }
    return (await res.json().catch(() => ({}))) as T;
  }
}

function extractQr(input: {
  qrcode?: { base64?: string; code?: string };
  base64?: string;
  code?: string;
}): string | undefined {
  return (
    input.qrcode?.base64 ?? input.qrcode?.code ?? input.base64 ?? input.code
  );
}

function mapConnectionState(state: string | undefined): ConnectionStatus {
  switch (state) {
    case "open":
      return "connected";
    case "connecting":
      return "syncing";
    case "close":
      return "disconnected";
    default:
      return "qr_required";
  }
}

function requireId(id: string | undefined): string {
  if (!id) throw new Error("Evolution send returned no message id");
  return id;
}

// ── Pure normalization (exported for unit tests) ──────────────────────────

type EvolutionWebhook = {
  event?: string;
  instance?: string;
  timestamp?: number | string;
  date_time?: string;
  data?: unknown;
};

/**
 * Total, side-effect-free transform. Any shape it doesn't understand yields
 * `[]` rather than throwing, so one malformed webhook can't break ingestion
 * (interface contract).
 */
export function normalizeEvolutionWebhook(
  payload: unknown,
): NormalizedGatewayEvent[] {
  const hook = payload as EvolutionWebhook;
  if (!hook || typeof hook !== "object") return [];
  const event = hook.event ?? "";
  const metadata = normalizeGroupMetadataHook(hook);
  if (metadata.length) return metadata;

  const isHistory = HISTORY_EVENTS.has(event);

  // Evolution may send a single data object or an array (history batches).
  const items = Array.isArray(hook.data) ? hook.data : [hook.data];
  const out: NormalizedGatewayEvent[] = [];
  for (const item of items) {
    const normalized = normalizeMessageItem(item, isHistory);
    if (normalized) out.push(normalized);
  }
  return out;
}

type EvoGroupMetadataItem = {
  id?: string;
  jid?: string;
  remoteJid?: string;
  groupJid?: string;
  subject?: string;
  oldSubject?: string;
  desc?: string;
  description?: string;
  oldDesc?: string;
  participants?: string[];
  participant?: string;
  action?: string;
  timestamp?: number | string;
  messageTimestamp?: number | string;
  subjectTime?: number | string;
};

const GROUP_METADATA_EVENTS = new Set([
  "group.update",
  "groups.update",
  "groups.upsert",
]);
const GROUP_PARTICIPANT_EVENTS = new Set(["group.participants.update"]);

function normalizeGroupMetadataHook(
  hook: EvolutionWebhook,
): NormalizedGatewayEvent[] {
  const eventKey = normalizeEventKey(hook.event ?? "");
  const isGroupMetadata =
    GROUP_METADATA_EVENTS.has(eventKey) ||
    GROUP_PARTICIPANT_EVENTS.has(eventKey);
  if (!isGroupMetadata) return [];

  const items = Array.isArray(hook.data) ? hook.data : [hook.data];
  const out: NormalizedGatewayEvent[] = [];
  for (const raw of items) {
    const item = raw as EvoGroupMetadataItem | undefined;
    if (!item || typeof item !== "object") continue;

    const providerChatId =
      item.id ?? item.jid ?? item.remoteJid ?? item.groupJid;
    if (!providerChatId) continue;

    const providerTimestampMs = toGroupMetadataMillis(item, hook);
    const participants =
      item.participants ?? (item.participant ? [item.participant] : undefined);
    const action = item.action?.toLowerCase();
    const subject = cleanText(item.subject);
    const description = cleanText(item.desc ?? item.description);

    let eventType: NonNullable<
      NormalizedGatewayEvent["groupMetadata"]
    >["eventType"] = "other";
    let oldValue: string | undefined;
    let newValue: string | undefined;

    if (GROUP_PARTICIPANT_EVENTS.has(eventKey)) {
      eventType =
        action === "add"
          ? "participant_added"
          : action === "remove"
            ? "participant_removed"
            : "other";
      newValue = participants?.join(",");
    } else if (subject) {
      eventType = "subject_changed";
      oldValue = cleanText(item.oldSubject);
      newValue = subject;
    } else if (description) {
      eventType = "description_changed";
      oldValue = cleanText(item.oldDesc);
      newValue = description;
    }

    out.push({
      adapterType: "evolution",
      providerMessageId: metadataProviderId({
        eventKey,
        providerChatId,
        providerTimestampMs,
        eventType,
        value: newValue ?? oldValue ?? action ?? "",
      }),
      providerChatId,
      channelType: "group",
      messageType: "system",
      direction: "inbound",
      providerTimestampMs,
      isHistorySync: false,
      systemEventType: eventKey,
      groupMetadata: {
        eventType,
        ...(oldValue ? { oldValue } : {}),
        ...(newValue ? { newValue } : {}),
      },
    });
  }
  return out;
}

function normalizeEventKey(event: string): string {
  return event.toLowerCase().replace(/[_-]/g, ".");
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function toGroupMetadataMillis(
  item: EvoGroupMetadataItem,
  hook: EvolutionWebhook,
): number {
  if (item.subjectTime !== undefined) return toMillis(item.subjectTime);
  if (item.timestamp !== undefined) return toMillis(item.timestamp);
  if (item.messageTimestamp !== undefined)
    return toMillis(item.messageTimestamp);
  if (hook.timestamp !== undefined) return toMillis(hook.timestamp);
  if (hook.date_time) {
    const parsed = Date.parse(hook.date_time);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function metadataProviderId(input: {
  eventKey: string;
  providerChatId: string;
  providerTimestampMs: number;
  eventType: string;
  value: string;
}): string {
  const value = encodeURIComponent(input.value).slice(0, 80);
  return [
    "meta",
    input.eventKey,
    input.providerChatId,
    input.providerTimestampMs,
    input.eventType,
    value,
  ].join(":");
}

type EvoMessageItem = {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
    participant?: string;
  };
  pushName?: string;
  messageTimestamp?: number | string;
  message?: Record<string, unknown>;
};

function normalizeMessageItem(
  raw: unknown,
  isHistory: boolean,
): NormalizedGatewayEvent | undefined {
  const item = raw as EvoMessageItem;
  const id = item?.key?.id;
  const remoteJid = item?.key?.remoteJid;
  if (!id || !remoteJid || !item.message) return undefined;

  const channelType: ChannelType = remoteJid.endsWith("@g.us")
    ? "group"
    : "direct";

  // "Delete for everyone" arrives as a protocolMessage REVOKE targeting an
  // earlier message id (TDD §18).
  const revokeTarget = extractRevokeTarget(item.message);
  if (revokeTarget) {
    return {
      adapterType: "evolution",
      providerMessageId: id,
      providerChatId: remoteJid,
      channelType,
      messageType: "deleted",
      direction: item.key?.fromMe ? "outbound" : "inbound",
      providerTimestampMs: toMillis(item.messageTimestamp),
      isHistorySync: isHistory,
      revokeTargetProviderMessageId: revokeTarget,
    };
  }

  const { messageType, body, media } = extractContent(item.message);

  const event: NormalizedGatewayEvent = {
    adapterType: "evolution",
    providerMessageId: id,
    providerChatId: remoteJid,
    channelType,
    messageType,
    direction: item.key?.fromMe ? "outbound" : "inbound",
    providerTimestampMs: toMillis(item.messageTimestamp),
    isHistorySync: isHistory,
  };
  // In a group the real sender is `participant`; in 1:1 it's the chat itself.
  const sender = channelType === "group" ? item.key?.participant : remoteJid;
  if (sender) event.providerSenderId = sender;
  if (item.pushName) event.senderDisplayName = item.pushName;
  if (body) event.body = body;
  if (media.length) {
    // Evolution downloads media by the message key id, so stamp it here where
    // the id is in scope (extractContent only sees the message stanza).
    event.media = media.map((m) => ({ ...m, providerMediaId: id }));
  }
  const quoted = extractQuotedId(item.message);
  if (quoted) event.quotedProviderMessageId = quoted;
  return event;
}

function toMillis(ts: number | string | undefined): number {
  if (ts === undefined) return Date.now();
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(n)) return Date.now();
  // WhatsApp timestamps are seconds; convert to millis.
  return n < 1e12 ? n * 1000 : n;
}

function extractContent(message: Record<string, unknown>): {
  messageType: MessageType;
  body?: string;
  media: NormalizedMediaRef[];
} {
  if (typeof message.conversation === "string") {
    return { messageType: "text", body: message.conversation, media: [] };
  }
  const ext = message.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text !== undefined) {
    return { messageType: "text", body: ext.text, media: [] };
  }
  if (message.reactionMessage) {
    const r = message.reactionMessage as { text?: string };
    return { messageType: "reaction", body: r.text ?? "", media: [] };
  }

  const mediaSpecs: Array<[string, MessageType]> = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"],
    ["stickerMessage", "sticker"],
  ];
  for (const [key, type] of mediaSpecs) {
    const m = message[key] as
      | {
          caption?: string;
          mimetype?: string;
          fileName?: string;
          fileLength?: number;
          mediaKey?: string;
        }
      | undefined;
    if (m) {
      const ref: NormalizedMediaRef = {
        mediaType: type,
        providerMediaId: "", // filled by caller via message id; see normalizeMessageItem
      };
      if (m.mimetype) ref.mimeType = m.mimetype;
      if (m.fileName) ref.fileName = m.fileName;
      if (typeof m.fileLength === "number") ref.sizeBytes = m.fileLength;
      if (m.mediaKey) ref.providerMediaKey = m.mediaKey;
      return {
        messageType: type,
        ...(m.caption ? { body: m.caption } : {}),
        media: [ref],
      };
    }
  }

  if (message.locationMessage) return { messageType: "location", media: [] };
  if (message.contactMessage) return { messageType: "contact_card", media: [] };
  return { messageType: "unknown", media: [] };
}

function extractQuotedId(message: Record<string, unknown>): string | undefined {
  const ext = message.extendedTextMessage as
    | { contextInfo?: { stanzaId?: string } }
    | undefined;
  return ext?.contextInfo?.stanzaId;
}

/** Returns the target message id if this stanza is a REVOKE (delete-for-everyone). */
function extractRevokeTarget(
  message: Record<string, unknown>,
): string | undefined {
  const proto = message.protocolMessage as
    | { type?: string | number; key?: { id?: string } }
    | undefined;
  if (!proto) return undefined;
  // Baileys sends type "REVOKE" (or enum 0) for delete-for-everyone.
  const isRevoke = proto.type === "REVOKE" || proto.type === 0;
  return isRevoke ? proto.key?.id : undefined;
}

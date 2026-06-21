import type { NormalizedGatewayEvent } from "@clariodesk/types";
import type {
  ConnectInput,
  ConnectResult,
  ConnectionInfo,
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

export type OpenWaConfig = {
  baseUrl: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

type OpenWaSession = {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  pushName?: string | null;
};

const CAPABILITIES: GatewayCapabilities = {
  supportsGroups: true,
  supportsQuotedReply: true,
  supportsReactions: true,
  supportsTypingEvents: false,
  supportsReadReceipts: false,
  supportsParticipantEvents: true,
  supportsHistorySync: true,
  supportsMediaDownload: true,
  supportsMessageDeleteEvents: true,
  supportsOfficialTemplates: false,
  supportsChatPin: false,
  supportsChatMute: false,
  supportsChatArchive: false,
  supportsMarkUnread: false,
};

export class OpenWaAdapter implements WhatsAppGatewayAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: OpenWaConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.apiKey = cfg.apiKey;
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  getAdapterType() {
    return "openwa" as const;
  }

  getCapabilities(): GatewayCapabilities {
    return CAPABILITIES;
  }

  async connect(input: ConnectInput): Promise<ConnectResult> {
    const session = await this.findOrCreateSession(input.providerInstanceId);
    const qr = await this.req<{ qrCode?: string }>(
      "GET",
      `/api/sessions/${session.id}/qr`,
      undefined,
      { ignoreStatuses: [400] },
    );
    return {
      providerInstanceId: session.id,
      ...(qr.qrCode ? { qr: qr.qrCode } : {}),
    };
  }

  async disconnect(input: { providerInstanceId: string }): Promise<void> {
    const session = await this.resolveSession(input.providerInstanceId);
    await this.req("POST", `/api/sessions/${session.id}/stop`, undefined, {
      ignoreStatuses: [404],
    });
  }

  async getConnectionStatus(input: {
    providerInstanceId: string;
  }): Promise<ConnectionStatus> {
    return (await this.getConnectionInfo(input)).status;
  }

  async getConnectionInfo(input: {
    providerInstanceId: string;
  }): Promise<ConnectionInfo> {
    const session = await this.resolveSession(input.providerInstanceId).catch(
      () => null,
    );
    if (!session) return { status: "qr_required" };
    return {
      status: mapStatus(session.status),
      phoneNumber: normalizePhoneNumber(session.phone),
      displayName: session.pushName ?? session.name ?? null,
    };
  }

  async fetchGroups(input: {
    providerInstanceId: string;
  }): Promise<GatewayChat[]> {
    const session = await this.resolveSession(input.providerInstanceId);
    const groups = await this.req<Array<{ id?: string; name?: string }>>(
      "GET",
      `/api/sessions/${session.id}/groups`,
    );
    return groups
      .filter((group): group is { id: string; name?: string } =>
        Boolean(group.id),
      )
      .map((group) => ({
        providerChatId: group.id,
        title: group.name ?? null,
        channelType: "group" as const,
      }));
  }

  async sendText(input: SendTextInput): Promise<GatewaySendResult> {
    const session = await this.resolveSession(input.providerInstanceId);
    const path = input.quotedProviderMessageId
      ? `/api/sessions/${session.id}/messages/reply`
      : `/api/sessions/${session.id}/messages/send-text`;
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

  async sendMedia(_input: SendMediaInput): Promise<GatewaySendResult> {
    throw new Error("OpenWA media send is not implemented in Core v1 adapter");
  }

  async downloadMedia(_input: DownloadMediaInput): Promise<GatewayMediaResult> {
    throw new Error(
      "OpenWA media download is not implemented in Core v1 adapter",
    );
  }

  normalizeWebhook(_input: RawGatewayWebhook): NormalizedGatewayEvent[] {
    return [];
  }

  private async findOrCreateSession(
    providerInstanceId: string,
  ): Promise<OpenWaSession> {
    const existing = await this.resolveSession(providerInstanceId).catch(
      () => null,
    );
    if (existing) return existing;
    return this.req<OpenWaSession>("POST", "/api/sessions", {
      name: providerInstanceId,
      config: { autoReconnect: true },
    });
  }

  private async resolveSession(
    providerInstanceId: string,
  ): Promise<OpenWaSession> {
    const sessions = await this.req<OpenWaSession[]>("GET", "/api/sessions");
    const session = sessions.find(
      (item) =>
        item.id === providerInstanceId || item.name === providerInstanceId,
    );
    if (!session)
      throw new Error(`OpenWA session '${providerInstanceId}' not found`);
    return session;
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { ignoreStatuses?: number[] } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { "x-api-key": this.apiKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok && !options.ignoreStatuses?.includes(res.status)) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `OpenWA ${method} ${path} failed: ${res.status} ${text}`.trim(),
      );
    }
    return (await res.json().catch(() => ({}))) as T;
  }
}

function mapStatus(status: string): ConnectionStatus {
  switch (status) {
    case "ready":
      return "connected";
    case "initializing":
    case "authenticating":
      return "syncing";
    case "created":
    case "qr_ready":
      return "qr_required";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "degraded";
    default:
      return "degraded";
  }
}

function normalizePhoneNumber(phone: string | null | undefined): string | null {
  const normalized = phone?.replace(/[^\d+]/g, "").trim();
  return normalized || null;
}

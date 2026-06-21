import type {
  GatewayAdapterType,
  NormalizedGatewayEvent,
} from "@clariodesk/types";

/**
 * Capability matrix (TDD §7.2). Gateways differ wildly; the UI and policy engine
 * MUST read these before enabling a feature rather than assuming support.
 */
export type GatewayCapabilities = {
  supportsGroups: boolean;
  supportsQuotedReply: boolean;
  supportsReactions: boolean;
  supportsTypingEvents: boolean;
  supportsReadReceipts: boolean;
  supportsParticipantEvents: boolean;
  supportsHistorySync: boolean;
  supportsMediaDownload: boolean;
  supportsMessageDeleteEvents: boolean;
  supportsOfficialTemplates: boolean;
  supportsChatPin?: boolean;
  supportsChatMute?: boolean;
  supportsChatArchive?: boolean;
  supportsMarkUnread?: boolean;
};

export type ConnectInput = { providerInstanceId: string };
export type ConnectResult = { providerInstanceId: string; qr?: string };
export type ConnectionStatus =
  | "connected"
  | "syncing"
  | "disconnected"
  | "qr_required"
  | "degraded"
  | "restricted";

export type ConnectionInfo = {
  status: ConnectionStatus;
  phoneNumber?: string | null;
  displayName?: string | null;
};

export type SendTextInput = {
  providerInstanceId: string;
  providerChatId: string;
  body: string;
  quotedProviderMessageId?: string;
};

export type SendMediaInput = {
  providerInstanceId: string;
  providerChatId: string;
  mediaUrl?: string;
  mediaBase64?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  quotedProviderMessageId?: string;
};

export type GatewaySendResult = {
  /** Provider message id — stored on the outbox row to reconcile the echo. */
  providerMessageId: string;
};

export type ResolveNumberInput = {
  providerInstanceId: string;
  phoneNumber: string;
};

export type ResolveNumberResult = {
  registered: boolean;
  providerContactId: string | null;
};

export type CreateGroupInput = {
  providerInstanceId: string;
  title: string;
  participantIds: string[];
};

export type CreateGroupResult = {
  providerChatId: string;
};

export type ReactToMessageInput = {
  providerInstanceId: string;
  providerChatId: string;
  providerMessageId: string;
  reaction: string;
};

export type DownloadMediaInput = {
  providerInstanceId: string;
  providerMediaId: string;
  providerMediaKey?: string;
};

export type GatewayMediaResult = {
  bytes: Uint8Array;
  mimeType?: string;
  fileName?: string;
};

/** Raw webhook as received on the API endpoint, before any normalization. */
export type RawGatewayWebhook = {
  providerInstanceId: string;
  payload: unknown;
};

/**
 * Common internal interface every gateway must implement (TDD §7.1).
 * The core platform depends only on this — never on a specific gateway —
 * so transport stays replaceable while operations logic stays stable.
 */
/** A chat/thread as reported by the gateway during sync (TDD §8.1.3). */
export type GatewayChat = {
  providerChatId: string;
  title: string | null;
  avatarUrl?: string | null;
  channelType: "group" | "direct" | "official_direct";
  participantCount?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
};

export type SetChatStateInput = {
  providerInstanceId: string;
  providerChatId: string;
} & (
  | { action: "mark_unread"; markedUnread: true }
  | { action: "pin"; pinned: boolean }
  | { action: "mute"; muted: boolean }
  | { action: "archive"; archived: boolean }
);

export type GatewayChatMessage = {
  providerMessageId: string;
  providerChatId: string;
  providerSenderId: string | null;
  body: string | null;
  messageType: string;
  direction: "inbound" | "outbound";
  providerTimestampMs: number;
  quotedProviderMessageId?: string | null;
  hasMedia?: boolean;
  media?: NonNullable<NormalizedGatewayEvent["media"]>;
};

export interface WhatsAppGatewayAdapter {
  getAdapterType(): GatewayAdapterType;
  getCapabilities(): GatewayCapabilities;

  connect(input: ConnectInput): Promise<ConnectResult>;
  disconnect(input: { providerInstanceId: string }): Promise<void>;
  /**
   * Fully unlink the device and clear saved auth so a subsequent `connect`
   * yields a fresh QR (true re-pair). Optional — not all gateways support it.
   */
  logout?(input: { providerInstanceId: string }): Promise<void>;
  getConnectionStatus(input: {
    providerInstanceId: string;
  }): Promise<ConnectionStatus>;
  getConnectionInfo?(input: {
    providerInstanceId: string;
  }): Promise<ConnectionInfo>;

  /** List chats the connected number belongs to (sync, not webhook). */
  fetchChats?(input: { providerInstanceId: string }): Promise<GatewayChat[]>;
  fetchChat?(input: {
    providerInstanceId: string;
    providerChatId: string;
  }): Promise<GatewayChat>;
  setChatState?(input: SetChatStateInput): Promise<GatewayChat>;
  /** Backward-compatible group-only discovery for gateways that cannot list all chats. */
  fetchGroups?(input: { providerInstanceId: string }): Promise<GatewayChat[]>;
  fetchMessages?(input: {
    providerInstanceId: string;
    providerChatId: string;
    limit: number;
  }): Promise<GatewayChatMessage[]>;

  resolveNumber?(input: ResolveNumberInput): Promise<ResolveNumberResult>;
  createGroup?(input: CreateGroupInput): Promise<CreateGroupResult>;

  sendText(input: SendTextInput): Promise<GatewaySendResult>;
  sendMedia(input: SendMediaInput): Promise<GatewaySendResult>;
  downloadMedia(input: DownloadMediaInput): Promise<GatewayMediaResult>;
  reactToMessage?(input: ReactToMessageInput): Promise<{ ok: true }>;

  /**
   * Pure transform from provider payload to the platform's normalized events.
   * Must be side-effect free and total — unknown payloads yield `[]`, never
   * throw — so a single malformed webhook cannot crash ingestion.
   */
  normalizeWebhook(input: RawGatewayWebhook): NormalizedGatewayEvent[];
}

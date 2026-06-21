/**
 * Shared domain vocabulary for Clariodesk.
 *
 * These are the canonical enums/shapes that cross module boundaries
 * (gateway adapters → normalization → policy → storage). Keeping them in one
 * dependency-free package prevents drift between the adapter layer and the DB
 * schema (TDD §6, §8).
 */

// ── Transport / gateway ────────────────────────────────────────────────
export const GATEWAY_ADAPTER_TYPES = [
  "clario_gateway",
  "evolution",
  "waha",
  "openwa",
  "meta_cloud",
] as const;
export type GatewayAdapterType = (typeof GATEWAY_ADAPTER_TYPES)[number];

export const CONNECTION_MODES = ["linked_device", "official_api"] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

export const PHONE_STATUSES = [
  "connected",
  "syncing",
  "disconnected",
  "qr_required",
  "degraded",
  "restricted",
  "archived",
] as const;
export type PhoneStatus = (typeof PHONE_STATUSES)[number];

// ── Channels / mapping ─────────────────────────────────────────────────
export const CHANNEL_TYPES = ["group", "direct", "official_direct"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_STATUSES = [
  "active",
  "archived",
  "muted",
  "unmapped",
] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export const MAPPING_MODES = [
  "unmapped",
  "single_client",
  "mixed",
  "archived",
] as const;
export type MappingMode = (typeof MAPPING_MODES)[number];

// ── Messages ───────────────────────────────────────────────────────────
export const MESSAGE_TYPES = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "reaction",
  "location",
  "contact_card",
  "poll",
  "system",
  "deleted",
  "unknown",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const SENT_BY_TYPES = [
  "client_user",
  "dashboard_agent",
  "phone_user", // "ghost agent" — replied directly from the physical device
  "automation",
  "ai",
  "system",
  "unknown",
] as const;
export type SentByType = (typeof SENT_BY_TYPES)[number];

export const MESSAGE_STATUSES = [
  "received",
  "sent",
  "delivered",
  "read",
  "failed",
  "deleted_on_whatsapp",
  "purged",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Message types that mutate or annotate another message rather than being
 * standalone timeline entries. They MUST be excluded from first-response/SLA,
 * unread counts, and ticket-eligibility (see TDD §6.11 review note).
 */
export const NON_OPERATIONAL_MESSAGE_TYPES: ReadonlySet<MessageType> = new Set([
  "reaction",
  "system",
  "deleted",
]);

// ── Outbox ─────────────────────────────────────────────────────────────
export const SEND_MODES = [
  "immediate",
  "delayed",
  "scheduled",
  "bulk",
] as const;
export type SendMode = (typeof SEND_MODES)[number];

export const OUTBOX_STATUSES = [
  "pending",
  "waiting_delay",
  "policy_blocked",
  "queued",
  "sending",
  "sent",
  "failed",
  "retrying",
  "cancelled",
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const POLICY_STATUSES = [
  "allowed",
  "blocked",
  "needs_approval",
] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

// ── Media ──────────────────────────────────────────────────────────────
export const MEDIA_STORAGE_STATUSES = [
  "pending",
  "downloaded",
  "failed",
  "expired",
  "purged",
  "quarantined",
] as const;
export type MediaStorageStatus = (typeof MEDIA_STORAGE_STATUSES)[number];

export const MEDIA_SOURCES = ["live", "backfill", "upload"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

// ── Tickets ────────────────────────────────────────────────────────────
export const TICKET_STATUSES = ["open", "pending", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

// ── Access control ─────────────────────────────────────────────────────
export const WORKSPACE_ROLES = ["admin", "agent", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

// ── Normalized gateway event (adapter → pipeline contract) ─────────────

/** A media descriptor as reported by a gateway, before download. */
export type NormalizedMediaRef = {
  mediaType: MessageType;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  /** Opaque handle the adapter uses to fetch the bytes (url, id, key…). */
  providerMediaId: string;
  /** Some gateways need decryption keys to download media. */
  providerMediaKey?: string;
};

/**
 * The provider-agnostic shape every adapter's `normalizeWebhook` must emit.
 * The pipeline never sees raw gateway JSON beyond this point (TDD §8.2).
 */
export type NormalizedGatewayEvent = {
  adapterType: GatewayAdapterType;
  /** Stable per-message id from the provider; used for idempotency. */
  providerMessageId: string;
  providerChatId: string;
  providerSenderId?: string;
  channelType: ChannelType;
  messageType: MessageType;
  direction: MessageDirection;
  /** Sender's WhatsApp display/push name, used as the channel alias. */
  senderDisplayName?: string;
  body?: string;
  media?: NormalizedMediaRef[];
  quotedProviderMessageId?: string;
  /** Epoch millis from the provider — the operational truth for ordering/SLA. */
  providerTimestampMs: number;
  /** Set by adapters that flag a history-sync/backlog batch. */
  isHistorySync?: boolean;
  /**
   * Set when this event is a "delete for everyone" (revoke) targeting an
   * earlier message. The pipeline marks the target deleted rather than storing
   * a new message (TDD §18).
   */
  revokeTargetProviderMessageId?: string;
  /** Group metadata change (rename/description/participants) — see GroupMetadataEvent. */
  groupMetadata?: GroupMetadataChange;
  /** Group/metadata events the adapter could not map to a message. */
  systemEventType?: string;
  raw?: unknown;
};

/** A normalized group metadata change emitted by adapters (TDD §O.4). */
export type GroupMetadataChange = {
  eventType:
    | "subject_changed"
    | "description_changed"
    | "participant_added"
    | "participant_removed"
    | "other";
  oldValue?: string;
  newValue?: string;
  changedByProviderId?: string;
};

import type {
  MappingMode,
  MessageDirection,
  MessageType,
  SentByType,
} from "@clariodesk/types";

/**
 * Storage port for the normalization pipeline (hexagonal boundary). The
 * orchestration logic depends only on this interface, so it can be unit-tested
 * with an in-memory fake and implemented for real with Drizzle in `./drizzle.ts`.
 */

export type ChannelContext = {
  channelId: string;
  mappingMode: MappingMode;
  /** Effective mapping boundary in epoch millis, or null when unmapped. */
  mappingEffectiveAtMs: number | null;
  clientId: string | null;
  projectId: string | null;
};

export type SenderResolution = {
  contactId: string | null;
  isInternal: boolean;
};

export type InsertMessageRow = {
  workspaceId: string;
  channelId: string;
  clientId: string | null;
  projectId: string | null;
  phoneInstanceId: string;
  providerMessageId: string;
  providerChatId: string;
  providerSenderId: string | null;
  senderContactId: string | null;
  messageType: MessageType;
  direction: MessageDirection;
  sentByType: SentByType;
  body: string | null;
  quotedProviderMessageId: string | null;
  providerTimestamp: Date;
  isBackfill: boolean;
  isLiveEvent: boolean;
  automationSuppressed: boolean;
  automationSuppressedReason: string | null;
  slaEligible: boolean;
  ticketAutoCreateEligible: boolean;
  rawEventRefId: string | null;
};

export type InsertMediaRow = {
  workspaceId: string;
  messageId: string;
  clientId: string | null;
  channelId: string;
  mediaType: MessageType;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  providerMediaId: string | null;
  providerMediaKey: string | null;
  source: "live" | "backfill";
};

export type InsertedMedia = { mediaId: string; row: InsertMediaRow };

export interface NormalizationStore {
  getOrCreateChannel(input: {
    workspaceId: string;
    phoneInstanceId: string;
    providerChatId: string;
    channelType: "group" | "direct" | "official_direct";
  }): Promise<ChannelContext>;

  /**
   * Resolve the sender to a contact and internal/external status. For inbound
   * messages (`createIfMissing`) this also upserts the contact, its provider
   * identity, and the channel membership so contacts/members populate.
   */
  resolveSender(input: {
    workspaceId: string;
    channelId: string;
    providerSenderId: string | null;
    senderDisplayName: string | null;
    clientId: string | null;
    projectId: string | null;
    phoneInstanceOwner: boolean;
    createIfMissing: boolean;
  }): Promise<SenderResolution>;

  /** Returns the existing message id if this provider id was already stored. */
  findMessageByIdempotency(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null>;

  findOutboxByProviderMessageId(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null>;

  insertMessage(row: InsertMessageRow): Promise<{ id: string }>;

  /** Merge an outbound echo into the outbox row; returns/creates the message. */
  mergeOutboxEcho(
    outboxId: string,
    row: InsertMessageRow,
  ): Promise<{ id: string }>;

  insertMedia(rows: InsertMediaRow[]): Promise<InsertedMedia[]>;

  touchChannelLastMessage(channelId: string, at: Date): Promise<void>;

  /** Start the first-response clock if not already waiting (idempotent). */
  markAwaitingResponse(channelId: string, at: Date): Promise<void>;

  /**
   * Record a team reply: clear the channel's awaiting-response clock and stamp
   * first_response_at on any open tickets in the channel that lack it.
   */
  recordTeamResponse(channelId: string, at: Date): Promise<void>;

  /**
   * Mark a message deleted-on-WhatsApp (delete-for-everyone). Keeps the row +
   * evidence (TDD §18). Returns the internal message id, or null if not found.
   */
  markMessageDeleted(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<string | null>;

  /** Record a group metadata change for admin review (TDD §O.4). */
  recordGroupMetadataEvent(input: {
    workspaceId: string;
    channelId: string;
    clientId: string | null;
    projectId: string | null;
    eventType: string;
    oldValue: string | null;
    newValue: string | null;
    providerTimestamp: Date;
  }): Promise<void>;
}

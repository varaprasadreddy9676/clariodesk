import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { clients, projects, users, workspaces } from "./core.js";
import { phoneInstances } from "./transport.js";
import { channels } from "./channel.js";
import { contacts } from "./identity.js";
import {
  adapterTypeEnum,
  mediaSourceEnum,
  mediaStorageStatusEnum,
  messageDirectionEnum,
  messageStatusEnum,
  messageTypeEnum,
  outboxStatusEnum,
  policyStatusEnum,
  sendModeEnum,
  sentByTypeEnum,
} from "./enums.js";

/**
 * Metadata-only reference to a raw gateway payload. The payload itself lives in
 * object storage as `.json.gz` — NOT as a JSON blob in Postgres (TDD §6.13,
 * §8.3) to avoid TOAST bloat and keep retention/backup manageable.
 */
export const rawEventRefs = pgTable(
  "raw_event_refs",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    phoneInstanceId: uuid("phone_instance_id")
      .notNull()
      .references(() => phoneInstances.id, { onDelete: "cascade" }),
    adapterType: adapterTypeEnum("adapter_type").notNull(),
    providerEventId: text("provider_event_id"),
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    providerTimestamp: timestamp("provider_timestamp", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    compressedSizeBytes: integer("compressed_size_bytes"),
    sha256Hash: text("sha256_hash"),
    /** S3/MinIO key: raw-events/{ws}/{yyyy}/{mm}/{dd}/{event_id}.json.gz */
    objectKey: text("object_key").notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    processingStatus: text("processing_status").notNull().default("received"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("raw_event_refs_ws_idx").on(t.workspaceId),
    index("raw_event_refs_retention_idx").on(t.retentionUntil),
  ],
);

/**
 * Normalized message — the operational unit (TDD §6.11).
 *
 * SAFETY: `client_id`/`project_id` are set ONCE at ingest from the mapping
 * effective then, and are immutable afterwards. A later remap does not rewrite
 * history (TDD §6.11 review note + §O.4.7), so analytics-by-mapping-period stay
 * correct.
 */
export const messages = pgTable(
  "messages",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    phoneInstanceId: uuid("phone_instance_id")
      .notNull()
      .references(() => phoneInstances.id, { onDelete: "cascade" }),

    providerMessageId: text("provider_message_id").notNull(),
    providerChatId: text("provider_chat_id").notNull(),
    providerSenderId: text("provider_sender_id"),
    senderContactId: uuid("sender_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

    messageType: messageTypeEnum("message_type").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    sentByType: sentByTypeEnum("sent_by_type").notNull().default("unknown"),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    body: text("body"),
    quotedProviderMessageId: text("quoted_provider_message_id"),
    quotedMessageId: uuid("quoted_message_id"),

    providerTimestamp: timestamp("provider_timestamp", {
      withTimezone: true,
    }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // ── P0 safety flags (TDD §8.5) ──
    isBackfill: boolean("is_backfill").notNull().default(false),
    isLiveEvent: boolean("is_live_event").notNull().default(true),
    automationSuppressed: boolean("automation_suppressed")
      .notNull()
      .default(false),
    automationSuppressedReason: text("automation_suppressed_reason"),
    slaEligible: boolean("sla_eligible").notNull().default(false),
    ticketAutoCreateEligible: boolean("ticket_auto_create_eligible")
      .notNull()
      .default(false),

    rawEventRefId: uuid("raw_event_ref_id").references(() => rawEventRefs.id, {
      onDelete: "set null",
    }),
    status: messageStatusEnum("status").notNull().default("received"),
    ...timestamps,
  },
  (t) => [
    // Idempotency key (TDD §8.4) — dedupes live webhook vs backfill arrivals
    // AND the outbound echo of a dashboard-sent message.
    uniqueIndex("messages_idempotency_uq").on(
      t.workspaceId,
      t.channelId,
      t.providerMessageId,
    ),
    // Timeline read path (TDD §16.2) — channel ordered by provider time.
    index("messages_ws_channel_time_idx").on(
      t.workspaceId,
      t.channelId,
      t.providerTimestamp,
    ),
    index("messages_ws_client_time_idx").on(
      t.workspaceId,
      t.clientId,
      t.providerTimestamp,
    ),
    // Full-text search over message bodies (TDD §16.1).
    index("messages_body_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.body}, ''))`,
    ),
  ],
);

/** Media attached to a message; bytes live in object storage (TDD §6.12). */
export const messageMedia = pgTable(
  "message_media",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    /** Opaque key — never embeds the filename (TDD §9.3 review note). */
    storageKey: text("storage_key"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sha256Hash: text("sha256_hash"),
    mediaType: messageTypeEnum("media_type").notNull(),
    storageStatus: mediaStorageStatusEnum("storage_status")
      .notNull()
      .default("pending"),
    source: mediaSourceEnum("source").notNull().default("live"),
    /** Adapter handle used to (re)download before WhatsApp links expire. */
    providerMediaId: text("provider_media_id"),
    providerMediaKey: text("provider_media_key"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("message_media_message_idx").on(t.messageId),
    index("message_media_status_idx").on(t.storageStatus),
    // Recent-asset fingerprint cache for cross-client upload blocking (§O.2.5).
    index("message_media_hash_idx").on(t.workspaceId, t.sha256Hash),
  ],
);

/**
 * Every outbound send flows through this outbox (TDD §6.14, §10). Never send
 * directly from the API to the gateway. The send-delay window and policy gate
 * both live here.
 */
export const outboxMessages = pgTable(
  "outbox_messages",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    phoneInstanceId: uuid("phone_instance_id")
      .notNull()
      .references(() => phoneInstances.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    messageType: messageTypeEnum("message_type").notNull().default("text"),
    body: text("body"),
    mediaId: uuid("media_id"),
    quotedMessageId: uuid("quoted_message_id"),
    sendMode: sendModeEnum("send_mode").notNull().default("immediate"),
    /** Dispatch no earlier than this (send-delay / scheduled / jitter). */
    sendAfter: timestamp("send_after", { withTimezone: true }),
    status: outboxStatusEnum("status").notNull().default("pending"),
    policyStatus: policyStatusEnum("policy_status")
      .notNull()
      .default("allowed"),
    failureReason: text("failure_reason"),
    /** Returned by the adapter on send; used to merge the inbound echo (§8.4). */
    providerMessageId: text("provider_message_id"),
    idempotencyKey: uuid("idempotency_key"),
    retryCount: integer("retry_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("outbox_ws_status_idx").on(t.workspaceId, t.status),
    index("outbox_send_after_idx").on(t.sendAfter),
    uniqueIndex("outbox_ws_idempotency_uq").on(t.workspaceId, t.idempotencyKey),
    // Fast lookup when reconciling an inbound echo to its outbox row.
    index("outbox_provider_msg_idx").on(
      t.workspaceId,
      t.channelId,
      t.providerMessageId,
    ),
  ],
);

import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import {
  channelStatusEnum,
  channelTypeEnum,
  mappingModeEnum,
} from "./enums.js";
import { clients, projects, users, workspaces } from "./core.js";
import { phoneInstances } from "./transport.js";

/** A WhatsApp group or 1:1 conversation (TDD §6.6). */
export const channels = pgTable(
  "channels",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    phoneInstanceId: uuid("phone_instance_id")
      .notNull()
      .references(() => phoneInstances.id, { onDelete: "cascade" }),
    providerChatId: text("provider_chat_id").notNull(),
    channelType: channelTypeEnum("channel_type").notNull(),
    title: text("title"),
    subject: text("subject"),
    avatarUrl: text("avatar_url"),
    status: channelStatusEnum("status").notNull().default("unmapped"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    // First-response read model (TDD §14.3): set when an eligible client
    // message is awaiting a team reply; cleared when the team replies.
    awaitingResponseSince: timestamp("awaiting_response_since", {
      withTimezone: true,
    }),
    lastAgentReplyAt: timestamp("last_agent_reply_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // A provider chat is unique per phone instance within a workspace.
    uniqueIndex("channels_ws_phone_chat_uq").on(
      t.workspaceId,
      t.phoneInstanceId,
      t.providerChatId,
    ),
    index("channels_ws_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * Assigns a channel to a client/project with a time boundary (TDD §6.7).
 * `mappingEffectiveAt` is the line between historical context and live
 * operations — the single most important safety field in the system.
 */
export const channelMappings = pgTable(
  "channel_mappings",
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
    mappingMode: mappingModeEnum("mapping_mode").notNull().default("unmapped"),
    mappingEffectiveAt: timestamp("mapping_effective_at", {
      withTimezone: true,
    }).notNull(),
    mappedByUserId: uuid("mapped_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** active mapping vs superseded historical mapping (context drift §O.4). */
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("channel_mappings_channel_idx").on(t.channelId),
    // Exactly one active mapping per channel at a time; old ones are status=ended.
    uniqueIndex("channel_mappings_one_active_uq")
      .on(t.channelId)
      .where(sql`${t.status} = 'active'`),
  ],
);

/** Group metadata change events — rename/description/participants (§O.4.3). */
export const groupMetadataEvents = pgTable(
  "group_metadata_events",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedByContactId: uuid("changed_by_contact_id"),
    providerTimestamp: timestamp("provider_timestamp", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** pending | reviewed | ignored — drives the Channel Registry review task. */
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("group_metadata_events_channel_idx").on(t.channelId),
    index("group_metadata_events_review_idx").on(t.workspaceId, t.reviewStatus),
  ],
);

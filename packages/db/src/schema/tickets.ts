import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { clients, projects, users, workspaces } from "./core.js";
import { channels } from "./channel.js";
import { messages } from "./messages.js";
import { ticketPriorityEnum, ticketStatusEnum } from "./enums.js";

/** v1 ticket — deliberately simple (TDD §6.15, §14.1). */
export const tickets = pgTable(
  "tickets",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    sourceMessageId: uuid("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("tickets_ws_client_status_idx").on(
      t.workspaceId,
      t.clientId,
      t.status,
    ),
    index("tickets_ws_assignee_idx").on(t.workspaceId, t.assignedUserId),
    index("tickets_channel_idx").on(t.channelId),
    // Full-text search over ticket title + description (TDD §16.1).
    index("tickets_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.title}, '') || ' ' || coalesce(${t.description}, ''))`,
    ),
  ],
);

/** Many-to-many link between tickets and the messages that evidence them. */
export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId)],
);

/**
 * Internal note — NEVER sent to WhatsApp (TDD §15.2). Visually and structurally
 * separated from outbound replies so it cannot leak.
 */
export const internalNotes = pgTable(
  "internal_notes",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    ticketId: uuid("ticket_id").references(() => tickets.id, {
      onDelete: "cascade",
    }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [
    index("internal_notes_channel_idx").on(t.channelId),
    index("internal_notes_ticket_idx").on(t.ticketId),
  ],
);

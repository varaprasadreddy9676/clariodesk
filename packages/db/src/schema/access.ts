import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { clients, users, workspaces } from "./core.js";
import { channels } from "./channel.js";

/**
 * Least-privilege access (TDD §12.4, Addendum §A). Absence of a row = no
 * visibility. Server queries MUST filter by these, not just hide in the UI.
 */
export const clientAssignments = pgTable(
  "client_assignments",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessLevel: text("access_level").notNull().default("agent"), // agent | viewer
    ...timestamps,
  },
  (t) => [
    uniqueIndex("client_assignments_uq").on(t.clientId, t.userId),
    index("client_assignments_user_idx").on(t.workspaceId, t.userId),
  ],
);

/** Channel-level grant for finer access than client-wide. */
export const channelAssignments = pgTable(
  "channel_assignments",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessLevel: text("access_level").notNull().default("agent"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("channel_assignments_uq").on(t.channelId, t.userId),
    index("channel_assignments_user_idx").on(t.workspaceId, t.userId),
  ],
);

/** Per-user unread tracking — derived server-side, not in FE memory (TDD §13.5). */
export const userChannelReadState = pgTable(
  "user_channel_read_state",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    isMarkedUnread: boolean("is_marked_unread").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_channel_read_state_uq").on(t.userId, t.channelId)],
);

import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { users, workspaces } from "./core.js";

/**
 * Append-only audit trail (TDD §23.5). Every external send, note, ticket
 * change, mapping change, and media download lands here. Never updated.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** e.g. message.sent, note.created, ticket.updated, channel.mapped. */
    action: text("action").notNull(),
    /** Logical object kind the action targeted (message, ticket, channel…). */
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    /** Structured, non-sensitive context (ids, before/after status). */
    metadata: jsonb("metadata"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("audit_logs_ws_time_idx").on(t.workspaceId, t.createdAt),
    index("audit_logs_target_idx").on(t.targetType, t.targetId),
  ],
);

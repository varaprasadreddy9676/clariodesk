import { sql } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { users, workspaces } from "./core.js";

/**
 * Canned response ("quick reply" / macro) — reusable reply text a support
 * agent can insert into the composer instead of retyping common answers.
 * Shared across the whole workspace (like a team knowledge base), not
 * per-agent, so the whole team benefits from what one agent writes.
 */
export const cannedResponses = pgTable(
  "canned_responses",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Short shortcut/name shown in the picker, e.g. "Refund policy". */
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("canned_responses_ws_idx").on(t.workspaceId),
    // One title per workspace so the picker never shows ambiguous duplicates.
    uniqueIndex("canned_responses_ws_title_uq").on(t.workspaceId, t.title),
    // Full-text search over title + body, same pattern as tickets_fts_idx.
    index("canned_responses_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.title}, '') || ' ' || coalesce(${t.body}, ''))`,
    ),
  ],
);

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
import { aiConnectionStatusEnum, aiProviderEnum } from "./enums.js";
import { users, workspaces } from "./core.js";

/**
 * BYOK model-provider connection (docs/ai/ai-native-byok-architecture.md).
 * A workspace brings its own API key for whichever provider it prefers —
 * no feature in ClarioDesk is coupled to one vendor. This table is
 * deliberately the *only* thing this pass adds: encrypted key storage +
 * a health-check result. No AI feature reads from it yet.
 */
export const aiProviderConnections = pgTable(
  "ai_provider_connections",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: aiProviderEnum("provider").notNull(),
    /** Admin-facing name, e.g. "Anthropic (prod)" — providers can be connected more than once. */
    label: text("label").notNull(),
    /** API key, AES-256-GCM encrypted at rest — never sent to the browser, never logged. */
    encryptedApiKey: text("encrypted_api_key").notNull(),
    /** Only for provider "custom" (self-hosted / OpenAI-compatible endpoints). */
    baseUrl: text("base_url"),
    /** Default model id for this connection, e.g. "claude-sonnet-5" or "gpt-4o". */
    model: text("model"),
    status: aiConnectionStatusEnum("status").notNull().default("active"),
    lastHealthCheckAt: timestamp("last_health_check_at", {
      withTimezone: true,
    }),
    lastHealthCheckOk: boolean("last_health_check_ok"),
    lastHealthCheckError: text("last_health_check_error"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("ai_provider_connections_ws_idx").on(t.workspaceId),
    uniqueIndex("ai_provider_connections_ws_label_uq").on(
      t.workspaceId,
      t.label,
    ),
  ],
);

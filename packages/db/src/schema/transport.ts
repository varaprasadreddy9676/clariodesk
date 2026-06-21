import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import {
  adapterTypeEnum,
  connectionModeEnum,
  phoneStatusEnum,
} from "./enums.js";
import { workspaces } from "./core.js";

/** A connected WhatsApp number/session (TDD §6.5). */
export const phoneInstances = pgTable(
  "phone_instances",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    adapterType: adapterTypeEnum("adapter_type").notNull(),
    phoneNumber: text("phone_number"),
    displayName: text("display_name").notNull(),
    connectionMode: connectionModeEnum("connection_mode")
      .notNull()
      .default("linked_device"),
    status: phoneStatusEnum("status").notNull().default("qr_required"),
    gatewayNodeId: text("gateway_node_id"),
    /** Adapter-specific instance handle (e.g. Evolution instance name). */
    providerInstanceId: text("provider_instance_id"),
    /** Optional per-phone gateway base URL (else falls back to env default). */
    gatewayBaseUrl: text("gateway_base_url"),
    /** Per-phone gateway API key, AES-256-GCM encrypted at rest (TDD §23.4). */
    encryptedApiKey: text("encrypted_api_key"),
    riskLevel: text("risk_level").notNull().default("normal"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("phone_instances_ws_idx").on(t.workspaceId),
    // Same physical number may exist in different workspaces (TDD §9.3) —
    // uniqueness is scoped per workspace, never global.
    uniqueIndex("phone_instances_ws_provider_uq").on(
      t.workspaceId,
      t.adapterType,
      t.providerInstanceId,
    ),
  ],
);

/**
 * Linked-device session secrets, encrypted at rest (TDD §23.4).
 * Only the worker/api hold the decryption key; never exposed to the browser.
 */
export const gatewaySessions = pgTable(
  "gateway_sessions",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    phoneInstanceId: uuid("phone_instance_id")
      .notNull()
      .references(() => phoneInstances.id, { onDelete: "cascade" }),
    /** Ciphertext blob; structure is adapter-specific. */
    encryptedSession: jsonb("encrypted_session"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("gateway_sessions_phone_uq").on(t.phoneInstanceId),
    index("gateway_sessions_ws_idx").on(t.workspaceId),
  ],
);

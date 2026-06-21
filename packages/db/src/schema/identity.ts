import {
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
import { channels } from "./channel.js";

/** Workspace-scoped global contact identity (TDD §6.8). */
export const contacts = pgTable(
  "contacts",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    primaryPhone: text("primary_phone").notNull(),
    canonicalName: text("canonical_name").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    /** Inferred-internal if the phone belongs to a workspace user (§L). */
    isInternalGlobal: boolean("is_internal_global").notNull().default(false),
    source: text("source").notNull().default("whatsapp"),
    ...timestamps,
  },
  (t) => [
    // Phone is unique *per workspace*, never globally (TDD §6.8).
    uniqueIndex("contacts_ws_phone_uq").on(t.workspaceId, t.primaryPhone),
  ],
);

/** Provider-specific identifiers for a contact (TDD §6.9). */
export const contactIdentities = pgTable(
  "contact_identities",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    phone: text("phone"),
    source: text("source").notNull().default("whatsapp"),
    confidenceScore: integer("confidence_score").notNull().default(100),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contact_identities_provider_uq").on(
      t.workspaceId,
      t.provider,
      t.providerUserId,
    ),
    index("contact_identities_contact_idx").on(t.contactId),
  ],
);

/** How a contact appears inside a specific channel (TDD §6.10). */
export const channelMemberships = pgTable(
  "channel_memberships",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    /** WhatsApp display name = channel alias, NOT global truth (TDD §14.5). */
    displayNameInChannel: text("display_name_in_channel"),
    roleInChannel: text("role_in_channel"),
    isInternalOverride: boolean("is_internal_override"),
    isClientSideOverride: boolean("is_client_side_override"),
    isVerified: boolean("is_verified").notNull().default(false),
    source: text("source").notNull().default("whatsapp"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("channel_memberships_channel_contact_uq").on(
      t.channelId,
      t.contactId,
    ),
    index("channel_memberships_contact_idx").on(t.contactId),
  ],
);

/**
 * Links a workspace user to the contact/phone they message from, so outbound
 * replies from the physical device can be attributed and SLA handled (§L).
 */
export const workspaceUserIdentities = pgTable(
  "workspace_user_identities",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    phone: text("phone").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** active | former_internal (set when the employee leaves, §L). */
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("workspace_user_identities_ws_phone_uq").on(
      t.workspaceId,
      t.phone,
    ),
    index("workspace_user_identities_user_idx").on(t.userId),
  ],
);

import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pk, timestamps } from "./_shared.js";
import { workspaceRoleEnum } from "./enums.js";

/** A workspace = one organization/customer using the platform (TDD §6.2). */
export const workspaces = pgTable("workspaces", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  planType: text("plan_type").notNull().default("free"),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  ...timestamps,
});

/** Global login identities (TDD §6.3). */
export const users = pgTable("users", {
  id: pk(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name").notNull(),
  ...timestamps,
});

/** A user's membership + role inside one workspace (TDD §6.3). */
export const workspaceUsers = pgTable(
  "workspace_users",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("agent"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("workspace_users_ws_user_uq").on(t.workspaceId, t.userId),
    index("workspace_users_ws_idx").on(t.workspaceId),
  ],
);

/** External accounts/customers managed by the workspace (TDD §6.4). */
export const clients = pgTable(
  "clients",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [index("clients_ws_idx").on(t.workspaceId)],
);

/** Sub-containers under a client (TDD §6.4). */
export const projects = pgTable(
  "projects",
  {
    id: pk(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    index("projects_ws_idx").on(t.workspaceId),
    index("projects_client_idx").on(t.clientId),
  ],
);

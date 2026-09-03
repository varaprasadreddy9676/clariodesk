import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import { AuditLogReaderService } from "./audit-log-reader.service.js";

let container: StartedPostgreSqlContainer;
let db: Database;
let service: AuditLogReaderService;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  service = new AuditLogReaderService(db);
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

describe("AuditLogReaderService.list", () => {
  it("rejects a non-admin caller", async () => {
    const fixture = await createFixture();
    await expect(
      service.list({ ...fixture.admin, role: "agent" }, { limit: 50 }),
    ).rejects.toThrow("Admin role required");
  });

  it("returns entries newest first, joined with the actor's name", async () => {
    const fixture = await createFixture();
    await db.insert(schema.auditLogs).values([
      {
        workspaceId: fixture.workspaceId,
        actorUserId: fixture.userId,
        action: "message.sent",
        targetType: "channel",
        targetId: fixture.channelId,
        createdAt: new Date("2026-06-21T09:00:00.000Z"),
      },
      {
        workspaceId: fixture.workspaceId,
        actorUserId: fixture.userId,
        action: "note.created",
        targetType: "channel",
        targetId: fixture.channelId,
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
      },
    ]);

    const rows = await service.list(fixture.admin, { limit: 50 });

    expect(rows.map((row) => row.action)).toEqual([
      "note.created",
      "message.sent",
    ]);
    expect(rows[0]?.actorName).toBe("Admin");
  });

  it("never returns another workspace's entries", async () => {
    const fixture = await createFixture();
    const otherWorkspaceId = randomUUID();
    await db.insert(schema.workspaces).values({
      id: otherWorkspaceId,
      name: "Other",
      slug: `ws-${otherWorkspaceId}`,
    });
    await db.insert(schema.auditLogs).values({
      workspaceId: otherWorkspaceId,
      actorUserId: null,
      action: "message.sent",
    });

    const rows = await service.list(fixture.admin, { limit: 50 });

    expect(rows.every((row) => row.action !== "message.sent")).toBe(true);
  });

  it("filters by action", async () => {
    const fixture = await createFixture();
    await db.insert(schema.auditLogs).values([
      { workspaceId: fixture.workspaceId, actorUserId: null, action: "a" },
      { workspaceId: fixture.workspaceId, actorUserId: null, action: "b" },
    ]);

    const rows = await service.list(fixture.admin, {
      action: "a",
      limit: 50,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("a");
  });
});

async function createFixture() {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const channelId = randomUUID();
  const phoneInstanceId = randomUUID();

  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@example.test`,
    displayName: "Admin",
  });
  await db.insert(schema.phoneInstances).values({
    id: phoneInstanceId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "WhatsApp",
    status: "connected",
  });
  await db.insert(schema.channels).values({
    id: channelId,
    workspaceId,
    phoneInstanceId,
    providerChatId: "chat@c.us",
    channelType: "direct",
    title: "Client",
    status: "active",
  });

  return {
    admin: { userId, workspaceId, role: "admin" as const },
    workspaceId,
    userId,
    channelId,
  };
}

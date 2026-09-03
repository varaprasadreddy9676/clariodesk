import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AccessService } from "../common/access.service.js";
import { ContactsService } from "./contacts.service.js";

let container: StartedPostgreSqlContainer;
let db: Database;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

describe("ContactsService.searchForNewChat", () => {
  it("only returns contacts reachable through channels the caller can access", async () => {
    const fixture = await createFixture();
    const access = {
      accessibleChannelIds: vi
        .fn()
        .mockResolvedValue([fixture.allowedChannelId]),
    } as unknown as AccessService;
    const service = new ContactsService(db, access);

    const results = await service.searchForNewChat(fixture.user, "Priya");

    expect(results.map((row) => row.id)).toEqual([fixture.allowedContactId]);
    expect(access.accessibleChannelIds).toHaveBeenCalledWith(fixture.user);
  });

  it("returns nothing when the caller has no accessible channels", async () => {
    const fixture = await createFixture();
    const access = {
      accessibleChannelIds: vi.fn().mockResolvedValue([]),
    } as unknown as AccessService;
    const service = new ContactsService(db, access);

    const results = await service.searchForNewChat(fixture.user, "Priya");

    expect(results).toEqual([]);
  });

  it("matches by phone number and dedupes a contact across channels", async () => {
    const fixture = await createFixture();
    const access = {
      accessibleChannelIds: vi.fn().mockResolvedValue("all" as const),
    } as unknown as AccessService;
    const service = new ContactsService(db, access);

    const results = await service.searchForNewChat(
      fixture.user,
      fixture.allowedContactPhone,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: fixture.allowedContactId });
  });
});

async function createFixture() {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneInstanceId = randomUUID();
  const allowedChannelId = randomUUID();
  const otherChannelId = randomUUID();
  const allowedContactId = randomUUID();
  const otherContactId = randomUUID();
  const allowedContactPhone = "+919533300001";

  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.phoneInstances).values({
    id: phoneInstanceId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "WhatsApp",
    status: "connected",
  });
  await db.insert(schema.channels).values([
    {
      id: allowedChannelId,
      workspaceId,
      phoneInstanceId,
      providerChatId: "allowed@c.us",
      channelType: "direct",
      title: "Allowed",
      status: "active",
    },
    {
      id: otherChannelId,
      workspaceId,
      phoneInstanceId,
      providerChatId: "other@c.us",
      channelType: "direct",
      title: "Other",
      status: "active",
    },
  ]);
  await db.insert(schema.contacts).values([
    {
      id: allowedContactId,
      workspaceId,
      primaryPhone: allowedContactPhone,
      canonicalName: "Priya Sharma",
    },
    {
      id: otherContactId,
      workspaceId,
      primaryPhone: "+919533300002",
      canonicalName: "Priyanka Reddy",
    },
  ]);
  await db.insert(schema.channelMemberships).values([
    {
      workspaceId,
      channelId: allowedChannelId,
      contactId: allowedContactId,
    },
    {
      workspaceId,
      channelId: otherChannelId,
      contactId: otherContactId,
    },
  ]);

  return {
    user: { userId, workspaceId, role: "agent" as const },
    allowedChannelId,
    allowedContactId,
    allowedContactPhone,
  };
}

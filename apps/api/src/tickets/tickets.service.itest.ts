import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RealtimePublisher } from "@clariodesk/events";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AuthUser } from "../common/auth-context.js";
import type { AuditService } from "../common/audit.service.js";
import { AccessService } from "../common/access.service.js";
import { TicketsService } from "./tickets.service.js";

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

async function seedTicketFixture(input: {
  sourceAt: Date;
  lastAgentReplyAt?: Date | null;
}) {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneId = randomUUID();
  const clientId = randomUUID();
  const channelId = randomUUID();
  const messageId = randomUUID();

  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@example.com`,
    displayName: "Admin",
  });
  await db.insert(schema.phoneInstances).values({
    id: phoneId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Support Phone",
    providerInstanceId: `phone-${phoneId}`,
    status: "connected",
  });
  await db.insert(schema.clients).values({
    id: clientId,
    workspaceId,
    name: "Client A",
  });
  await db.insert(schema.channels).values({
    id: channelId,
    workspaceId,
    phoneInstanceId: phoneId,
    providerChatId: "120363000000@g.us",
    channelType: "group",
    status: "active",
    awaitingResponseSince: null,
    lastAgentReplyAt: input.lastAgentReplyAt ?? null,
  });
  await db.insert(schema.channelMappings).values({
    workspaceId,
    channelId,
    clientId,
    mappingMode: "single_client",
    mappingEffectiveAt: new Date(input.sourceAt.getTime() - 60_000),
    status: "active",
  });
  await db.insert(schema.messages).values({
    id: messageId,
    workspaceId,
    channelId,
    clientId,
    phoneInstanceId: phoneId,
    providerMessageId: `msg-${messageId}`,
    providerChatId: "120363000000@g.us",
    messageType: "text",
    direction: "inbound",
    sentByType: "client_user",
    body: "Need help",
    providerTimestamp: input.sourceAt,
    isBackfill: false,
    isLiveEvent: true,
    automationSuppressed: false,
    slaEligible: true,
    ticketAutoCreateEligible: true,
  });

  return {
    user: { userId, workspaceId, role: "admin" } satisfies AuthUser,
    channelId,
    messageId,
  };
}

function makeService() {
  const realtime = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as RealtimePublisher;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  return new TicketsService(db, realtime, new AccessService(db), audit);
}

describe("TicketsService.create (integration)", () => {
  it("inherits the channel first-response timestamp when the source message was already answered", async () => {
    const sourceAt = new Date("2026-06-13T08:00:00.000Z");
    const replyAt = new Date("2026-06-13T08:03:00.000Z");
    const { user, channelId, messageId } = await seedTicketFixture({
      sourceAt,
      lastAgentReplyAt: replyAt,
    });
    const service = makeService();

    const created = await service.create(user, {
      channelId,
      sourceMessageId: messageId,
      title: "Portal outage",
      priority: "normal",
    });

    const [ticket] = await db
      .select({ firstResponseAt: schema.tickets.firstResponseAt })
      .from(schema.tickets)
      .where(eq(schema.tickets.id, created.id));
    expect(ticket?.firstResponseAt?.toISOString()).toBe(replyAt.toISOString());
  });

  it("leaves first_response_at empty when the source message has not been answered yet", async () => {
    const { user, channelId, messageId } = await seedTicketFixture({
      sourceAt: new Date("2026-06-13T08:00:00.000Z"),
      lastAgentReplyAt: null,
    });
    const service = makeService();

    const created = await service.create(user, {
      channelId,
      sourceMessageId: messageId,
      title: "Portal outage",
      priority: "normal",
    });

    const [ticket] = await db
      .select({ firstResponseAt: schema.tickets.firstResponseAt })
      .from(schema.tickets)
      .where(eq(schema.tickets.id, created.id));
    expect(ticket?.firstResponseAt).toBeNull();
  });
});

import { ForbiddenException } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AuthUser } from "../common/auth-context.js";
import type { QueueRegistry } from "../core/queues.js";
import { OpsService } from "./ops.service.js";

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

function queueRegistry(): QueueRegistry {
  const queue = (counts: Record<string, number>) => ({
    getJobCounts: vi.fn().mockResolvedValue(counts),
  });
  return {
    messageNormalization: queue({
      waiting: 2,
      active: 1,
      failed: 0,
      delayed: 0,
      paused: 0,
    }),
    mediaDownloadLive: queue({
      waiting: 0,
      active: 0,
      failed: 1,
      delayed: 0,
      paused: 0,
    }),
    mediaDownloadBackfill: queue({
      waiting: 5,
      active: 0,
      failed: 0,
      delayed: 3,
      paused: 0,
    }),
    outboxSend: queue({
      waiting: 1,
      active: 0,
      failed: 2,
      delayed: 4,
      paused: 0,
    }),
  } as unknown as QueueRegistry;
}

async function seedOpsFixture() {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneId = randomUUID();
  const clientId = randomUUID();
  const channelId = randomUUID();

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
  await db.insert(schema.phoneInstances).values([
    {
      id: phoneId,
      workspaceId,
      adapterType: "clario_gateway",
      displayName: "Support Phone",
      providerInstanceId: `phone-${phoneId}`,
      status: "connected",
      lastSeenAt: new Date("2026-06-13T08:00:00.000Z"),
    },
    {
      workspaceId,
      adapterType: "clario_gateway",
      displayName: "Backup Phone",
      providerInstanceId: `backup-${phoneId}`,
      status: "degraded",
      riskLevel: "high",
    },
  ]);
  await db
    .insert(schema.clients)
    .values({ id: clientId, workspaceId, name: "Client A" });
  await db.insert(schema.channels).values([
    {
      id: channelId,
      workspaceId,
      phoneInstanceId: phoneId,
      providerChatId: "120363000000@g.us",
      channelType: "group",
      status: "active",
      awaitingResponseSince: new Date("2026-06-13T08:05:00.000Z"),
    },
    {
      workspaceId,
      phoneInstanceId: phoneId,
      providerChatId: "120363000001@g.us",
      channelType: "group",
      status: "unmapped",
    },
  ]);
  await db.insert(schema.channelMappings).values({
    workspaceId,
    channelId,
    clientId,
    mappingMode: "single_client",
    mappingEffectiveAt: new Date("2026-06-13T08:00:00.000Z"),
    status: "active",
  });
  await db.insert(schema.tickets).values([
    { workspaceId, channelId, clientId, title: "Open issue", status: "open" },
    {
      workspaceId,
      channelId,
      clientId,
      title: "Pending issue",
      status: "pending",
    },
  ]);
  await db.insert(schema.outboxMessages).values([
    {
      workspaceId,
      channelId,
      clientId,
      phoneInstanceId: phoneId,
      createdByUserId: userId,
      body: "failed reply",
      status: "failed",
      failureReason: "Gateway unavailable",
    },
    {
      workspaceId,
      channelId,
      clientId,
      phoneInstanceId: phoneId,
      createdByUserId: userId,
      body: "queued reply",
      status: "waiting_delay",
    },
  ]);
  await db.insert(schema.groupMetadataEvents).values({
    workspaceId,
    channelId,
    eventType: "subject_changed",
    newValue: "Production Escalations",
    reviewStatus: "pending",
  });

  return {
    user: { userId, workspaceId, role: "admin" } satisfies AuthUser,
  };
}

describe("OpsService.summary (integration)", () => {
  it("returns an admin operational read model", async () => {
    const { user } = await seedOpsFixture();
    const service = new OpsService(db, queueRegistry());

    const summary = await service.summary(user);

    expect(summary.phones.byStatus.connected).toBe(1);
    expect(summary.phones.byStatus.degraded).toBe(1);
    expect(summary.phones.items).toHaveLength(2);
    expect(summary.channels.unmapped).toBe(1);
    expect(summary.channels.awaitingResponse).toBe(1);
    expect(summary.tickets.open).toBe(1);
    expect(summary.tickets.pending).toBe(1);
    expect(summary.outbox.byStatus.failed).toBe(1);
    expect(summary.outbox.recentFailures[0]).toMatchObject({
      failureReason: "Gateway unavailable",
    });
    expect(summary.registry.pendingMetadataEvents).toBe(1);
    expect(summary.queues.outboxSend).toMatchObject({ failed: 2, delayed: 4 });
  });

  it("requires an admin user", async () => {
    const service = new OpsService(db, queueRegistry());
    await expect(
      service.summary({
        userId: randomUUID(),
        workspaceId: randomUUID(),
        role: "agent",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("exports Prometheus-style metrics for the operational summary", async () => {
    const { user } = await seedOpsFixture();
    const service = new OpsService(db, queueRegistry());

    const metrics = await service.metrics(user);

    expect(metrics).toContain('clariodesk_phone_status_count{workspace="');
    expect(metrics).toContain('status="connected"');
    expect(metrics).toContain("clariodesk_channel_unmapped_count");
    expect(metrics).toContain("clariodesk_queue_depth");
  });
});

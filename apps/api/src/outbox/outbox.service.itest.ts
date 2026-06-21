import { ForbiddenException } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@clariodesk/config";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { RealtimePublisher } from "@clariodesk/events";
import type { AuthUser } from "../common/auth-context.js";
import type { AuditService } from "../common/audit.service.js";
import type { QueueRegistry } from "../core/queues.js";
import type { ObjectStorage } from "@clariodesk/storage";
import { AccessService } from "../common/access.service.js";
import { OutboxService } from "./outbox.service.js";

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
  return {
    outboxSend: {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as QueueRegistry;
}

function makeService() {
  const realtime = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as RealtimePublisher;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const config = {
    SEND_DELAY_MS: 3000,
  } as AppConfig;
  const storage = {
    putMedia: vi.fn().mockResolvedValue(undefined),
  } as unknown as ObjectStorage;
  return {
    service: new OutboxService(
      db,
      storage,
      config,
      queueRegistry(),
      realtime,
      new AccessService(db),
      audit,
    ),
    realtime,
    audit,
  };
}

async function seedWorkspace() {
  const workspaceId = randomUUID();
  const adminId = randomUUID();
  const agentId = randomUUID();
  const phoneId = randomUUID();
  const clientId = randomUUID();
  const mappedChannelId = randomUUID();
  const unmappedChannelId = randomUUID();

  await db
    .insert(schema.workspaces)
    .values({ id: workspaceId, name: "Workspace", slug: `ws-${workspaceId}` });
  await db.insert(schema.users).values([
    { id: adminId, email: `${adminId}@example.com`, displayName: "Admin" },
    { id: agentId, email: `${agentId}@example.com`, displayName: "Agent" },
  ]);
  await db.insert(schema.phoneInstances).values({
    id: phoneId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Support Phone",
    providerInstanceId: `phone-${phoneId}`,
    status: "connected",
  });
  await db
    .insert(schema.clients)
    .values({ id: clientId, workspaceId, name: "Client A" });
  await db.insert(schema.channels).values([
    {
      id: mappedChannelId,
      workspaceId,
      phoneInstanceId: phoneId,
      providerChatId: "120363000000@g.us",
      channelType: "group",
      status: "active",
    },
    {
      id: unmappedChannelId,
      workspaceId,
      phoneInstanceId: phoneId,
      providerChatId: "120363000001@g.us",
      channelType: "group",
      status: "unmapped",
    },
  ]);
  await db.insert(schema.channelMappings).values({
    workspaceId,
    channelId: mappedChannelId,
    clientId,
    mappingMode: "single_client",
    mappingEffectiveAt: new Date(),
    status: "active",
  });

  return {
    workspaceId,
    adminId,
    agentId,
    phoneId,
    clientId,
    mappedChannelId,
    unmappedChannelId,
  };
}

function admin(workspaceId: string, userId: string): AuthUser {
  return { userId, workspaceId, role: "admin" };
}

function agent(workspaceId: string, userId: string): AuthUser {
  return { userId, workspaceId, role: "agent" };
}

describe("OutboxService failure paths (integration)", () => {
  it("queues a validated outbound attachment", async () => {
    const { workspaceId, adminId, mappedChannelId } = await seedWorkspace();
    const { service } = makeService();

    const result = await service.sendMedia(admin(workspaceId, adminId), {
      channelId: mappedChannelId,
      body: "Screenshot",
      fileName: "proof.png",
      mimeType: "image/png",
      mediaBase64: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).toString("base64"),
      idempotencyKey: randomUUID(),
    });

    expect(result.outboxId).toEqual(expect.any(String));
  });

  it("rejects an attachment whose bytes do not match its MIME type", async () => {
    const { workspaceId, adminId, mappedChannelId } = await seedWorkspace();
    const { service } = makeService();

    await expect(
      service.sendMedia(admin(workspaceId, adminId), {
        channelId: mappedChannelId,
        body: "Spoofed",
        fileName: "spoof.png",
        mimeType: "image/png",
        mediaBase64: Buffer.from("not-a-png").toString("base64"),
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow("does not match");
  });

  it("returns the existing outbox row for a repeated idempotency key", async () => {
    const { workspaceId, adminId, mappedChannelId } = await seedWorkspace();
    const { service } = makeService();
    const input = {
      channelId: mappedChannelId,
      body: "Reply once",
      useSendDelay: true,
      idempotencyKey: randomUUID(),
    };

    const first = await service.send(admin(workspaceId, adminId), input);
    const second = await service.send(admin(workspaceId, adminId), input);

    expect(second.outboxId).toBe(first.outboxId);
  });

  it("allows replies even when the channel is unmapped", async () => {
    const { workspaceId, adminId, unmappedChannelId } = await seedWorkspace();
    const { service } = makeService();

    await expect(
      service.send(admin(workspaceId, adminId), {
        channelId: unmappedChannelId,
        body: "Reply text",
        useSendDelay: true,
      }),
    ).resolves.toBeDefined();
  });

  it("rejects agents who do not have channel access", async () => {
    const { workspaceId, agentId, mappedChannelId } = await seedWorkspace();
    const { service } = makeService();

    await expect(
      service.send(agent(workspaceId, agentId), {
        channelId: mappedChannelId,
        body: "Reply text",
        useSendDelay: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

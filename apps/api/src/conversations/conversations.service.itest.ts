import { ForbiddenException } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { RealtimePublisher } from "@clariodesk/events";
import type { WhatsAppGatewayAdapter } from "@clariodesk/gateway-adapters";
import type { AuditService } from "../common/audit.service.js";
import type { AuthUser } from "../common/auth-context.js";
import type { AdapterFactory } from "../core/adapters.js";
import type { OutboxService } from "../outbox/outbox.service.js";
import { ConversationsService } from "./conversations.service.js";

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

async function seed() {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneInstanceId = randomUUID();
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
    id: phoneInstanceId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Support",
    providerInstanceId: `support-${phoneInstanceId}`,
    status: "connected",
  });
  return { workspaceId, userId, phoneInstanceId };
}

function makeService(adapter: Partial<WhatsAppGatewayAdapter>) {
  const adapters = {
    forPhone: vi.fn(() => adapter),
  } as unknown as AdapterFactory;
  const outbox = {
    send: vi.fn(async () => ({
      outboxId: randomUUID(),
      sendAfter: new Date().toISOString(),
      cancellableForMs: 0,
    })),
  } as unknown as OutboxService;
  const audit = {
    record: vi.fn(async () => undefined),
  } as unknown as AuditService;
  const realtime = {
    publish: vi.fn(async () => undefined),
  } as unknown as RealtimePublisher;
  return {
    service: new ConversationsService(db, adapters, outbox, audit, realtime),
    outbox,
    realtime,
  };
}

function user(
  workspaceId: string,
  userId: string,
  role: AuthUser["role"] = "admin",
): AuthUser {
  return { workspaceId, userId, role };
}

describe("ConversationsService (integration)", () => {
  it("creates a direct channel and queues the required first message", async () => {
    const seeded = await seed();
    const { service, outbox } = makeService({
      resolveNumber: vi.fn(async () => ({
        registered: true,
        providerContactId: "919876543210@c.us",
      })),
    });

    const result = await service.createDirect(
      user(seeded.workspaceId, seeded.userId),
      {
        phoneInstanceId: seeded.phoneInstanceId,
        phoneNumber: "+919876543210",
        initialMessage: "Hello",
        idempotencyKey: randomUUID(),
      },
    );

    expect(result.providerChatId).toBe("919876543210@c.us");
    expect(outbox.send).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: seeded.workspaceId }),
      expect.objectContaining({
        channelId: result.channelId,
        body: "Hello",
        useSendDelay: false,
      }),
    );
  });

  it("creates a real group after resolving every participant", async () => {
    const seeded = await seed();
    const createGroup = vi.fn(async () => ({
      providerChatId: "120363000000@g.us",
    }));
    const { service } = makeService({
      resolveNumber: vi.fn(async () => ({
        registered: true,
        providerContactId: "919876543210@c.us",
      })),
      createGroup,
    });

    const result = await service.createGroup(
      user(seeded.workspaceId, seeded.userId),
      {
        phoneInstanceId: seeded.phoneInstanceId,
        title: "Acme Support",
        participantPhoneNumbers: ["+919876543210"],
        initialMessage: "Welcome",
        idempotencyKey: randomUUID(),
      },
    );

    expect(result.providerChatId).toBe("120363000000@g.us");
    expect(createGroup).toHaveBeenCalledWith({
      providerInstanceId: expect.any(String),
      title: "Acme Support",
      participantIds: ["919876543210@c.us"],
    });
  });

  it("does not create a duplicate group for a repeated idempotency key", async () => {
    const seeded = await seed();
    const createGroup = vi.fn(async () => ({
      providerChatId: "120363000001@g.us",
    }));
    const { service } = makeService({
      resolveNumber: vi.fn(async () => ({
        registered: true,
        providerContactId: "919876543210@c.us",
      })),
      createGroup,
    });
    const input = {
      phoneInstanceId: seeded.phoneInstanceId,
      title: "Acme Support",
      participantPhoneNumbers: ["+919876543210"],
      initialMessage: "Welcome",
      idempotencyKey: randomUUID(),
    };

    const first = await service.createGroup(
      user(seeded.workspaceId, seeded.userId),
      input,
    );
    const second = await service.createGroup(
      user(seeded.workspaceId, seeded.userId),
      input,
    );

    expect(second).toEqual(first);
    expect(createGroup).toHaveBeenCalledTimes(1);
  });

  it("denies viewers before invoking the provider", async () => {
    const seeded = await seed();
    const resolveNumber = vi.fn();
    const { service } = makeService({ resolveNumber });

    await expect(
      service.createDirect(user(seeded.workspaceId, seeded.userId, "viewer"), {
        phoneInstanceId: seeded.phoneInstanceId,
        phoneNumber: "+919876543210",
        initialMessage: "Hello",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(resolveNumber).not.toHaveBeenCalled();
  });
});

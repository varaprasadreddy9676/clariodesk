import { NotFoundException } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { GatewayAdapterType, PhoneStatus } from "@clariodesk/types";
import type { AdapterFactory } from "../core/adapters.js";
import type { QueueRegistry } from "../core/queues.js";
import type { Logger } from "@clariodesk/logger";
import type { ObjectStorage } from "@clariodesk/storage";
import { WebhooksService } from "./webhooks.service.js";

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

function makeService(options?: {
  normalizeWebhook?: (input: {
    providerInstanceId: string;
    payload: unknown;
  }) => unknown[];
  putRawEvent?: (key: string, payload: unknown) => Promise<number>;
}) {
  const storage = {
    putRawEvent: options?.putRawEvent ?? vi.fn().mockResolvedValue(128),
  } as unknown as ObjectStorage;
  const queue = {
    add: vi.fn().mockResolvedValue(undefined),
  };
  const queues = {
    messageNormalization: queue,
  } as unknown as QueueRegistry;
  const adapter = {
    normalizeWebhook:
      options?.normalizeWebhook ??
      vi.fn(() => [
        {
          adapterType: "clario_gateway" as GatewayAdapterType,
          providerMessageId: "MSG1",
          providerChatId: "120363000000@g.us",
          channelType: "group",
          messageType: "text",
          direction: "inbound",
          providerTimestampMs: Date.now(),
          isHistorySync: false,
        },
      ]),
  };
  const adapters = {
    normalizer: vi.fn(() => adapter),
  } as unknown as AdapterFactory;
  const logger = {
    child: vi.fn(() => logger),
    error: vi.fn(),
  } as unknown as Logger;

  return {
    service: new WebhooksService(db, storage, queues, adapters, logger),
    queues,
    adapters,
    storage,
    logger,
  };
}

async function seedPhone(status: PhoneStatus = "connected") {
  const workspaceId = randomUUID();
  const phoneInstanceId = randomUUID();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.phoneInstances).values({
    id: phoneInstanceId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Support Phone",
    providerInstanceId: "phone-1",
    status,
  });
  return { workspaceId, phoneInstanceId };
}

describe("WebhooksService.ingest (integration)", () => {
  it("rejects unknown phone instances", async () => {
    const { service } = makeService();

    await expect(
      service.ingest("clario_gateway", randomUUID(), {
        event: "message.received",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("persists the raw event and enqueues normalization", async () => {
    const { phoneInstanceId } = await seedPhone("syncing");
    const { service, queues, adapters, storage } = makeService();

    await expect(
      service.ingest("clario_gateway", phoneInstanceId, {
        event: "message.received",
        message: {
          id: "MSG1",
          chatId: "120363000000@g.us",
          type: "chat",
          timestamp: 1781360000,
          fromMe: false,
        },
      }),
    ).resolves.toEqual({ accepted: 1 });

    expect(adapters.normalizer).toHaveBeenCalled();
    expect(storage.putRawEvent).toHaveBeenCalled();
    expect(queues.messageNormalization.add).toHaveBeenCalled();

    const [ref] = await db
      .select({
        phoneInstanceId: schema.rawEventRefs.phoneInstanceId,
        processingStatus: schema.rawEventRefs.processingStatus,
      })
      .from(schema.rawEventRefs)
      .where(eq(schema.rawEventRefs.phoneInstanceId, phoneInstanceId));
    expect(ref?.processingStatus).toBe("received");
  });

  it("resolves live gateway webhooks by provider session id", async () => {
    const { phoneInstanceId } = await seedPhone("connected");
    const { service, queues } = makeService();

    await expect(
      service.ingest("clario_gateway", "phone-1", {
        event: "message.received",
        message: {
          id: "LIVE1",
          chatId: "919900000000@c.us",
          type: "chat",
          timestamp: 1781360000,
          fromMe: false,
        },
      }),
    ).resolves.toEqual({ accepted: 1 });

    expect(queues.messageNormalization.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ phoneInstanceId }),
      expect.any(Object),
    );
  });
});

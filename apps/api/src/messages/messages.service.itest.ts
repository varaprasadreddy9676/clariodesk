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
import type {
  GatewayChatMessage,
  WhatsAppGatewayAdapter,
} from "@clariodesk/gateway-adapters";
import type { AuditService } from "../common/audit.service.js";
import type { AdapterFactory } from "../core/adapters.js";
import type { QueueRegistry } from "../core/queues.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { MessagesService } from "./messages.service.js";

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
    messageNormalization: { add: vi.fn().mockResolvedValue(undefined) },
  } as unknown as QueueRegistry;
}

function makeService(adapter: WhatsAppGatewayAdapter) {
  const realtime = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as RealtimePublisher;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const adapters = {
    forPhone: vi.fn(() => adapter),
  } as unknown as AdapterFactory;
  const config = { NODE_ENV: "development" } as AppConfig;
  return new MessagesService(
    db,
    config,
    realtime,
    adapters,
    queueRegistry(),
    new AccessService(db),
    audit,
  );
}

async function seedWorkspace() {
  const workspaceId = randomUUID();
  const phoneId = randomUUID();
  const channelId = randomUUID();
  await db
    .insert(schema.workspaces)
    .values({ id: workspaceId, name: "Workspace", slug: `ws-${workspaceId}` });
  await db.insert(schema.phoneInstances).values({
    id: phoneId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Phone",
    providerInstanceId: "phone-1",
    status: "connected",
  });
  await db.insert(schema.channels).values({
    id: channelId,
    workspaceId,
    phoneInstanceId: phoneId,
    providerChatId: "120363000000@g.us",
    channelType: "group",
    status: "active",
  });
  return { workspaceId, phoneId, channelId };
}

function admin(workspaceId: string): AuthUser {
  return { userId: randomUUID(), workspaceId, role: "admin" };
}

describe("MessagesService.syncMessages (integration)", () => {
  it("returns a soft failure when the gateway history sync fails", async () => {
    const { workspaceId, channelId } = await seedWorkspace();
    const adapter = {
      fetchMessages: vi.fn().mockRejectedValue(new Error("gateway offline")),
    } as unknown as WhatsAppGatewayAdapter;
    const service = makeService(adapter);

    await expect(
      service.syncMessages(admin(workspaceId), channelId, 50),
    ).resolves.toEqual({
      accepted: 0,
      reason: "gateway_message_sync_failed",
    });

    expect(adapter.fetchMessages).toHaveBeenCalledWith({
      providerInstanceId: "phone-1",
      providerChatId: "120363000000@g.us",
      limit: 50,
    });
  });

  it("enqueues backfill messages when history sync succeeds", async () => {
    const { workspaceId, channelId } = await seedWorkspace();
    const messages: GatewayChatMessage[] = [
      {
        providerMessageId: "m1",
        providerChatId: "120363000000@g.us",
        providerSenderId: "client@s.whatsapp.net",
        direction: "inbound",
        messageType: "image",
        body: "hello",
        providerTimestampMs: Date.now(),
        hasMedia: true,
        media: [
          {
            mediaType: "image",
            providerMediaId: "opaque-media-handle",
          },
        ],
      },
    ];
    const adapter = {
      fetchMessages: vi.fn().mockResolvedValue(messages),
    } as unknown as WhatsAppGatewayAdapter;
    const queueAdd = vi.fn().mockResolvedValue(undefined);
    const service = new MessagesService(
      db,
      { NODE_ENV: "development" } as AppConfig,
      {
        publish: vi.fn().mockResolvedValue(undefined),
      } as unknown as RealtimePublisher,
      { forPhone: vi.fn(() => adapter) } as unknown as AdapterFactory,
      { messageNormalization: { add: queueAdd } } as unknown as QueueRegistry,
      new AccessService(db),
      {
        record: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    await expect(
      service.syncMessages(admin(workspaceId), channelId, 50),
    ).resolves.toEqual({
      accepted: 1,
    });
    expect(queueAdd).toHaveBeenCalled();
    expect(queueAdd.mock.calls[0]?.[1].events[0]).toMatchObject({
      messageType: "image",
      media: [
        {
          mediaType: "image",
          providerMediaId: "opaque-media-handle",
        },
      ],
    });
  });
});

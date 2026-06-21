import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { createHash, randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { Logger } from "@clariodesk/logger";
import type { ObjectStorage } from "@clariodesk/storage";
import type { WhatsAppGatewayAdapter } from "@clariodesk/gateway-adapters";
import { makeMediaDownloadProcessor } from "./media-download.processor.js";
import type { WorkerDeps } from "../context.js";

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

function logger(): Logger {
  const l = {
    child: vi.fn(() => l),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
  return l as unknown as Logger;
}

function buildDeps(
  adapter: WhatsAppGatewayAdapter,
  storageOverrides?: Partial<ObjectStorage>,
) {
  const storage = {
    putMedia: vi.fn().mockResolvedValue(undefined),
    ...storageOverrides,
  } as unknown as ObjectStorage;
  const deps = {
    config: {} as never,
    logger: logger(),
    db,
    storage,
    realtime: {} as never,
    connection: {} as never,
    queues: {
      mediaDownloadLive: {} as never,
      mediaDownloadBackfill: {} as never,
    },
    getAdapterForPhone: vi.fn(() => adapter),
  } satisfies WorkerDeps;
  return { deps, storage };
}

async function seedRow(status: "pending" | "failed" | "expired" = "pending") {
  const workspaceId = randomUUID();
  const phoneInstanceId = randomUUID();
  const clientId = randomUUID();
  const channelId = randomUUID();
  const messageId = randomUUID();
  const mediaId = randomUUID();

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
    phoneInstanceId,
    providerChatId: "120363000000@g.us",
    channelType: "group",
    status: "unmapped",
  });
  await db.insert(schema.messages).values({
    id: messageId,
    workspaceId,
    channelId,
    clientId,
    phoneInstanceId,
    providerMessageId: "MSG-1",
    providerChatId: "120363000000@g.us",
    messageType: "image",
    direction: "inbound",
    providerTimestamp: new Date(),
  });
  await db.insert(schema.messageMedia).values({
    id: mediaId,
    workspaceId,
    messageId,
    clientId,
    channelId,
    mediaType: "image",
    storageStatus: status,
    providerMediaId: "MEDIA-1",
    providerMediaKey: "MEDIA-KEY",
    fileName: "receipt.png",
    mimeType: "image/png",
  });

  return { workspaceId, phoneInstanceId, channelId, messageId, mediaId };
}

describe("media download processor (integration)", () => {
  it("downloads media and marks the row downloaded", async () => {
    const seeded = await seedRow();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const adapter = {
      downloadMedia: vi
        .fn()
        .mockResolvedValue({ bytes, mimeType: "image/png" }),
    } as unknown as WhatsAppGatewayAdapter;
    const { deps, storage } = buildDeps(adapter);
    const processor = makeMediaDownloadProcessor(deps);

    await processor({
      id: "job-1",
      data: {
        workspaceId: seeded.workspaceId,
        messageId: seeded.messageId,
        mediaId: seeded.mediaId,
        phoneInstanceId: seeded.phoneInstanceId,
        providerMediaId: "MEDIA-1",
        providerMediaKey: "MEDIA-KEY",
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as Job);

    expect(adapter.downloadMedia).toHaveBeenCalledWith({
      providerInstanceId: "phone-1",
      providerMediaId: "MEDIA-1",
      providerMediaKey: "MEDIA-KEY",
    });
    expect(storage.putMedia).toHaveBeenCalledTimes(1);

    const [row] = await db
      .select({
        storageKey: schema.messageMedia.storageKey,
        storageStatus: schema.messageMedia.storageStatus,
        sizeBytes: schema.messageMedia.sizeBytes,
        sha256Hash: schema.messageMedia.sha256Hash,
      })
      .from(schema.messageMedia)
      .where(eq(schema.messageMedia.id, seeded.mediaId));

    expect(row?.storageStatus).toBe("downloaded");
    expect(row?.sizeBytes).toBe(4);
    expect(row?.sha256Hash).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(row?.storageKey).toBeDefined();
    expect(row?.storageKey).toContain(seeded.workspaceId);
  });

  it("marks a final-attempt failure as expired", async () => {
    const seeded = await seedRow();
    const adapter = {
      downloadMedia: vi.fn().mockRejectedValue(new Error("expired")),
    } as unknown as WhatsAppGatewayAdapter;
    const { deps } = buildDeps(adapter);
    const processor = makeMediaDownloadProcessor(deps);

    await processor({
      id: "job-2",
      data: {
        workspaceId: seeded.workspaceId,
        messageId: seeded.messageId,
        mediaId: seeded.mediaId,
        phoneInstanceId: seeded.phoneInstanceId,
        providerMediaId: "MEDIA-1",
        providerMediaKey: "MEDIA-KEY",
      },
      attemptsMade: 0,
      opts: { attempts: 1 },
    } as Job);

    const [row] = await db
      .select({
        storageStatus: schema.messageMedia.storageStatus,
        storageKey: schema.messageMedia.storageKey,
      })
      .from(schema.messageMedia)
      .where(eq(schema.messageMedia.id, seeded.mediaId));
    expect(row?.storageStatus).toBe("expired");
    expect(row?.storageKey).toBeNull();
  });

  it("rethrows retryable failures and leaves the row failed", async () => {
    const seeded = await seedRow();
    const adapter = {
      downloadMedia: vi.fn().mockRejectedValue(new Error("temporary")),
    } as unknown as WhatsAppGatewayAdapter;
    const { deps } = buildDeps(adapter);
    const processor = makeMediaDownloadProcessor(deps);

    await expect(
      processor({
        id: "job-3",
        data: {
          workspaceId: seeded.workspaceId,
          messageId: seeded.messageId,
          mediaId: seeded.mediaId,
          phoneInstanceId: seeded.phoneInstanceId,
          providerMediaId: "MEDIA-1",
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as Job),
    ).rejects.toThrow("temporary");

    const [row] = await db
      .select({
        storageStatus: schema.messageMedia.storageStatus,
      })
      .from(schema.messageMedia)
      .where(eq(schema.messageMedia.id, seeded.mediaId));
    expect(row?.storageStatus).toBe("failed");
  });
});

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import { encryptSecret } from "@clariodesk/crypto";
import type { AppConfig } from "@clariodesk/config";
import type { AccessService } from "../common/access.service.js";
import { AiDraftReplyService } from "./ai-draft-reply.service.js";
import * as completion from "./ai-completion.js";

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const config = { ENCRYPTION_KEY } as unknown as AppConfig;

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiDraftReplyService.draftReply", () => {
  it("rejects a caller without access to the channel", async () => {
    const fixture = await createFixture();
    const access = {
      assertChannelAccess: vi.fn().mockRejectedValue(new Error("Forbidden")),
    } as unknown as AccessService;
    const service = new AiDraftReplyService(db, config, access);

    await expect(
      service.draftReply(fixture.user, fixture.channelId),
    ).rejects.toThrow("Forbidden");
  });

  it("fails clearly when no active AI connection exists", async () => {
    const fixture = await createFixture();
    const access = {
      assertChannelAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccessService;
    const service = new AiDraftReplyService(db, config, access);

    await expect(
      service.draftReply(fixture.user, fixture.channelId),
    ).rejects.toThrow("No active AI connection configured");
  });

  it("fails clearly when the channel has no message history", async () => {
    const fixture = await createFixture();
    await insertConnection(fixture.workspaceId);
    const access = {
      assertChannelAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccessService;
    const service = new AiDraftReplyService(db, config, access);

    await expect(
      service.draftReply(fixture.user, fixture.channelId),
    ).rejects.toThrow("no conversation history");
  });

  it("builds the completion call from recent messages and returns the draft", async () => {
    const fixture = await createFixture();
    const connection = await insertConnection(fixture.workspaceId);
    await db.insert(schema.messages).values([
      {
        workspaceId: fixture.workspaceId,
        channelId: fixture.channelId,
        phoneInstanceId: fixture.phoneInstanceId,
        providerMessageId: "m1",
        providerChatId: "chat@c.us",
        messageType: "text",
        direction: "inbound",
        body: "Where is my order?",
        providerTimestamp: new Date("2026-06-21T08:00:00.000Z"),
      },
      {
        workspaceId: fixture.workspaceId,
        channelId: fixture.channelId,
        phoneInstanceId: fixture.phoneInstanceId,
        providerMessageId: "m2",
        providerChatId: "chat@c.us",
        messageType: "text",
        direction: "outbound",
        body: "Let me check that for you.",
        providerTimestamp: new Date("2026-06-21T08:01:00.000Z"),
      },
    ]);
    const access = {
      assertChannelAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccessService;
    const spy = vi
      .spyOn(completion, "generateCompletion")
      .mockResolvedValue({ ok: true, text: "It ships tomorrow." });
    const service = new AiDraftReplyService(db, config, access);

    const result = await service.draftReply(fixture.user, fixture.channelId);

    expect(result).toEqual({ draft: "It ships tomorrow." });
    expect(spy).toHaveBeenCalledWith(
      connection.provider,
      connection.apiKey,
      connection.baseUrl,
      connection.model,
      expect.stringContaining("support agent"),
      [
        { role: "user", content: "Where is my order?" },
        { role: "assistant", content: "Let me check that for you." },
      ],
    );
  });

  it("surfaces the provider's friendly error instead of failing silently", async () => {
    const fixture = await createFixture();
    await insertConnection(fixture.workspaceId);
    await db.insert(schema.messages).values({
      workspaceId: fixture.workspaceId,
      channelId: fixture.channelId,
      phoneInstanceId: fixture.phoneInstanceId,
      providerMessageId: "m1",
      providerChatId: "chat@c.us",
      messageType: "text",
      direction: "inbound",
      body: "Hi",
      providerTimestamp: new Date(),
    });
    const access = {
      assertChannelAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccessService;
    vi.spyOn(completion, "generateCompletion").mockResolvedValue({
      ok: false,
      error: "Could not reach the provider",
    });
    const service = new AiDraftReplyService(db, config, access);

    await expect(
      service.draftReply(fixture.user, fixture.channelId),
    ).rejects.toThrow("Could not reach the provider");
  });
});

async function insertConnection(workspaceId: string) {
  const apiKey = "sk-test-secret";
  const [row] = await db
    .insert(schema.aiProviderConnections)
    .values({
      workspaceId,
      provider: "openai",
      label: "Primary",
      encryptedApiKey: encryptSecret(apiKey, ENCRYPTION_KEY),
      status: "active",
    })
    .returning();
  if (!row) throw new Error("failed to insert connection");
  return { ...row, apiKey };
}

async function createFixture() {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneInstanceId = randomUUID();
  const channelId = randomUUID();

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
    user: { userId, workspaceId, role: "agent" as const },
    workspaceId,
    phoneInstanceId,
    channelId,
  };
}

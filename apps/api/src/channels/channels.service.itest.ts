import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { RealtimePublisher } from "@clariodesk/events";
import type { AccessService } from "../common/access.service.js";
import type { AuditService } from "../common/audit.service.js";
import type { AdapterFactory } from "../core/adapters.js";
import type { MessagesService } from "../messages/messages.service.js";
import { ChannelsService } from "./channels.service.js";

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

describe("ChannelsService.list", () => {
  it("returns the latest message body and type for inbox previews", async () => {
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
      providerChatId: "919876543210@c.us",
      channelType: "direct",
      title: "+919876543210",
      status: "active",
      lastMessageAt: new Date("2026-06-21T09:00:00.000Z"),
    });
    await db.insert(schema.channels).values({
      workspaceId,
      phoneInstanceId,
      providerChatId: "919999999999@c.us",
      channelType: "direct",
      title: "No messages",
      status: "active",
    });
    await db.insert(schema.channels).values({
      workspaceId,
      phoneInstanceId,
      providerChatId: "status@broadcast",
      channelType: "direct",
      title: null,
      status: "archived",
    });
    await db.insert(schema.messages).values([
      {
        workspaceId,
        channelId,
        phoneInstanceId,
        providerMessageId: "older",
        providerChatId: "919876543210@c.us",
        messageType: "text",
        direction: "inbound",
        body: "Older message",
        providerTimestamp: new Date("2026-06-21T08:00:00.000Z"),
      },
      {
        workspaceId,
        channelId,
        phoneInstanceId,
        providerMessageId: "latest",
        providerChatId: "919876543210@c.us",
        messageType: "text",
        direction: "outbound",
        body: "Latest message",
        providerTimestamp: new Date("2026-06-21T09:00:00.000Z"),
      },
    ]);
    const access = {
      accessibleChannelIds: vi.fn().mockResolvedValue("all"),
    } as unknown as AccessService;
    const service = makeService({ access }).service;

    const result = await service.list({ userId, workspaceId, role: "admin" });

    expect(result[0]).toMatchObject({
      id: channelId,
      lastMessage: "Latest message",
      lastMessageType: "text",
    });
    expect(result).toHaveLength(2);
  });
});

describe("ChannelsService synchronized actions", () => {
  it("leaves local state unchanged when WhatsApp rejects an action", async () => {
    const fixture = await createChannelFixture();
    const adapter = {
      setChatState: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };
    const { service } = makeService({ adapter });

    await expect(
      service.applyAction(fixture.admin, fixture.channelId, {
        action: "pin",
        pinned: true,
      }),
    ).rejects.toThrow("provider unavailable");

    const [unchanged] = await db
      .select({ isPinned: schema.channels.isPinned })
      .from(schema.channels)
      .where(eq(schema.channels.id, fixture.channelId));
    expect(unchanged?.isPinned).toBe(false);
  });

  it("rejects provider mutations from viewers", async () => {
    const fixture = await createChannelFixture();
    const { service, adapter } = makeService();

    await expect(
      service.applyAction(
        { ...fixture.admin, role: "viewer" },
        fixture.channelId,
        { action: "mute", muted: true },
      ),
    ).rejects.toThrow("Viewers cannot change WhatsApp chat state");
    expect(adapter.setChatState).not.toHaveBeenCalled();
  });

  it("persists confirmed unread state per user and lets a viewer clear it", async () => {
    const fixture = await createChannelFixture();
    const { service } = makeService();
    await service.applyAction(fixture.admin, fixture.channelId, {
      action: "mark_unread",
      markedUnread: true,
    });

    const [marked] = await db
      .select({ isMarkedUnread: schema.userChannelReadState.isMarkedUnread })
      .from(schema.userChannelReadState)
      .where(eq(schema.userChannelReadState.userId, fixture.admin.userId));
    expect(marked?.isMarkedUnread).toBe(true);

    await service.updateReadState(
      { ...fixture.admin, role: "viewer" },
      fixture.channelId,
      { markedUnread: false },
    );
    const [cleared] = await db
      .select({ isMarkedUnread: schema.userChannelReadState.isMarkedUnread })
      .from(schema.userChannelReadState)
      .where(eq(schema.userChannelReadState.userId, fixture.admin.userId));
    expect(cleared?.isMarkedUnread).toBe(false);
  });

  it("separates archived chats and orders pinned chats deterministically", async () => {
    const fixture = await createChannelFixture({
      title: "Recent",
      lastMessageAt: new Date("2026-06-21T10:00:00.000Z"),
    });
    const pinnedId = randomUUID();
    const archivedId = randomUUID();
    await db.insert(schema.channels).values([
      {
        id: pinnedId,
        workspaceId: fixture.admin.workspaceId,
        phoneInstanceId: fixture.phoneInstanceId,
        providerChatId: "pinned@c.us",
        channelType: "direct",
        title: "Pinned older",
        status: "active",
        isPinned: true,
        lastMessageAt: new Date("2026-06-20T10:00:00.000Z"),
      },
      {
        id: archivedId,
        workspaceId: fixture.admin.workspaceId,
        phoneInstanceId: fixture.phoneInstanceId,
        providerChatId: "archived@c.us",
        channelType: "direct",
        title: "Archived",
        status: "archived",
      },
    ]);
    const { service } = makeService();

    const inbox = await service.list(fixture.admin);
    const archived = await service.list(fixture.admin, "archived");

    expect(inbox.map((channel) => channel.id)).toEqual([
      pinnedId,
      fixture.channelId,
    ]);
    expect(archived.map((channel) => channel.id)).toEqual([archivedId]);
  });

  it("refreshes one chat and its latest messages", async () => {
    const fixture = await createChannelFixture({ title: "Old title" });
    const { service, adapter, messages, realtime } = makeService();
    adapter.fetchChat.mockResolvedValue({
      providerChatId: fixture.providerChatId,
      title: "Confirmed title",
      channelType: "direct",
      avatarUrl: "https://example.test/avatar.jpg",
      isPinned: true,
      isMuted: false,
      isArchived: false,
    });
    messages.syncMessages.mockResolvedValue({ accepted: 8 });

    await expect(
      service.refreshChannel(fixture.admin, fixture.channelId),
    ).resolves.toEqual({ acceptedMessages: 8, metadataChanged: true });
    expect(messages.syncMessages).toHaveBeenCalledWith(
      fixture.admin,
      fixture.channelId,
      50,
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "channel.updated",
        channelId: fixture.channelId,
      }),
    );
  });
});

function makeService(input: {
  access?: AccessService;
  adapter?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const access =
    input.access ??
    ({
      accessibleChannelIds: vi.fn().mockResolvedValue("all"),
      assertChannelAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccessService);
  const adapter = {
    setChatState: vi.fn().mockResolvedValue({}),
    fetchChat: vi.fn(),
    ...input.adapter,
  };
  const adapters = {
    forPhone: vi.fn(() => adapter),
  } as unknown as AdapterFactory;
  const realtime = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as RealtimePublisher & { publish: ReturnType<typeof vi.fn> };
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const messages = {
    syncMessages: vi.fn(),
  } as unknown as MessagesService & {
    syncMessages: ReturnType<typeof vi.fn>;
  };
  return {
    service: new ChannelsService(
      db,
      adapters,
      realtime,
      access,
      audit,
      messages,
    ),
    adapter,
    realtime,
    messages,
  };
}

async function createChannelFixture(input: {
  title?: string;
  lastMessageAt?: Date;
} = {}) {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const phoneInstanceId = randomUUID();
  const channelId = randomUUID();
  const providerChatId = `${randomUUID()}@c.us`;
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
    providerInstanceId: `phone-${randomUUID()}`,
    displayName: "WhatsApp",
    status: "connected",
  });
  await db.insert(schema.channels).values({
    id: channelId,
    workspaceId,
    phoneInstanceId,
    providerChatId,
    channelType: "direct",
    title: input.title ?? "Client",
    status: "active",
    lastMessageAt: input.lastMessageAt,
  });
  return {
    admin: { userId, workspaceId, role: "admin" as const },
    phoneInstanceId,
    channelId,
    providerChatId,
  };
}

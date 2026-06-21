import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@clariodesk/config";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type {
  GatewayCapabilities,
  GatewayChat,
  GatewayChatMessage,
  WhatsAppGatewayAdapter,
} from "@clariodesk/gateway-adapters";
import type { AuthUser } from "../common/auth-context.js";
import type { AuditService } from "../common/audit.service.js";
import type { AdapterFactory } from "../core/adapters.js";
import type { QueueRegistry } from "../core/queues.js";
import { PhonesService } from "./phones.service.js";

let container: StartedPostgreSqlContainer;
let db: Database;

const DEFAULT_CAPABILITIES: GatewayCapabilities = {
  supportsGroups: true,
  supportsQuotedReply: true,
  supportsReactions: true,
  supportsTypingEvents: true,
  supportsReadReceipts: true,
  supportsParticipantEvents: true,
  supportsHistorySync: true,
  supportsMediaDownload: true,
  supportsMessageDeleteEvents: true,
  supportsOfficialTemplates: false,
};

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

function user(workspaceId: string, role: AuthUser["role"] = "admin"): AuthUser {
  return { userId: randomUUID(), workspaceId, role };
}

async function seedPhone() {
  const workspaceId = randomUUID();
  const phoneId = randomUUID();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.phoneInstances).values({
    id: phoneId,
    workspaceId,
    adapterType: "clario_gateway",
    displayName: "Support Phone",
    providerInstanceId: `support-${phoneId}`,
    status: "connected",
  });
  return { workspaceId, phoneId };
}

function fakeAdapter(
  chats: Array<Partial<GatewayChat> & Pick<GatewayChat, "providerChatId">>,
  capabilities: Partial<GatewayCapabilities> = {},
): WhatsAppGatewayAdapter {
  const normalizedChats = chats.map((chat) => ({
    title: chat.title ?? null,
    avatarUrl: chat.avatarUrl ?? null,
    channelType: chat.channelType ?? "group",
    participantCount: chat.participantCount,
    providerChatId: chat.providerChatId,
  }));
  return {
    getAdapterType: () => "clario_gateway",
    getCapabilities: () => ({ ...DEFAULT_CAPABILITIES, ...capabilities }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getConnectionStatus: vi.fn(),
    fetchChats: vi.fn().mockResolvedValue(normalizedChats),
    sendText: vi.fn(),
    sendMedia: vi.fn(),
    downloadMedia: vi.fn(),
    normalizeWebhook: vi.fn(() => []),
  };
}

function makeService(adapter: WhatsAppGatewayAdapter) {
  const adapters = {
    forPhone: vi.fn(() => adapter),
  } as unknown as AdapterFactory;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const config = {
    ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
  } as AppConfig;
  const queues = {
    messageNormalization: { add: vi.fn().mockResolvedValue(undefined) },
  } as unknown as QueueRegistry;
  return {
    service: new PhonesService(db, config, adapters, queues, audit),
    adapters,
    audit,
  };
}

describe("PhonesService.syncGroups (integration)", () => {
  it("keeps the phone syncing until recent history has been fetched", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    let finishHistory!: (messages: GatewayChatMessage[]) => void;
    const history = new Promise<GatewayChatMessage[]>((resolve) => {
      finishHistory = resolve;
    });
    const adapter = fakeAdapter([
      {
        providerChatId: "120363000000@g.us",
        title: "Client Support",
        channelType: "group",
      },
    ]);
    adapter.fetchMessages = vi.fn().mockReturnValue(history);
    const { service } = makeService(adapter);

    await service.syncGroups(user(workspaceId), phoneId);

    const [duringSync] = await db
      .select({
        status: schema.phoneInstances.status,
        lastSyncAt: schema.phoneInstances.lastSyncAt,
      })
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, phoneId));
    expect(duringSync).toEqual({ status: "syncing", lastSyncAt: null });

    finishHistory([]);
    await vi.waitFor(async () => {
      const [completed] = await db
        .select({
          status: schema.phoneInstances.status,
          lastSyncAt: schema.phoneInstances.lastSyncAt,
        })
        .from(schema.phoneInstances)
        .where(eq(schema.phoneInstances.id, phoneId));
      expect(completed?.status).toBe("connected");
      expect(completed?.lastSyncAt).toBeInstanceOf(Date);
    });
  });

  it("uses the phone number when a direct chat has no contact name", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const adapter = fakeAdapter([
      {
        providerChatId: "919876543210@c.us",
        title: null,
        channelType: "direct",
        avatarUrl: "https://example.test/avatar.jpg",
      },
    ]);
    const { service } = makeService(adapter);

    await service.syncGroups(user(workspaceId), phoneId);

    const [channel] = await db
      .select({
        title: schema.channels.title,
        avatarUrl: schema.channels.avatarUrl,
      })
      .from(schema.channels)
      .where(eq(schema.channels.phoneInstanceId, phoneId));
    expect(channel).toEqual({
      title: "+919876543210",
      avatarUrl: "https://example.test/avatar.jpg",
    });
  });

  it("syncs gateway groups into unmapped channels and stamps the phone", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const adapter = fakeAdapter([
      {
        providerChatId: "120363000000@g.us",
        title: "Client A Support",
        participantCount: 14,
      },
      { providerChatId: "120363000001@g.us", title: "Client B Implementation" },
    ]);
    const { service, audit } = makeService(adapter);

    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).resolves.toEqual({
      total: 2,
      created: 2,
      updated: 0,
      archived: 0,
    });

    expect(adapter.fetchChats).toHaveBeenCalledWith({
      providerInstanceId: expect.any(String),
    });

    const channels = await db
      .select({
        providerChatId: schema.channels.providerChatId,
        title: schema.channels.title,
        subject: schema.channels.subject,
        status: schema.channels.status,
        channelType: schema.channels.channelType,
      })
      .from(schema.channels)
      .where(eq(schema.channels.phoneInstanceId, phoneId));
    expect(channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerChatId: "120363000000@g.us",
          title: "Client A Support",
          subject: "Client A Support",
          status: "unmapped",
          channelType: "group",
        }),
        expect.objectContaining({
          providerChatId: "120363000001@g.us",
          title: "Client B Implementation",
          subject: "Client B Implementation",
          status: "unmapped",
          channelType: "group",
        }),
      ]),
    );

    const [phone] = await db
      .select({
        lastSeenAt: schema.phoneInstances.lastSeenAt,
        lastSyncAt: schema.phoneInstances.lastSyncAt,
      })
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, phoneId));
    expect(phone?.lastSeenAt).toBeInstanceOf(Date);
    expect(phone?.lastSyncAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        action: "phone.groups_synced",
        targetType: "phone_instance",
        targetId: phoneId,
        metadata: { total: 2, created: 2, updated: 0, archived: 0 },
      }),
    );
  });

  it("syncs direct chats as active channels alongside groups", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const adapter = fakeAdapter([
      {
        providerChatId: "120363000000@g.us",
        title: "Client A Support",
        channelType: "group",
      },
      {
        providerChatId: "919911223344@c.us",
        title: "Client Owner",
        channelType: "direct",
      },
    ]);
    const { service } = makeService(adapter);

    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).resolves.toEqual({
      total: 2,
      created: 2,
      updated: 0,
      archived: 0,
    });

    const channels = await db
      .select({
        providerChatId: schema.channels.providerChatId,
        channelType: schema.channels.channelType,
        status: schema.channels.status,
      })
      .from(schema.channels)
      .where(eq(schema.channels.phoneInstanceId, phoneId));
    expect(channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerChatId: "120363000000@g.us",
          channelType: "group",
          status: "unmapped",
        }),
        expect.objectContaining({
          providerChatId: "919911223344@c.us",
          channelType: "direct",
          status: "active",
        }),
      ]),
    );
  });

  it("archives channels that disappear from the latest gateway snapshot", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    await db.insert(schema.channels).values([
      {
        workspaceId,
        phoneInstanceId: phoneId,
        providerChatId: "120363000000@g.us",
        channelType: "group",
        title: "Live Support",
        subject: "Live Support",
        status: "active",
      },
      {
        workspaceId,
        phoneInstanceId: phoneId,
        providerChatId: "120363000001@g.us",
        channelType: "group",
        title: "Old Support",
        subject: "Old Support",
        status: "unmapped",
      },
    ]);

    const adapter = fakeAdapter([
      { providerChatId: "120363000000@g.us", title: "Live Support" },
    ]);
    const { service } = makeService(adapter);

    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).resolves.toEqual({
      total: 1,
      created: 0,
      updated: 1,
      archived: 1,
    });

    const [stale] = await db
      .select({ status: schema.channels.status })
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.workspaceId, workspaceId),
          eq(schema.channels.phoneInstanceId, phoneId),
          eq(schema.channels.providerChatId, "120363000001@g.us"),
        ),
      );

    expect(stale?.status).toBe("archived");
  });

  it("updates existing group metadata without resetting an active mapping", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const [client] = await db
      .insert(schema.clients)
      .values({ workspaceId, name: "Client A" })
      .returning({ id: schema.clients.id });
    const [channel] = await db
      .insert(schema.channels)
      .values({
        workspaceId,
        phoneInstanceId: phoneId,
        providerChatId: "120363000000@g.us",
        channelType: "group",
        title: "Old Support Group",
        subject: "Old Support Group",
        status: "active",
      })
      .returning({ id: schema.channels.id });
    await db.insert(schema.channelMappings).values({
      workspaceId,
      channelId: channel!.id,
      clientId: client!.id,
      mappingMode: "single_client",
      mappingEffectiveAt: new Date(),
      status: "active",
    });

    const adapter = fakeAdapter([
      { providerChatId: "120363000000@g.us", title: "Renamed Support Group" },
    ]);
    const { service } = makeService(adapter);

    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).resolves.toEqual({
      total: 1,
      created: 0,
      updated: 1,
      archived: 0,
    });

    const [synced] = await db
      .select({
        id: schema.channels.id,
        title: schema.channels.title,
        subject: schema.channels.subject,
        status: schema.channels.status,
      })
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.workspaceId, workspaceId),
          eq(schema.channels.phoneInstanceId, phoneId),
          eq(schema.channels.providerChatId, "120363000000@g.us"),
        ),
      );
    expect(synced).toMatchObject({
      id: channel!.id,
      title: "Renamed Support Group",
      subject: "Renamed Support Group",
      status: "active",
    });

    const mappings = await db
      .select()
      .from(schema.channelMappings)
      .where(eq(schema.channelMappings.channelId, channel!.id));
    expect(mappings).toHaveLength(1);
    expect(mappings[0]?.status).toBe("active");
  });

  it("requires an admin user", async () => {
    const adapter = fakeAdapter([]);
    const { service } = makeService(adapter);
    await expect(
      service.syncGroups(user(randomUUID(), "agent"), randomUUID()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adapter.fetchChats).not.toHaveBeenCalled();
  });

  it("rejects gateways without chat sync support", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const adapter = fakeAdapter([]);
    adapter.fetchChats = undefined;
    adapter.fetchGroups = undefined;
    const { service } = makeService(adapter);
    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("surfaces gateway failures during group sync without mutating local state", async () => {
    const { workspaceId, phoneId } = await seedPhone();
    const adapter = fakeAdapter([]);
    adapter.fetchChats = vi
      .fn()
      .mockRejectedValue(new Error("Gateway unavailable"));
    const { service } = makeService(adapter);

    await expect(
      service.syncGroups(user(workspaceId), phoneId),
    ).rejects.toThrow("Gateway unavailable");

    const [phone] = await db
      .select({
        lastSyncAt: schema.phoneInstances.lastSyncAt,
        lastSeenAt: schema.phoneInstances.lastSeenAt,
      })
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, phoneId));
    expect(phone?.lastSyncAt).toBeNull();
    expect(phone?.lastSeenAt).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq } from "drizzle-orm";
import { getDb, closeDb, schema, type Database } from "@clariodesk/db";
import type { NormalizedGatewayEvent } from "@clariodesk/types";
import { DrizzleNormalizationStore } from "./drizzle-store.js";
import { normalizeEvent, type NormalizeContext } from "./normalize.js";

/**
 * Integration test: the real {@link DrizzleNormalizationStore} against a real
 * Postgres (Testcontainers). Proves the safety rules hold through actual SQL —
 * idempotency, echo merge, and the backfill/live boundary — not just the fake.
 */
let container: StartedPostgreSqlContainer;
let db: Database;
let store: DrizzleNormalizationStore;

const WS = "00000000-0000-0000-0000-0000000000a1";
const PHONE = "00000000-0000-0000-0000-0000000000b1";
const CLIENT = "00000000-0000-0000-0000-0000000000c1";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });

  await db
    .insert(schema.workspaces)
    .values({ id: WS, name: "WS", slug: "ws-itest" });
  await db.insert(schema.phoneInstances).values({
    id: PHONE,
    workspaceId: WS,
    adapterType: "clario_gateway",
    displayName: "Phone",
    providerInstanceId: "itest",
    status: "connected",
  });
  await db
    .insert(schema.clients)
    .values({ id: CLIENT, workspaceId: WS, name: "Acme" });
  store = new DrizzleNormalizationStore(db);
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

const NOW = Date.now();

function ctx(over: Partial<NormalizeContext> = {}): NormalizeContext {
  return {
    workspaceId: WS,
    phoneInstanceId: PHONE,
    rawEventRefId: null,
    phoneOwnerProviderId: null,
    phoneRestricted: false,
    isReconnectSync: false,
    staleSyncThresholdSeconds: 900,
    nowMs: NOW,
    ...over,
  };
}

function evt(
  over: Partial<NormalizedGatewayEvent> = {},
): NormalizedGatewayEvent {
  return {
    adapterType: "clario_gateway",
    providerMessageId: "M-" + Math.random().toString(36).slice(2),
    providerChatId: "900@g.us",
    providerSenderId: "client@s.whatsapp.net",
    channelType: "group",
    messageType: "text",
    direction: "inbound",
    senderDisplayName: "Client Ravi",
    body: "hello",
    providerTimestampMs: NOW,
    isHistorySync: false,
    ...over,
  };
}

describe("DrizzleNormalizationStore (integration)", () => {
  it("auto-creates an unmapped channel and stores the message", async () => {
    const out = await normalizeEvent(
      evt({ providerMessageId: "M1" }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    const channels = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.providerChatId, "900@g.us"));
    expect(channels).toHaveLength(1);
    expect(channels[0]?.status).toBe("unmapped");
  });

  it("auto-creates a contact + identity + channel membership for the sender", async () => {
    const out = await normalizeEvent(
      evt({
        providerMessageId: "C1",
        providerSenderId: "919111@s.whatsapp.net",
      }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    const contact = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.primaryPhone, "919111"));
    expect(contact).toHaveLength(1);
    expect(contact[0]?.canonicalName).toBe("Client Ravi");

    const identity = await db
      .select()
      .from(schema.contactIdentities)
      .where(
        eq(schema.contactIdentities.providerUserId, "919111@s.whatsapp.net"),
      );
    expect(identity).toHaveLength(1);

    const members = await db
      .select()
      .from(schema.channelMemberships)
      .where(eq(schema.channelMemberships.contactId, contact[0]!.id));
    expect(members).toHaveLength(1);
    expect(members[0]?.displayNameInChannel).toBe("Client Ravi");

    // The stored message links to the resolved contact.
    const msg = await db
      .select({ senderContactId: schema.messages.senderContactId })
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "C1"));
    expect(msg[0]?.senderContactId).toBe(contact[0]!.id);
  });

  it("dedupes a repeated provider_message_id via the unique index", async () => {
    await normalizeEvent(evt({ providerMessageId: "DUP" }), ctx(), store);
    const second = await normalizeEvent(
      evt({ providerMessageId: "DUP" }),
      ctx(),
      store,
    );
    expect(second.kind).toBe("duplicate");
    const rows = await db
      .select()
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, WS),
          eq(schema.messages.providerMessageId, "DUP"),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("merges an outbound echo into its outbox row (no duplicate)", async () => {
    const channelRows = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.providerChatId, "900@g.us"));
    const channelId = channelRows[0]!.id;
    const [outbox] = await db
      .insert(schema.outboxMessages)
      .values({
        workspaceId: WS,
        channelId,
        phoneInstanceId: PHONE,
        body: "reply",
        status: "sent",
        providerMessageId: "ECHO1",
      })
      .returning({ id: schema.outboxMessages.id });

    const out = await normalizeEvent(
      evt({ providerMessageId: "ECHO1", direction: "outbound", body: "reply" }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    if (out.kind === "stored") expect(out.isGhostAgent).toBe(false);
    const msg = await db
      .select({ sentByType: schema.messages.sentByType })
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "ECHO1"));
    expect(msg[0]?.sentByType).toBe("dashboard_agent");
    expect(outbox).toBeDefined();
  });

  it("applies the mapping boundary: backfill vs live, with real SQL", async () => {
    // Map the channel to a client, effective now.
    const channelRows = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.providerChatId, "900@g.us"));
    const channelId = channelRows[0]!.id;
    const effectiveAt = new Date(NOW);
    await db.insert(schema.channelMappings).values({
      workspaceId: WS,
      channelId,
      clientId: CLIENT,
      mappingMode: "single_client",
      mappingEffectiveAt: effectiveAt,
      status: "active",
    });

    const old = await normalizeEvent(
      evt({ providerMessageId: "OLD", providerTimestampMs: NOW - 3_600_000 }),
      ctx(),
      store,
    );
    const live = await normalizeEvent(
      evt({ providerMessageId: "LIVE", providerTimestampMs: NOW + 60_000 }),
      ctx(),
      store,
    );

    expect(old.kind === "stored" && old.classification.isBackfill).toBe(true);
    expect(live.kind === "stored" && live.classification.slaEligible).toBe(
      true,
    );

    const liveRow = await db
      .select({
        slaEligible: schema.messages.slaEligible,
        clientId: schema.messages.clientId,
      })
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "LIVE"));
    expect(liveRow[0]?.slaEligible).toBe(true);
    expect(liveRow[0]?.clientId).toBe(CLIENT);
  });

  it("marks delete-for-everyone targets without storing a new revoke message", async () => {
    await normalizeEvent(
      evt({ providerMessageId: "DEL-TARGET" }),
      ctx(),
      store,
    );
    const before = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "DEL-REVOKE"));

    const out = await normalizeEvent(
      evt({
        providerMessageId: "DEL-REVOKE",
        messageType: "deleted",
        revokeTargetProviderMessageId: "DEL-TARGET",
      }),
      ctx(),
      store,
    );

    expect(out.kind).toBe("revoked");
    const target = await db
      .select({ status: schema.messages.status })
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "DEL-TARGET"));
    const revokeRows = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.providerMessageId, "DEL-REVOKE"));
    expect(target[0]?.status).toBe("deleted_on_whatsapp");
    expect(before).toHaveLength(0);
    expect(revokeRows).toHaveLength(0);
  });

  it("records group metadata changes for registry review and refreshes title", async () => {
    const out = await normalizeEvent(
      evt({
        providerMessageId: "META-RENAME",
        messageType: "system",
        groupMetadata: {
          eventType: "subject_changed",
          oldValue: "Old Support",
          newValue: "Production Escalations",
        },
      }),
      ctx(),
      store,
    );

    expect(out.kind).toBe("group_metadata");
    const channelRows = await db
      .select({ id: schema.channels.id, title: schema.channels.title })
      .from(schema.channels)
      .where(eq(schema.channels.providerChatId, "900@g.us"));
    const events = await db
      .select({
        eventType: schema.groupMetadataEvents.eventType,
        oldValue: schema.groupMetadataEvents.oldValue,
        newValue: schema.groupMetadataEvents.newValue,
        reviewStatus: schema.groupMetadataEvents.reviewStatus,
      })
      .from(schema.groupMetadataEvents)
      .where(eq(schema.groupMetadataEvents.channelId, channelRows[0]!.id));
    expect(channelRows[0]?.title).toBe("Production Escalations");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "subject_changed",
          oldValue: "Old Support",
          newValue: "Production Escalations",
          reviewStatus: "pending",
        }),
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";
import type { NormalizedGatewayEvent } from "@clariodesk/types";
import { normalizeEvent, type NormalizeContext } from "./normalize.js";
import type {
  ChannelContext,
  InsertedMedia,
  InsertMediaRow,
  InsertMessageRow,
  NormalizationStore,
  SenderResolution,
} from "./ports.js";

/** In-memory fake implementing the store port (no DB needed). */
class FakeStore implements NormalizationStore {
  messages: InsertMessageRow[] = [];
  media: InsertMediaRow[] = [];
  outboxByProviderId = new Map<string, string>();
  lastTouched: { channelId: string; at: Date } | null = null;
  channel: ChannelContext = {
    channelId: "ch1",
    mappingMode: "single_client",
    mappingEffectiveAtMs: 1_000,
    clientId: "client1",
    projectId: "proj1",
  };
  internalSenders = new Set<string>();
  private seq = 0;

  async getOrCreateChannel(): Promise<ChannelContext> {
    return this.channel;
  }
  async resolveSender(input: {
    providerSenderId: string | null;
  }): Promise<SenderResolution> {
    const isInternal =
      input.providerSenderId !== null &&
      this.internalSenders.has(input.providerSenderId);
    return {
      contactId: input.providerSenderId ? "contact1" : null,
      isInternal,
    };
  }
  async findMessageByIdempotency(
    _ws: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null> {
    const found = this.messages.find(
      (m) =>
        m.channelId === channelId && m.providerMessageId === providerMessageId,
    );
    return found ? { id: idFor(found) } : null;
  }
  async findOutboxByProviderMessageId(
    _ws: string,
    _ch: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null> {
    const ob = this.outboxByProviderId.get(providerMessageId);
    return ob ? { id: ob } : null;
  }
  async insertMessage(row: InsertMessageRow): Promise<{ id: string }> {
    this.messages.push(row);
    return { id: idFor(row) };
  }
  async mergeOutboxEcho(
    _outboxId: string,
    row: InsertMessageRow,
  ): Promise<{ id: string }> {
    this.messages.push(row);
    return { id: idFor(row) };
  }
  async insertMedia(rows: InsertMediaRow[]): Promise<InsertedMedia[]> {
    return rows.map((row) => {
      this.media.push(row);
      return { mediaId: `media-${this.seq++}`, row };
    });
  }
  async touchChannelLastMessage(channelId: string, at: Date): Promise<void> {
    this.lastTouched = { channelId, at };
  }
  awaitingResponseSince: Date | null = null;
  teamRespondedAt: Date | null = null;
  async markAwaitingResponse(_channelId: string, at: Date): Promise<void> {
    if (this.awaitingResponseSince === null) this.awaitingResponseSince = at;
  }
  async recordTeamResponse(_channelId: string, at: Date): Promise<void> {
    this.awaitingResponseSince = null;
    this.teamRespondedAt = at;
  }
  deletedProviderIds: string[] = [];
  metadataEvents: Array<{ eventType: string; newValue: string | null }> = [];
  async markMessageDeleted(
    _ws: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<string | null> {
    const found = this.messages.find(
      (m) =>
        m.channelId === channelId && m.providerMessageId === providerMessageId,
    );
    this.deletedProviderIds.push(providerMessageId);
    return found ? idFor(found) : null;
  }
  async recordGroupMetadataEvent(input: {
    eventType: string;
    newValue: string | null;
  }): Promise<void> {
    this.metadataEvents.push({
      eventType: input.eventType,
      newValue: input.newValue,
    });
  }
}

function idFor(row: InsertMessageRow): string {
  return `${row.channelId}:${row.providerMessageId}`;
}

function ctx(over: Partial<NormalizeContext> = {}): NormalizeContext {
  return {
    workspaceId: "ws1",
    phoneInstanceId: "phone1",
    rawEventRefId: "raw1",
    phoneOwnerProviderId: "owner@s.whatsapp.net",
    phoneRestricted: false,
    isReconnectSync: false,
    staleSyncThresholdSeconds: 900,
    nowMs: 100_000,
    ...over,
  };
}

function evt(
  over: Partial<NormalizedGatewayEvent> = {},
): NormalizedGatewayEvent {
  return {
    adapterType: "clario_gateway",
    providerMessageId: "m1",
    providerChatId: "120@g.us",
    providerSenderId: "client@s.whatsapp.net",
    channelType: "group",
    messageType: "text",
    direction: "inbound",
    body: "portal down",
    providerTimestampMs: 50_000, // after mapping boundary (1000)
    isHistorySync: false,
    ...over,
  };
}

describe("normalizeEvent orchestration", () => {
  it("stores a live client message as SLA-eligible client_user", async () => {
    const store = new FakeStore();
    const out = await normalizeEvent(evt(), ctx(), store);
    expect(out.kind).toBe("stored");
    if (out.kind !== "stored") return;
    expect(out.classification.slaEligible).toBe(true);
    expect(store.messages[0]?.sentByType).toBe("client_user");
    expect(store.messages[0]?.clientId).toBe("client1");
    expect(store.lastTouched?.channelId).toBe("ch1");
  });

  it("dedupes a message already stored (idempotency)", async () => {
    const store = new FakeStore();
    await normalizeEvent(evt(), ctx(), store);
    const second = await normalizeEvent(evt(), ctx(), store);
    expect(second.kind).toBe("duplicate");
    expect(store.messages).toHaveLength(1);
  });

  it("attaches newly discovered media to a duplicate history message", async () => {
    const store = new FakeStore();
    await normalizeEvent(evt({ providerMessageId: "img-late" }), ctx(), store);
    const second = await normalizeEvent(
      evt({
        providerMessageId: "img-late",
        messageType: "image",
        isHistorySync: true,
        media: [
          {
            mediaType: "image",
            providerMediaId: "late-media",
          },
        ],
      }),
      ctx(),
      store,
    );

    expect(second.kind).toBe("duplicate");
    if (second.kind !== "duplicate") return;
    expect(second.mediaToDownload[0]).toMatchObject({
      providerMediaId: "late-media",
      isLive: false,
    });
    expect(store.media[0]).toMatchObject({
      messageId: "ch1:img-late",
      providerMediaId: "late-media",
      source: "backfill",
    });
  });

  it("merges a dashboard outbound echo into its outbox row (no duplicate)", async () => {
    const store = new FakeStore();
    store.outboxByProviderId.set("out1", "outbox-row-1");
    const out = await normalizeEvent(
      evt({ providerMessageId: "out1", direction: "outbound", body: "reply" }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    if (out.kind !== "stored") return;
    expect(out.isGhostAgent).toBe(false);
    expect(store.messages[0]?.sentByType).toBe("dashboard_agent");
  });

  it("attributes an unmatched outbound to the physical phone (ghost agent)", async () => {
    const store = new FakeStore();
    const out = await normalizeEvent(
      evt({ providerMessageId: "ghost1", direction: "outbound" }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    if (out.kind !== "stored") return;
    expect(out.isGhostAgent).toBe(true);
    expect(store.messages[0]?.sentByType).toBe("phone_user");
  });

  it("suppresses a message before the mapping boundary as backfill", async () => {
    const store = new FakeStore();
    const out = await normalizeEvent(
      evt({ providerMessageId: "old1", providerTimestampMs: 500 }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("stored");
    if (out.kind !== "stored") return;
    expect(out.classification.isBackfill).toBe(true);
    expect(store.messages[0]?.slaEligible).toBe(false);
  });

  it("routes live media as immediate and tags backfill media as lazy", async () => {
    const store = new FakeStore();
    const live = await normalizeEvent(
      evt({
        providerMessageId: "img1",
        messageType: "image",
        media: [
          {
            mediaType: "image",
            providerMediaId: "img1",
            providerMediaKey: "k",
          },
        ],
      }),
      ctx(),
      store,
    );
    expect(live.kind === "stored" && live.mediaToDownload[0]?.isLive).toBe(
      true,
    );
    expect(store.media[0]?.source).toBe("live");
  });

  it("does not start client SLA for an internal sender", async () => {
    const store = new FakeStore();
    store.internalSenders.add("client@s.whatsapp.net");
    const out = await normalizeEvent(evt(), ctx(), store);
    expect(out.kind === "stored" && out.classification.slaEligible).toBe(false);
    expect(store.messages[0]?.sentByType).toBe("dashboard_agent");
  });

  it("starts the first-response clock on an eligible client message", async () => {
    const store = new FakeStore();
    await normalizeEvent(evt({ providerMessageId: "fr1" }), ctx(), store);
    expect(store.awaitingResponseSince).not.toBeNull();
  });

  it("stops the clock when an agent replies from the dashboard", async () => {
    const store = new FakeStore();
    store.outboxByProviderId.set("reply1", "ob-1");
    await normalizeEvent(evt({ providerMessageId: "fr2" }), ctx(), store);
    expect(store.awaitingResponseSince).not.toBeNull();
    await normalizeEvent(
      evt({
        providerMessageId: "reply1",
        direction: "outbound",
        body: "on it",
      }),
      ctx(),
      store,
    );
    expect(store.awaitingResponseSince).toBeNull();
    expect(store.teamRespondedAt).not.toBeNull();
  });

  it("does not start the clock for a backfilled message", async () => {
    const store = new FakeStore();
    await normalizeEvent(
      evt({ providerMessageId: "old", providerTimestampMs: 500 }),
      ctx(),
      store,
    );
    expect(store.awaitingResponseSince).toBeNull();
  });

  it("marks the target message deleted on a revoke (no new message stored)", async () => {
    const store = new FakeStore();
    await normalizeEvent(evt({ providerMessageId: "orig" }), ctx(), store);
    const before = store.messages.length;
    const out = await normalizeEvent(
      evt({ providerMessageId: "rev1", revokeTargetProviderMessageId: "orig" }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("revoked");
    expect(store.deletedProviderIds).toContain("orig");
    expect(store.messages.length).toBe(before); // revoke itself not stored
  });

  it("records a group metadata change for review", async () => {
    const store = new FakeStore();
    const out = await normalizeEvent(
      evt({
        providerMessageId: "meta1",
        groupMetadata: {
          eventType: "subject_changed",
          oldValue: "Old",
          newValue: "Production Escalations",
        },
      }),
      ctx(),
      store,
    );
    expect(out.kind).toBe("group_metadata");
    expect(store.metadataEvents[0]?.newValue).toBe("Production Escalations");
  });
});

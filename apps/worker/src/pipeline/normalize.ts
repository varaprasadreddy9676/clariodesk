import type { NormalizedGatewayEvent, SentByType } from "@clariodesk/types";
import {
  classifyMessage,
  reconcileEcho,
  type ClassificationResult,
} from "@clariodesk/policy-engine";
import type {
  ChannelContext,
  InsertMediaRow,
  InsertedMedia,
  InsertMessageRow,
  NormalizationStore,
} from "./ports.js";

export type NormalizeContext = {
  workspaceId: string;
  phoneInstanceId: string;
  rawEventRefId: string | null;
  /** Sender id that belongs to this phone instance's own number. */
  phoneOwnerProviderId: string | null;
  phoneRestricted: boolean;
  isReconnectSync: boolean;
  staleSyncThresholdSeconds: number;
  nowMs: number;
};

export type NormalizeOutcome =
  | {
      kind: "duplicate";
      messageId: string;
      mediaToDownload: Array<{
        mediaId: string;
        providerMediaId: string;
        providerMediaKey: string | null;
        isLive: boolean;
      }>;
    }
  | { kind: "revoked"; channelId: string; targetMessageId: string | null }
  | { kind: "group_metadata"; channelId: string }
  | {
      kind: "stored";
      messageId: string;
      channelId: string;
      classification: ClassificationResult;
      /** Media that must be downloaded (live = immediate, backfill = lazy). */
      mediaToDownload: Array<{
        mediaId: string;
        providerMediaId: string;
        providerMediaKey: string | null;
        isLive: boolean;
      }>;
      isGhostAgent: boolean;
    };

/**
 * Normalize one gateway event into a stored message, applying every P0 safety
 * rule in order (TDD §8.2). Pure orchestration over the {@link NormalizationStore}
 * port — no direct DB/network — so it is fully unit-testable.
 */
export async function normalizeEvent(
  event: NormalizedGatewayEvent,
  ctx: NormalizeContext,
  store: NormalizationStore,
): Promise<NormalizeOutcome> {
  const channel = await store.getOrCreateChannel({
    workspaceId: ctx.workspaceId,
    phoneInstanceId: ctx.phoneInstanceId,
    providerChatId: event.providerChatId,
    channelType: event.channelType,
  });

  // 0a. Delete-for-everyone: mark the target deleted, keep evidence (TDD §18).
  if (event.revokeTargetProviderMessageId) {
    const target = await store.markMessageDeleted(
      ctx.workspaceId,
      channel.channelId,
      event.revokeTargetProviderMessageId,
    );
    return {
      kind: "revoked",
      channelId: channel.channelId,
      targetMessageId: target,
    };
  }

  // 0b. Group metadata change → record a review event (TDD §O.4).
  if (event.groupMetadata) {
    await store.recordGroupMetadataEvent({
      workspaceId: ctx.workspaceId,
      channelId: channel.channelId,
      clientId: channel.clientId,
      projectId: channel.projectId,
      eventType: event.groupMetadata.eventType,
      oldValue: event.groupMetadata.oldValue ?? null,
      newValue: event.groupMetadata.newValue ?? null,
      providerTimestamp: new Date(event.providerTimestampMs),
    });
    return { kind: "group_metadata", channelId: channel.channelId };
  }

  // 1. Idempotency — collapse live/backfill/echo duplicates (TDD §8.4).
  const existing = await store.findMessageByIdempotency(
    ctx.workspaceId,
    channel.channelId,
    event.providerMessageId,
  );
  if (existing) {
    const insertedMedia = await insertEventMedia({
      event,
      ctx,
      channel,
      messageId: existing.id,
      source: event.isHistorySync || ctx.isReconnectSync ? "backfill" : "live",
      store,
    });
    return {
      kind: "duplicate",
      messageId: existing.id,
      mediaToDownload: insertedMedia.map((im) => ({
        mediaId: im.mediaId,
        providerMediaId: im.row.providerMediaId ?? "",
        providerMediaKey: im.row.providerMediaKey,
        isLive: im.row.source === "live",
      })),
    };
  }

  // 2. Sender + internal classification (FRS §14.6). Inbound messages also
  // upsert the contact + channel membership.
  const sender = await store.resolveSender({
    workspaceId: ctx.workspaceId,
    channelId: channel.channelId,
    providerSenderId: event.providerSenderId ?? null,
    senderDisplayName: event.senderDisplayName ?? null,
    clientId: channel.clientId,
    projectId: channel.projectId,
    phoneInstanceOwner:
      ctx.phoneOwnerProviderId !== null &&
      event.providerSenderId === ctx.phoneOwnerProviderId,
    createIfMissing: event.direction === "inbound",
  });

  // 3. Live vs backfill/stale classification (the safety core).
  const classification = classifyMessage({
    providerTimestampMs: event.providerTimestampMs,
    nowMs: ctx.nowMs,
    mappingEffectiveAtMs: channel.mappingEffectiveAtMs,
    mappingMode: channel.mappingMode,
    isHistorySync: event.isHistorySync ?? false,
    isReconnectSync: ctx.isReconnectSync,
    staleSyncThresholdSeconds: ctx.staleSyncThresholdSeconds,
    explicitBackfill: false,
    direction: event.direction,
    messageType: event.messageType,
    senderIsInternal: sender.isInternal,
    phoneRestricted: ctx.phoneRestricted,
  });

  // 4. Echo reconciliation for outbound messages (TDD §10.6).
  const matchingOutbox =
    event.direction === "outbound"
      ? await store.findOutboxByProviderMessageId(
          ctx.workspaceId,
          channel.channelId,
          event.providerMessageId,
        )
      : null;
  const echo = reconcileEcho({
    direction: event.direction,
    matchingOutboxId: matchingOutbox?.id ?? null,
  });

  const sentByType = resolveSentByType(
    event.direction,
    echo.action,
    sender.isInternal,
  );

  // client_id/project_id are set ONCE here from the mapping effective now and
  // are immutable afterwards (TDD §6.11 review note).
  const row: InsertMessageRow = {
    workspaceId: ctx.workspaceId,
    channelId: channel.channelId,
    clientId: channel.clientId,
    projectId: channel.projectId,
    phoneInstanceId: ctx.phoneInstanceId,
    providerMessageId: event.providerMessageId,
    providerChatId: event.providerChatId,
    providerSenderId: event.providerSenderId ?? null,
    senderContactId: sender.contactId,
    messageType: event.messageType,
    direction: event.direction,
    sentByType,
    body: event.body ?? null,
    quotedProviderMessageId: event.quotedProviderMessageId ?? null,
    providerTimestamp: new Date(event.providerTimestampMs),
    isBackfill: classification.isBackfill,
    isLiveEvent: classification.isLiveEvent,
    automationSuppressed: classification.automationSuppressed,
    automationSuppressedReason: classification.automationSuppressedReason,
    slaEligible: classification.slaEligible,
    ticketAutoCreateEligible: classification.ticketAutoCreateEligible,
    rawEventRefId: ctx.rawEventRefId,
  };

  // 5. Persist — merge into outbox row for a dashboard echo, else insert.
  const inserted =
    echo.action === "merge_into_outbox"
      ? await store.mergeOutboxEcho(echo.outboxId, row)
      : await store.insertMessage(row);

  // 6. Media rows. Live media is downloaded immediately; backfill is lazy
  // (TDD §9.1/§9.2). Backfill media is never urgent and must not block.
  const insertedMedia = await insertEventMedia({
    event,
    ctx,
    channel,
    messageId: inserted.id,
    source: classification.isBackfill ? "backfill" : "live",
    store,
  });

  const at = new Date(event.providerTimestampMs);
  await store.touchChannelLastMessage(channel.channelId, at);

  // First-response timer (TDD §14.3). An eligible live client message starts
  // the clock; a team reply (dashboard agent or ghost-agent phone reply) stops
  // it and stamps any open tickets in the channel.
  if (classification.slaEligible && event.direction === "inbound") {
    await store.markAwaitingResponse(channel.channelId, at);
  } else if (
    event.direction === "outbound" &&
    (sentByType === "dashboard_agent" || sentByType === "phone_user")
  ) {
    await store.recordTeamResponse(channel.channelId, at);
  }

  return {
    kind: "stored",
    messageId: inserted.id,
    channelId: channel.channelId,
    classification,
    isGhostAgent: echo.action === "new_ghost_agent_message",
    mediaToDownload: insertedMedia.map((im) => ({
      mediaId: im.mediaId,
      providerMediaId: im.row.providerMediaId ?? "",
      providerMediaKey: im.row.providerMediaKey,
      isLive: !classification.isBackfill,
    })),
  };
}

async function insertEventMedia(input: {
  event: NormalizedGatewayEvent;
  ctx: NormalizeContext;
  channel: ChannelContext;
  messageId: string;
  source: InsertMediaRow["source"];
  store: NormalizationStore;
}): Promise<InsertedMedia[]> {
  const mediaRows: InsertMediaRow[] = (input.event.media ?? []).map((m) => ({
    workspaceId: input.ctx.workspaceId,
    messageId: input.messageId,
    clientId: input.channel.clientId,
    channelId: input.channel.channelId,
    mediaType: m.mediaType,
    mimeType: m.mimeType ?? null,
    fileName: m.fileName ?? null,
    sizeBytes: m.sizeBytes ?? null,
    providerMediaId: m.providerMediaId,
    providerMediaKey: m.providerMediaKey ?? null,
    source: input.source,
  }));
  return mediaRows.length ? input.store.insertMedia(mediaRows) : [];
}

function resolveSentByType(
  direction: NormalizedGatewayEvent["direction"],
  echoAction: ReturnType<typeof reconcileEcho>["action"],
  senderIsInternal: boolean,
): SentByType {
  if (direction === "inbound") {
    return senderIsInternal ? "dashboard_agent" : "client_user";
  }
  // outbound
  if (echoAction === "merge_into_outbox") return "dashboard_agent";
  if (echoAction === "new_ghost_agent_message") return "phone_user";
  return "unknown";
}

import type { Job } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@clariodesk/db";
import { evaluateSendPolicy } from "@clariodesk/policy-engine";
import type { ObjectStorage } from "@clariodesk/storage";
import type {
  GatewaySendResult,
  WhatsAppGatewayAdapter,
} from "@clariodesk/gateway-adapters";
import type { MessageType } from "@clariodesk/types";
import type { WorkerDeps } from "../context.js";
import type { OutboxSendJob } from "../queues.js";

/**
 * Dispatch one outbox row through the gateway (TDD §10.2). The policy gate is
 * re-evaluated here (defense in depth) before any bytes leave the platform.
 * The send-delay/jitter timing is enforced by the BullMQ job delay; this
 * processor only runs once the row is actually due.
 */
export function makeOutboxSendProcessor(deps: WorkerDeps) {
  return async (job: Job<OutboxSendJob>): Promise<void> => {
    const { outboxId, workspaceId } = job.data;
    const log = deps.logger.child({
      workspace_id: workspaceId,
      job_id: job.id,
    });

    // Atomic claim: only succeed if the row is still pending/waiting.
    // This prevents double-send when BullMQ stalls and re-queues the job or
    // when multiple worker processes run concurrently.
    const [outbox] = await deps.db
      .update(schema.outboxMessages)
      .set({ status: "sending", updatedAt: new Date() })
      .where(
        and(
          eq(schema.outboxMessages.id, outboxId),
          inArray(schema.outboxMessages.status, ["pending", "waiting_delay"]),
        ),
      )
      .returning();
    if (!outbox) {
      log.info({ outboxId }, "outbox already claimed, sent, or cancelled — skipping");
      return;
    }

    const phone = await deps.db
      .select()
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, outbox.phoneInstanceId))
      .limit(1);
    const channel = await deps.db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, outbox.channelId))
      .limit(1);
    const mapping = await deps.db
      .select({
        mappingMode: schema.channelMappings.mappingMode,
        clientId: schema.channelMappings.clientId,
        projectId: schema.channelMappings.projectId,
      })
      .from(schema.channelMappings)
      .where(
        and(
          eq(schema.channelMappings.channelId, outbox.channelId),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .limit(1);

    if (!phone[0] || !channel[0] || !phone[0].providerInstanceId) {
      await fail(deps, outboxId, "phone/channel/provider instance missing");
      return;
    }

    const verdict = evaluateSendPolicy({
      phoneStatus: phone[0].status,
      connectionMode: phone[0].connectionMode,
      mappingMode: mapping[0]?.mappingMode ?? "unmapped",
      cooldownActive: false,
      costLimitExceeded: false,
      recipientCount: 1,
      mediumRiskThreshold: 10,
      highRiskThreshold: 25,
      actorIsAdmin: false,
    });
    if (verdict.status !== "allowed") {
      await deps.db
        .update(schema.outboxMessages)
        .set({
          status: "policy_blocked",
          policyStatus:
            verdict.status === "needs_approval" ? "needs_approval" : "blocked",
          failureReason: verdict.reason,
          updatedAt: new Date(),
        })
        .where(eq(schema.outboxMessages.id, outboxId));
      log.warn(
        { outboxId, reason: verdict.reason },
        "outbox send blocked by policy",
      );
      return;
    }

    try {
      // Status already set to "sending" by the atomic claim above.
      const adapter = deps.getAdapterForPhone(phone[0]);
      const [media] = outbox.mediaId
        ? await deps.db
            .select({
              storageKey: schema.messageMedia.storageKey,
              mimeType: schema.messageMedia.mimeType,
              fileName: schema.messageMedia.fileName,
            })
            .from(schema.messageMedia)
            .where(eq(schema.messageMedia.id, outbox.mediaId))
            .limit(1)
        : [undefined];
      const result = await sendProviderMessage({
        adapter,
        storage: deps.storage,
        providerInstanceId: phone[0].providerInstanceId,
        providerChatId: channel[0].providerChatId,
        body: outbox.body ?? "",
        messageType: outbox.messageType,
        quotedMessageId: outbox.quotedMessageId,
        media,
      });

      // Store the provider id so the inbound echo merges into THIS row (§8.4).
      const sentAt = new Date();
      await deps.db
        .update(schema.outboxMessages)
        .set({
          status: "sent",
          providerMessageId: result.providerMessageId,
          updatedAt: sentAt,
        })
        .where(eq(schema.outboxMessages.id, outboxId));
      const [persistedMessage] = await deps.db
        .insert(schema.messages)
        .values({
          workspaceId: outbox.workspaceId,
          channelId: outbox.channelId,
          clientId: outbox.clientId ?? mapping[0]?.clientId ?? null,
          projectId: mapping[0]?.projectId ?? null,
          phoneInstanceId: outbox.phoneInstanceId,
          providerMessageId: result.providerMessageId,
          providerChatId: channel[0].providerChatId,
          messageType: outbox.messageType,
          direction: "outbound",
          sentByType: "dashboard_agent",
          sentByUserId: outbox.createdByUserId,
          body: outbox.body,
          quotedMessageId: outbox.quotedMessageId,
          providerTimestamp: sentAt,
          isBackfill: false,
          isLiveEvent: true,
          automationSuppressed: false,
          slaEligible: false,
          ticketAutoCreateEligible: false,
          status: "received",
        })
        .onConflictDoNothing()
        .returning({ id: schema.messages.id });
      let persistedMessageId = persistedMessage?.id;
      if (!persistedMessageId) {
        const [existingMessage] = await deps.db
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.workspaceId, outbox.workspaceId),
              eq(schema.messages.channelId, outbox.channelId),
              eq(schema.messages.providerMessageId, result.providerMessageId),
            ),
          )
          .limit(1);
        persistedMessageId = existingMessage?.id;
      }
      if (outbox.mediaId && persistedMessageId) {
        await deps.db
          .update(schema.messageMedia)
          .set({ messageId: persistedMessageId, updatedAt: sentAt })
          .where(eq(schema.messageMedia.id, outbox.mediaId));
      }
      await deps.db
        .update(schema.channels)
        .set({
          lastMessageAt: sentAt,
          lastAgentReplyAt: sentAt,
          awaitingResponseSince: null,
          updatedAt: sentAt,
        })
        .where(eq(schema.channels.id, outbox.channelId));
      await deps.realtime.publish({
        type: "message.received",
        workspaceId: outbox.workspaceId,
        channelId: outbox.channelId,
        payload: {
          messageId: result.providerMessageId,
          direction: "outbound",
        },
      });
      await deps.realtime.publish({
        type: "outbox.status_changed",
        workspaceId: outbox.workspaceId,
        channelId: outbox.channelId,
        payload: { outboxId, status: "sent" },
      });
      log.info(
        { outboxId, providerMessageId: result.providerMessageId },
        "sent",
      );
    } catch (err) {
      await fail(deps, outboxId, String(err));
      throw err; // allow BullMQ retry/backoff
    }
  };
}

export async function sendProviderMessage(input: {
  adapter: WhatsAppGatewayAdapter;
  storage: ObjectStorage;
  providerInstanceId: string;
  providerChatId: string;
  body: string;
  messageType: MessageType;
  quotedMessageId: string | null;
  media?: {
    storageKey: string | null;
    mimeType: string | null;
    fileName: string | null;
  };
}): Promise<GatewaySendResult> {
  if (input.messageType === "text") {
    return input.adapter.sendText({
      providerInstanceId: input.providerInstanceId,
      providerChatId: input.providerChatId,
      body: input.body,
      ...(input.quotedMessageId
        ? { quotedProviderMessageId: input.quotedMessageId }
        : {}),
    });
  }
  if (!input.media?.storageKey || !input.media.mimeType) {
    throw new Error("Outbound media metadata is missing");
  }
  const bytes = await input.storage.getMedia(input.media.storageKey);
  if (!bytes.byteLength || bytes.byteLength > 16 * 1024 * 1024) {
    throw new Error("Outbound media must be between 1 byte and 16 MB");
  }
  return input.adapter.sendMedia({
    providerInstanceId: input.providerInstanceId,
    providerChatId: input.providerChatId,
    mediaBase64: Buffer.from(bytes).toString("base64"),
    mimeType: input.media.mimeType,
    fileName: input.media.fileName ?? undefined,
    caption: input.body || undefined,
    ...(input.quotedMessageId
      ? { quotedProviderMessageId: input.quotedMessageId }
      : {}),
  });
}

async function fail(deps: WorkerDeps, outboxId: string, reason: string) {
  await deps.db
    .update(schema.outboxMessages)
    .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
    .where(eq(schema.outboxMessages.id, outboxId));
}

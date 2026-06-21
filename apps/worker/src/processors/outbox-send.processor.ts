import type { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { schema } from "@clariodesk/db";
import { evaluateSendPolicy } from "@clariodesk/policy-engine";
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

    const rows = await deps.db
      .select()
      .from(schema.outboxMessages)
      .where(eq(schema.outboxMessages.id, outboxId))
      .limit(1);
    const outbox = rows[0];
    if (!outbox) {
      log.warn({ outboxId }, "outbox row missing");
      return;
    }
    if (outbox.status === "sent" || outbox.status === "cancelled") return;

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
      await deps.db
        .update(schema.outboxMessages)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(schema.outboxMessages.id, outboxId));

      const adapter = deps.getAdapterForPhone(phone[0]);
      const result = await adapter.sendText({
        providerInstanceId: phone[0].providerInstanceId,
        providerChatId: channel[0].providerChatId,
        body: outbox.body ?? "",
        ...(outbox.quotedMessageId
          ? { quotedProviderMessageId: outbox.quotedMessageId }
          : {}),
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
      await deps.db
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
        .onConflictDoNothing();
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

async function fail(deps: WorkerDeps, outboxId: string, reason: string) {
  await deps.db
    .update(schema.outboxMessages)
    .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
    .where(eq(schema.outboxMessages.id, outboxId));
}

import { setTimeout as sleep } from "node:timers/promises";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { schema } from "@clariodesk/db";
import { assessBatch } from "@clariodesk/policy-engine";
import type { WorkerDeps } from "../context.js";
import { JOB_PRIORITY, QUEUE, type NormalizeJob } from "../queues.js";
import { DrizzleNormalizationStore } from "../pipeline/drizzle-store.js";
import { normalizeEvent } from "../pipeline/normalize.js";

/**
 * Normalize a batch of gateway events into stored messages, then fan out media
 * downloads. Live media goes to the high-priority queue; backfill media to the
 * lazy queue so it can never block live ingestion (TDD §8.2, §9).
 */
export function makeNormalizeProcessor(deps: WorkerDeps) {
  const store = new DrizzleNormalizationStore(deps.db);

  return async (job: Job<NormalizeJob>): Promise<void> => {
    const {
      workspaceId,
      phoneInstanceId,
      events,
      isReconnectSync,
      rawEventRefId,
    } = job.data;
    const log = deps.logger.child({
      workspace_id: workspaceId,
      phone_instance_id: phoneInstanceId,
      job_id: job.id,
    });

    const phone = await deps.db
      .select({
        status: schema.phoneInstances.status,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
      })
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, phoneInstanceId))
      .limit(1);
    const phoneRestricted =
      phone[0]?.status === "restricted" || phone[0]?.status === "degraded";

    // Reconnect-storm backpressure: a large or reconnect-flagged batch is
    // drained with a small per-event delay so live traffic on other phones is
    // not starved (TDD §8.6, §19.3).
    const storm = assessBatch({
      eventCount: events.length,
      isReconnectSync,
      stormThreshold: deps.config.RECONNECT_STORM_EVENT_THRESHOLD,
      throttleMs: deps.config.RECONNECT_STORM_THROTTLE_MS,
    });
    if (storm.isStorm) {
      log.warn(
        { eventCount: events.length, throttleMs: storm.throttleMs },
        "reconnect storm detected — draining with backpressure",
      );
    }

    for (const event of events) {
      if (storm.throttleMs > 0) await sleep(storm.throttleMs);
      const outcome = await normalizeEvent(
        event,
        {
          workspaceId,
          phoneInstanceId,
          rawEventRefId,
          phoneOwnerProviderId: null,
          phoneRestricted,
          isReconnectSync,
          staleSyncThresholdSeconds: deps.config.STALE_SYNC_THRESHOLD_SECONDS,
          nowMs: Date.now(),
        },
        store,
      );

      if (outcome.kind === "duplicate") {
        log.debug({ messageId: outcome.messageId }, "deduped message");
        for (const media of outcome.mediaToDownload) {
          await enqueueMediaDownload(deps, {
            workspaceId,
            messageId: outcome.messageId,
            media,
            phoneInstanceId,
          });
        }
        continue;
      }

      if (outcome.kind === "revoked") {
        await deps.realtime.publish({
          type: "message.updated",
          workspaceId,
          channelId: outcome.channelId,
          payload: {
            messageId: outcome.targetMessageId,
            status: "deleted_on_whatsapp",
          },
        });
        continue;
      }

      if (outcome.kind === "group_metadata") {
        await deps.realtime.publish({
          type: "channel.updated",
          workspaceId,
          channelId: outcome.channelId,
          payload: { reason: "group_metadata_changed" },
        });
        continue;
      }

      // Notify connected agents in real time (permission-scoped downstream).
      await deps.realtime.publish({
        type: "message.received",
        workspaceId,
        channelId: outcome.channelId,
        payload: {
          messageId: outcome.messageId,
          isBackfill: outcome.classification.isBackfill,
        },
      });

      for (const media of outcome.mediaToDownload) {
        await enqueueMediaDownload(deps, {
          workspaceId,
          messageId: outcome.messageId,
          media,
          phoneInstanceId,
        });
      }
    }
  };
}

async function enqueueMediaDownload(
  deps: WorkerDeps,
  input: {
    workspaceId: string;
    messageId: string;
    phoneInstanceId: string;
    media: {
      mediaId: string;
      providerMediaId: string;
      providerMediaKey: string | null;
      isLive: boolean;
    };
  },
): Promise<void> {
  const queue = input.media.isLive
    ? deps.queues.mediaDownloadLive
    : deps.queues.mediaDownloadBackfill;
  await queue.add(
    input.media.isLive ? QUEUE.mediaDownloadLive : QUEUE.mediaDownloadBackfill,
    {
      workspaceId: input.workspaceId,
      messageId: input.messageId,
      mediaId: input.media.mediaId,
      phoneInstanceId: input.phoneInstanceId,
      providerMediaId: input.media.providerMediaId,
      ...(input.media.providerMediaKey
        ? { providerMediaKey: input.media.providerMediaKey }
        : {}),
    },
    {
      priority: input.media.isLive
        ? JOB_PRIORITY.liveMedia
        : JOB_PRIORITY.backfillMedia,
      attempts: input.media.isLive ? 5 : 2,
      backoff: { type: "exponential", delay: 2000 },
    },
  );
}

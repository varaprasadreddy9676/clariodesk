import { createHash } from "node:crypto";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { schema } from "@clariodesk/db";
import { mediaKey } from "@clariodesk/storage";
import type { WorkerDeps } from "../context.js";
import type { MediaDownloadJob } from "../queues.js";

/**
 * Download media bytes from the gateway before WhatsApp's URLs expire and store
 * them privately (TDD §9.1). The object key uses the opaque mediaId, never the
 * filename (§9.3). Failures mark the row retryable/expired — they never crash
 * the worker.
 */
export function makeMediaDownloadProcessor(deps: WorkerDeps) {
  return async (job: Job<MediaDownloadJob>): Promise<void> => {
    const {
      workspaceId,
      mediaId,
      phoneInstanceId,
      providerMediaId,
      providerMediaKey,
    } = job.data;
    const log = deps.logger.child({
      workspace_id: workspaceId,
      phone_instance_id: phoneInstanceId,
      job_id: job.id,
    });

    const media = await deps.db
      .select()
      .from(schema.messageMedia)
      .where(eq(schema.messageMedia.id, mediaId))
      .limit(1);
    const row = media[0];
    if (!row) {
      log.warn({ mediaId }, "media row missing; skipping");
      return;
    }
    if (row.storageStatus === "downloaded") return; // idempotent

    const phone = await deps.db
      .select({
        adapterType: schema.phoneInstances.adapterType,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        encryptedApiKey: schema.phoneInstances.encryptedApiKey,
      })
      .from(schema.phoneInstances)
      .where(eq(schema.phoneInstances.id, phoneInstanceId))
      .limit(1);
    const providerInstanceId = phone[0]?.providerInstanceId;
    if (!phone[0] || !providerInstanceId) {
      throw new Error("phone instance not found for media download");
    }

    try {
      const adapter = deps.getAdapterForPhone(phone[0]);
      const result = await adapter.downloadMedia({
        providerInstanceId,
        providerMediaId,
        ...(providerMediaKey ? { providerMediaKey } : {}),
      });

      const key = mediaKey({
        workspaceId,
        clientId: row.clientId,
        channelId: row.channelId,
        messageId: row.messageId,
        mediaId,
        at: new Date(),
      });
      await deps.storage.putMedia(
        key,
        result.bytes,
        result.mimeType ?? row.mimeType ?? undefined,
      );

      const sha256 = createHash("sha256").update(result.bytes).digest("hex");
      await deps.db
        .update(schema.messageMedia)
        .set({
          storageKey: key,
          storageStatus: "downloaded",
          sha256Hash: sha256,
          sizeBytes: result.bytes.byteLength,
          updatedAt: new Date(),
        })
        .where(eq(schema.messageMedia.id, mediaId));
      log.debug({ mediaId, key }, "media downloaded");
    } catch (err) {
      // Final attempt → mark expired/unavailable; earlier attempts retry.
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await deps.db
        .update(schema.messageMedia)
        .set({
          storageStatus: isFinalAttempt ? "expired" : "failed",
          updatedAt: new Date(),
        })
        .where(eq(schema.messageMedia.id, mediaId));
      log.error(
        { mediaId, err: String(err), isFinalAttempt },
        "media download failed",
      );
      if (!isFinalAttempt) throw err; // let BullMQ retry
    }
  };
}

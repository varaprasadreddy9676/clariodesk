import "dotenv/config";
import { Worker } from "bullmq";
import { buildWorkerDeps } from "./context.js";
import { QUEUE } from "./queues.js";
import { makeNormalizeProcessor } from "./processors/normalize.processor.js";
import { makeMediaDownloadProcessor } from "./processors/media-download.processor.js";
import { makeOutboxSendProcessor } from "./processors/outbox-send.processor.js";

/**
 * Worker runtime entrypoint (TDD §5.2). Runs the async pipeline: normalization,
 * media download, and outbox send. Shares the domain modules with the API but
 * executes a different entry point.
 */
async function main(): Promise<void> {
  const deps = buildWorkerDeps();
  await deps.storage.ensureBuckets();
  const connection = { connection: deps.connection };

  const { config } = deps;
  const workers: Worker[] = [
    new Worker(QUEUE.messageNormalization, makeNormalizeProcessor(deps), {
      ...connection,
      concurrency: config.WORKER_NORMALIZE_CONCURRENCY,
      // Cap DB write pressure so a reconnect storm can't saturate Postgres.
      limiter: {
        max: config.WORKER_NORMALIZE_MAX_PER_SEC,
        duration: 1000,
      },
    }),
    new Worker(QUEUE.mediaDownloadLive, makeMediaDownloadProcessor(deps), {
      ...connection,
      concurrency: 6,
    }),
    new Worker(QUEUE.mediaDownloadBackfill, makeMediaDownloadProcessor(deps), {
      ...connection,
      concurrency: 2,
      // Backfill media is best-effort; rate-limit so it never starves the
      // gateway/S3 budget that live downloads need.
      limiter: {
        max: config.WORKER_BACKFILL_MEDIA_MAX_PER_SEC,
        duration: 1000,
      },
    }),
    new Worker(QUEUE.outboxSend, makeOutboxSendProcessor(deps), {
      ...connection,
      // Serialize linked-device sends per the blast-radius rules (FRS §O.1).
      concurrency: 1,
    }),
  ];

  for (const w of workers) {
    w.on("failed", (job, err) => {
      deps.logger.error(
        { queue: w.name, job_id: job?.id, err: err.message },
        "job failed",
      );
    });
  }

  deps.logger.info("clariodesk worker started");

  const shutdown = async (signal: string) => {
    deps.logger.info({ signal }, "shutting down worker");
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([
      deps.queues.mediaDownloadLive.close(),
      deps.queues.mediaDownloadBackfill.close(),
    ]);
    await deps.realtime.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("worker failed to start", err);
  process.exit(1);
});

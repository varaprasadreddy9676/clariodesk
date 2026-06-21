import "dotenv/config";
import { loadConfig } from "@clariodesk/config";
import { createLogger } from "@clariodesk/logger";
import { getDb, closeDb } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import {
  checkPhoneHealth,
  purgeMedia,
  purgeMessages,
  purgeRawEvents,
  type JobDeps,
} from "./jobs.js";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/**
 * Scheduler runtime (TDD §5.4). Periodic maintenance: retention purges and
 * phone-health checks. Simple interval timers — no external cron needed.
 * Each tick is wrapped so one failing job never stops the others.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const deps: JobDeps = {
    db: getDb(config.DATABASE_URL),
    storage: new ObjectStorage({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      mediaBucket: config.S3_BUCKET_MEDIA,
      rawEventBucket: config.S3_BUCKET_RAW_EVENTS,
    }),
    logger,
    config,
  };

  const safe = (name: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (err) {
      logger.error({ job: name, err: String(err) }, "scheduled job failed");
    }
  };

  const retention = safe("retention", async () => {
    await purgeRawEvents(deps);
    await purgeMedia(deps);
    await purgeMessages(deps);
  });
  const health = safe("phone_health", () => checkPhoneHealth(deps));

  // Run once on boot, then on a cadence.
  await retention();
  await health();
  const timers = [
    setInterval(retention, 6 * HOUR),
    setInterval(health, 5 * MINUTE),
  ];

  logger.info("clariodesk scheduler started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down scheduler");
    for (const t of timers) clearInterval(t);
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("scheduler failed to start", err);
  process.exit(1);
});

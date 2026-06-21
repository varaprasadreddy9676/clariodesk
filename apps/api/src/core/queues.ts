import { Queue } from "bullmq";

/** Queue names shared with the worker runtime (must match apps/worker). */
export const QUEUE = {
  rawEventUpload: "raw-event-upload",
  messageNormalization: "message-normalization",
  mediaDownloadLive: "media-download-live",
  mediaDownloadBackfill: "media-download-backfill",
  outboxSend: "outbox-send",
} as const;

export type RedisConnection = { host: string; port: number; password?: string };

export function parseRedisUrl(url: string): RedisConnection {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    ...(u.password ? { password: u.password } : {}),
  };
}

/** Producer-side queue handles the API uses to enqueue work for the worker. */
export class QueueRegistry {
  readonly messageNormalization: Queue;
  readonly mediaDownloadLive: Queue;
  readonly mediaDownloadBackfill: Queue;
  readonly outboxSend: Queue;

  constructor(connection: RedisConnection) {
    this.messageNormalization = new Queue(QUEUE.messageNormalization, {
      connection,
    });
    this.mediaDownloadLive = new Queue(QUEUE.mediaDownloadLive, { connection });
    this.mediaDownloadBackfill = new Queue(QUEUE.mediaDownloadBackfill, {
      connection,
    });
    this.outboxSend = new Queue(QUEUE.outboxSend, { connection });
  }

  async close(): Promise<void> {
    await Promise.all([
      this.messageNormalization.close(),
      this.mediaDownloadLive.close(),
      this.mediaDownloadBackfill.close(),
      this.outboxSend.close(),
    ]);
  }
}

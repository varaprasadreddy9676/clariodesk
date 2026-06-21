import { Queue } from "bullmq";
import { loadConfig, type AppConfig } from "@clariodesk/config";
import { createLogger, type Logger } from "@clariodesk/logger";
import { getDb, type Database } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import { RealtimePublisher } from "@clariodesk/events";
import {
  GatewayAdapterFactory,
  type PhoneGatewayCreds,
  type WhatsAppGatewayAdapter,
} from "@clariodesk/gateway-adapters";
import { QUEUE } from "./queues.js";

/**
 * Plain Redis connection options handed to BullMQ. We pass options rather than a
 * shared ioredis instance so BullMQ owns its own connections (avoids ioredis
 * version/type clashes between our copy and BullMQ's bundled one).
 */
export type RedisConnection = {
  host: string;
  port: number;
  password?: string;
};

/** Shared runtime dependencies injected into every processor. */
export type WorkerDeps = {
  config: AppConfig;
  logger: Logger;
  db: Database;
  storage: ObjectStorage;
  realtime: RealtimePublisher;
  connection: RedisConnection;
  queues: {
    mediaDownloadLive: Queue;
    mediaDownloadBackfill: Queue;
  };
  /** Resolve a gateway adapter using a phone instance's (possibly per-phone) creds. */
  getAdapterForPhone(phone: PhoneGatewayCreds): WhatsAppGatewayAdapter;
};

function parseRedisUrl(url: string): RedisConnection {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    ...(u.password ? { password: u.password } : {}),
  };
}

export function buildWorkerDeps(): WorkerDeps {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const db = getDb(config.DATABASE_URL);
  const connection = parseRedisUrl(config.REDIS_URL);
  const storage = new ObjectStorage({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    mediaBucket: config.S3_BUCKET_MEDIA,
    rawEventBucket: config.S3_BUCKET_RAW_EVENTS,
  });

  const realtime = new RealtimePublisher(config.REDIS_URL);

  const queues = {
    mediaDownloadLive: new Queue(QUEUE.mediaDownloadLive, { connection }),
    mediaDownloadBackfill: new Queue(QUEUE.mediaDownloadBackfill, {
      connection,
    }),
  };

  // Shared gateway factory — prefers per-phone creds, falls back to env defaults.
  const adapterFactory = new GatewayAdapterFactory({
    defaultBaseUrl: config.CLARIO_GATEWAY_BASE_URL,
    defaultApiKey: config.CLARIO_GATEWAY_API_KEY,
    defaultsByAdapter: {
      clario_gateway: {
        baseUrl: config.CLARIO_GATEWAY_BASE_URL,
        apiKey: config.CLARIO_GATEWAY_API_KEY,
      },
    },
    encryptionKey: config.ENCRYPTION_KEY,
  });

  return {
    config,
    logger,
    db,
    storage,
    realtime,
    connection,
    queues,
    getAdapterForPhone: (phone) => adapterFactory.forPhone(phone),
  };
}

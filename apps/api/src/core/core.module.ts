import {
  Global,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
  Inject,
} from "@nestjs/common";
import { loadConfig, type AppConfig } from "@clariodesk/config";
import { createLogger, type Logger } from "@clariodesk/logger";
import { getDb, closeDb, type Database } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import { RealtimePublisher } from "@clariodesk/events";
import { TOKENS } from "../tokens.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { AdapterFactory, createAdapterFactory } from "./adapters.js";
import { parseRedisUrl, QueueRegistry } from "./queues.js";

/**
 * Provides the shared infrastructure singletons (config, db, storage, queues,
 * adapters, logger) to the whole app. Global so feature modules can inject them
 * without re-importing.
 */
@Global()
@Module({
  providers: [
    { provide: TOKENS.CONFIG, useFactory: (): AppConfig => loadConfig() },
    {
      provide: TOKENS.LOGGER,
      useFactory: (config: AppConfig): Logger => createLogger(config.LOG_LEVEL),
      inject: [TOKENS.CONFIG],
    },
    {
      provide: TOKENS.DB,
      useFactory: (config: AppConfig): Database => getDb(config.DATABASE_URL),
      inject: [TOKENS.CONFIG],
    },
    {
      provide: TOKENS.STORAGE,
      useFactory: (config: AppConfig): ObjectStorage =>
        new ObjectStorage({
          endpoint: config.S3_ENDPOINT,
          region: config.S3_REGION,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          forcePathStyle: config.S3_FORCE_PATH_STYLE,
          mediaBucket: config.S3_BUCKET_MEDIA,
          rawEventBucket: config.S3_BUCKET_RAW_EVENTS,
        }),
      inject: [TOKENS.CONFIG],
    },
    {
      provide: TOKENS.QUEUES,
      useFactory: (config: AppConfig): QueueRegistry =>
        new QueueRegistry(parseRedisUrl(config.REDIS_URL)),
      inject: [TOKENS.CONFIG],
    },
    {
      provide: TOKENS.ADAPTERS,
      useFactory: (config: AppConfig): AdapterFactory =>
        createAdapterFactory(config),
      inject: [TOKENS.CONFIG],
    },
    {
      provide: TOKENS.REALTIME,
      useFactory: (config: AppConfig): RealtimePublisher =>
        new RealtimePublisher(config.REDIS_URL),
      inject: [TOKENS.CONFIG],
    },
    AccessService,
    AuditService,
  ],
  exports: [
    TOKENS.CONFIG,
    TOKENS.LOGGER,
    TOKENS.DB,
    TOKENS.STORAGE,
    TOKENS.QUEUES,
    TOKENS.ADAPTERS,
    TOKENS.REALTIME,
    AccessService,
    AuditService,
  ],
})
export class CoreModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    @Inject(TOKENS.STORAGE) private readonly storage: ObjectStorage,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.ensureBuckets();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queues.close();
    await this.realtime.close();
    await closeDb();
  }
}

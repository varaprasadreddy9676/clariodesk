import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { ObjectStorage, rawEventKey } from "@clariodesk/storage";
import type { Logger } from "@clariodesk/logger";
import type { GatewayAdapterType } from "@clariodesk/types";
import { TOKENS } from "../tokens.js";
import { AdapterFactory } from "../core/adapters.js";
import { QueueRegistry, QUEUE } from "../core/queues.js";
import { JOB_PRIORITY_LIVE } from "./constants.js";

/**
 * Ingest a raw gateway webhook (TDD §8.1). The endpoint must return quickly, so
 * this does the minimum synchronously — persist the raw payload safely, then
 * enqueue normalization — and lets the worker do the heavy lifting.
 */
@Injectable()
export class WebhooksService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.STORAGE) private readonly storage: ObjectStorage,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    @Inject(TOKENS.ADAPTERS) private readonly adapters: AdapterFactory,
    @Inject(TOKENS.LOGGER) private readonly logger: Logger,
  ) {}

  async ingest(
    adapterType: GatewayAdapterType,
    phoneReference: string,
    payload: unknown,
  ): Promise<{ accepted: number }> {
    const referenceWhere = isUuid(phoneReference)
      ? or(
          eq(schema.phoneInstances.id, phoneReference),
          eq(schema.phoneInstances.providerInstanceId, phoneReference),
        )
      : eq(schema.phoneInstances.providerInstanceId, phoneReference);
    const phone = await this.db
      .select({
        id: schema.phoneInstances.id,
        workspaceId: schema.phoneInstances.workspaceId,
        status: schema.phoneInstances.status,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
      })
      .from(schema.phoneInstances)
      .where(
        and(eq(schema.phoneInstances.adapterType, adapterType), referenceWhere),
      )
      .limit(1);
    const p = phone[0];
    if (!p) throw new NotFoundException("Unknown phone instance");

    const log = this.logger.child({
      workspace_id: p.workspaceId,
      phone_instance_id: p.id,
      adapter_type: adapterType,
    });

    // 1. Persist the raw payload to object storage (not Postgres) + metadata row.
    const eventId = randomUUID();
    const now = new Date();
    const objectKey = rawEventKey(p.workspaceId, eventId, now);
    let size = 0;
    try {
      size = await this.storage.putRawEvent(objectKey, payload);
    } catch (err) {
      // Don't lose the event: still record the ref so it can be reprocessed.
      log.error({ err: String(err) }, "raw payload upload failed");
    }
    const [ref] = await this.db
      .insert(schema.rawEventRefs)
      .values({
        workspaceId: p.workspaceId,
        phoneInstanceId: p.id,
        adapterType,
        providerEventId: eventId,
        eventType: extractEventType(payload),
        objectKey,
        compressedSizeBytes: size,
        processingStatus: "received",
      })
      .returning({ id: schema.rawEventRefs.id });

    // 2. Normalize (pure) then hand off to the worker.
    const adapter = this.adapters.normalizer(adapterType);
    const events = adapter.normalizeWebhook({
      providerInstanceId: p.providerInstanceId ?? p.id,
      payload,
    });

    if (events.length > 0 && ref) {
      await this.queues.messageNormalization.add(
        QUEUE.messageNormalization,
        {
          workspaceId: p.workspaceId,
          phoneInstanceId: p.id,
          rawEventRefId: ref.id,
          events,
          isReconnectSync: p.status === "syncing",
        },
        {
          priority: JOB_PRIORITY_LIVE,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
        },
      );
    }

    return { accepted: events.length };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function extractEventType(payload: unknown): string {
  if (payload && typeof payload === "object" && "event" in payload) {
    const e = (payload as { event?: unknown }).event;
    if (typeof e === "string") return e;
  }
  return "webhook";
}

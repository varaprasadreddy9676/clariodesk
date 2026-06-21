import { and, eq, lt, sql } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import type { Logger } from "@clariodesk/logger";

export type JobDeps = {
  db: Database;
  storage: ObjectStorage;
  logger: Logger;
  config: {
    RAW_EVENT_RETENTION_DAYS: number;
    MESSAGE_RETENTION_DAYS: number;
    MEDIA_RETENTION_DAYS: number;
    PHONE_STALE_MINUTES: number;
    STALE_SYNC_THRESHOLD_SECONDS: number;
  };
};

const PURGE_PLACEHOLDER =
  "[Message contents purged by workspace retention policy]";
const BATCH = 500;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Hard-purge raw event payloads + metadata past retention (TDD §17.1). */
export async function purgeRawEvents(deps: JobDeps): Promise<number> {
  const cutoff = daysAgo(deps.config.RAW_EVENT_RETENTION_DAYS);
  const rows = await deps.db
    .select({
      id: schema.rawEventRefs.id,
      objectKey: schema.rawEventRefs.objectKey,
    })
    .from(schema.rawEventRefs)
    .where(lt(schema.rawEventRefs.createdAt, cutoff))
    .limit(BATCH);

  for (const row of rows) {
    await deps.storage.deleteRawEvent(row.objectKey).catch(() => undefined);
    await deps.db
      .delete(schema.rawEventRefs)
      .where(eq(schema.rawEventRefs.id, row.id));
  }
  if (rows.length)
    deps.logger.info({ count: rows.length }, "purged raw events");
  return rows.length;
}

/**
 * Purge unlinked media past retention; ticket-linked media is left to the ticket
 * policy (TDD §17.4). Deletes the object and marks the row purged.
 */
export async function purgeMedia(deps: JobDeps): Promise<number> {
  const cutoff = daysAgo(deps.config.MEDIA_RETENTION_DAYS);
  const rows = await deps.db
    .select({
      id: schema.messageMedia.id,
      storageKey: schema.messageMedia.storageKey,
    })
    .from(schema.messageMedia)
    .where(
      and(
        lt(schema.messageMedia.createdAt, cutoff),
        sql`${schema.messageMedia.messageId} not in (select message_id from ticket_messages)`,
        sql`${schema.messageMedia.storageStatus} <> 'purged'`,
      ),
    )
    .limit(BATCH);

  for (const row of rows) {
    if (row.storageKey) {
      await deps.storage.deleteMedia(row.storageKey).catch(() => undefined);
    }
    await deps.db
      .update(schema.messageMedia)
      .set({ storageStatus: "purged", storageKey: null, updatedAt: new Date() })
      .where(eq(schema.messageMedia.id, row.id));
  }
  if (rows.length) deps.logger.info({ count: rows.length }, "purged media");
  return rows.length;
}

/**
 * Retention for messages (TDD §17.2/§17.3). Ticket-linked messages keep a
 * metadata shell with the body replaced by a placeholder; unlinked messages
 * past retention are hard-deleted.
 */
export async function purgeMessages(deps: JobDeps): Promise<void> {
  // Bind the cutoff as an ISO string + explicit cast: a raw Date interpolated
  // into a sql fragment leaves postgres-js without a type to serialize.
  const cutoff = daysAgo(deps.config.MESSAGE_RETENTION_DAYS).toISOString();

  // 1. Soft-purge ticket-linked messages: keep the shell, drop the contents.
  await deps.db.execute(sql`
    update messages set body = ${PURGE_PLACEHOLDER}, status = 'purged', updated_at = now()
    where created_at < ${cutoff}::timestamptz
      and status <> 'purged'
      and (
        id in (select message_id from ticket_messages)
        or id in (select source_message_id from tickets where source_message_id is not null)
      )
  `);

  // 2. Hard-delete unlinked messages past retention.
  await deps.db.execute(sql`
    delete from messages
    where created_at < ${cutoff}::timestamptz
      and id not in (select message_id from ticket_messages)
      and id not in (select source_message_id from tickets where source_message_id is not null)
  `);
  deps.logger.info("message retention pass complete");
}

/**
 * Phone health (TDD §5.4): a phone marked connected but not seen recently is
 * degraded; one stuck syncing past the stale threshold is also degraded.
 */
export async function checkPhoneHealth(deps: JobDeps): Promise<number> {
  const staleSeen = new Date(
    Date.now() - deps.config.PHONE_STALE_MINUTES * 60 * 1000,
  );
  const staleSync = new Date(
    Date.now() - deps.config.STALE_SYNC_THRESHOLD_SECONDS * 1000,
  );

  const degradedSeen = await deps.db
    .update(schema.phoneInstances)
    .set({ status: "degraded", updatedAt: new Date() })
    .where(
      and(
        eq(schema.phoneInstances.status, "connected"),
        lt(schema.phoneInstances.lastSeenAt, staleSeen),
      ),
    )
    .returning({ id: schema.phoneInstances.id });

  const degradedSync = await deps.db
    .update(schema.phoneInstances)
    .set({ status: "degraded", updatedAt: new Date() })
    .where(
      and(
        eq(schema.phoneInstances.status, "syncing"),
        lt(schema.phoneInstances.updatedAt, staleSync),
      ),
    )
    .returning({ id: schema.phoneInstances.id });

  const total = degradedSeen.length + degradedSync.length;
  if (total) deps.logger.warn({ count: total }, "phones marked degraded");
  return total;
}

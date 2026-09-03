import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import type { Logger } from "@clariodesk/logger";
import { GatewayAdapterFactory } from "@clariodesk/gateway-adapters";
import type { PhoneStatus } from "@clariodesk/types";

export type JobDeps = {
  db: Database;
  storage: ObjectStorage;
  logger: Logger;
  adapters: GatewayAdapterFactory;
  config: {
    RAW_EVENT_RETENTION_DAYS: number;
    MESSAGE_RETENTION_DAYS: number;
    MEDIA_RETENTION_DAYS: number;
    PHONE_STALE_MINUTES: number;
    STALE_SYNC_THRESHOLD_SECONDS: number;
  };
};

/**
 * Maps a gateway connection status onto our phone-instance status enum.
 * Mirrors apps/api/src/phones/phones.service.ts's STATUS_MAP — kept as a
 * small local copy rather than a shared package export since it's a 6-line
 * constant and the two apps otherwise share no adapter-facing code.
 */
const STATUS_MAP: Record<string, PhoneStatus> = {
  connected: "connected",
  syncing: "syncing",
  disconnected: "disconnected",
  qr_required: "qr_required",
  degraded: "degraded",
  restricted: "restricted",
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
 * Refresh `lastSeenAt` for phones the app already believes are
 * connected/syncing, by actively polling the gateway for live status.
 *
 * Without this, `lastSeenAt` is only ever written by user-triggered API
 * calls (connect/status/syncGroups in phones.service.ts) or the frontend's
 * QR/syncing poll — which stops polling once a phone reaches "connected".
 * A perfectly healthy phone that simply has no operator interaction for
 * PHONE_STALE_MINUTES would then be falsely flagged "degraded" by
 * checkPhoneHealth below, purely from inactivity. This job closes that gap
 * by heartbeating every connected/syncing phone directly against the
 * gateway before staleness is evaluated. A phone whose gateway call fails
 * (e.g. genuinely unreachable) is left alone, so it can still correctly go
 * stale and degrade.
 */
export async function refreshConnectedPhones(deps: JobDeps): Promise<number> {
  const phones = await deps.db
    .select({
      id: schema.phoneInstances.id,
      status: schema.phoneInstances.status,
      adapterType: schema.phoneInstances.adapterType,
      providerInstanceId: schema.phoneInstances.providerInstanceId,
      gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
      encryptedApiKey: schema.phoneInstances.encryptedApiKey,
    })
    .from(schema.phoneInstances)
    .where(
      inArray(schema.phoneInstances.status, ["connected", "syncing"] as const),
    );

  let refreshed = 0;
  for (const phone of phones) {
    try {
      const adapter = deps.adapters.forPhone(phone);
      if (!adapter.getConnectionInfo && !adapter.getConnectionStatus) continue;
      const live = adapter.getConnectionInfo
        ? await adapter.getConnectionInfo({
            providerInstanceId: phone.providerInstanceId ?? phone.id,
          })
        : {
            status: await adapter.getConnectionStatus!({
              providerInstanceId: phone.providerInstanceId ?? phone.id,
            }),
          };
      const liveStatus = STATUS_MAP[live.status] ?? "degraded";
      // A ready transport can still be mid-import; don't downgrade syncing
      // to connected here — that transition belongs to the sync job itself.
      const mapped =
        phone.status === "syncing" && liveStatus === "connected"
          ? "syncing"
          : liveStatus;
      await deps.db
        .update(schema.phoneInstances)
        .set({
          status: mapped,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.phoneInstances.id, phone.id));
      refreshed += 1;
    } catch (err) {
      deps.logger.warn(
        { phoneId: phone.id, err: String(err) },
        "phone heartbeat failed",
      );
    }
  }
  return refreshed;
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

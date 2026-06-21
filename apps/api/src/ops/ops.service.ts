import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { assertAdmin } from "../common/roles.js";
import type { QueueRegistry } from "../core/queues.js";

const QUEUE_COUNT_TYPES = [
  "waiting",
  "delayed",
  "active",
  "failed",
  "paused",
] as const;

type QueueCounts = Record<(typeof QUEUE_COUNT_TYPES)[number], number>;
type CountRow = { count: number | string | null };
type StatusCountRow = { status: string; count: number | string | null };
type CountableQueue = {
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
};

@Injectable()
export class OpsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
  ) {}

  /** Admin-only operational summary for pilot dashboards and health triage. */
  async summary(user: AuthUser) {
    assertAdmin(user);

    const [
      phones,
      phoneStatusRows,
      unmappedChannels,
      awaitingResponseChannels,
      ticketStatusRows,
      outboxStatusRows,
      recentOutboxFailures,
      pendingMetadataEvents,
      queueCounts,
    ] = await Promise.all([
      this.db
        .select({
          id: schema.phoneInstances.id,
          displayName: schema.phoneInstances.displayName,
          adapterType: schema.phoneInstances.adapterType,
          status: schema.phoneInstances.status,
          riskLevel: schema.phoneInstances.riskLevel,
          lastSeenAt: schema.phoneInstances.lastSeenAt,
          lastSyncAt: schema.phoneInstances.lastSyncAt,
        })
        .from(schema.phoneInstances)
        .where(
          and(
            eq(schema.phoneInstances.workspaceId, user.workspaceId),
            eq(schema.phoneInstances.adapterType, "clario_gateway"),
          ),
        )
        .orderBy(schema.phoneInstances.displayName),
      this.db
        .select({
          status: schema.phoneInstances.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.phoneInstances)
        .where(
          and(
            eq(schema.phoneInstances.workspaceId, user.workspaceId),
            eq(schema.phoneInstances.adapterType, "clario_gateway"),
          ),
        )
        .groupBy(schema.phoneInstances.status),
      this.countRows(
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.channels)
          .innerJoin(
            schema.phoneInstances,
            eq(schema.phoneInstances.id, schema.channels.phoneInstanceId),
          )
          .where(
            and(
              eq(schema.channels.workspaceId, user.workspaceId),
              eq(schema.phoneInstances.adapterType, "clario_gateway"),
              eq(schema.channels.status, "unmapped"),
            ),
          ),
      ),
      this.countRows(
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.channels)
          .innerJoin(
            schema.phoneInstances,
            eq(schema.phoneInstances.id, schema.channels.phoneInstanceId),
          )
          .where(
            and(
              eq(schema.channels.workspaceId, user.workspaceId),
              eq(schema.phoneInstances.adapterType, "clario_gateway"),
              isNotNull(schema.channels.awaitingResponseSince),
            ),
          ),
      ),
      this.db
        .select({
          status: schema.tickets.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.tickets)
        .where(eq(schema.tickets.workspaceId, user.workspaceId))
        .groupBy(schema.tickets.status),
      this.db
        .select({
          status: schema.outboxMessages.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.outboxMessages)
        .where(eq(schema.outboxMessages.workspaceId, user.workspaceId))
        .groupBy(schema.outboxMessages.status),
      this.db
        .select({
          id: schema.outboxMessages.id,
          channelId: schema.outboxMessages.channelId,
          failureReason: schema.outboxMessages.failureReason,
          updatedAt: schema.outboxMessages.updatedAt,
        })
        .from(schema.outboxMessages)
        .where(
          and(
            eq(schema.outboxMessages.workspaceId, user.workspaceId),
            eq(schema.outboxMessages.status, "failed"),
          ),
        )
        .orderBy(desc(schema.outboxMessages.updatedAt))
        .limit(10),
      this.countRows(
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.groupMetadataEvents)
          .where(
            and(
              eq(schema.groupMetadataEvents.workspaceId, user.workspaceId),
              eq(schema.groupMetadataEvents.reviewStatus, "pending"),
            ),
          ),
      ),
      this.queueSummary(),
    ]);

    const ticketCounts = toCountRecord(ticketStatusRows);
    return {
      generatedAt: new Date().toISOString(),
      phones: {
        byStatus: toCountRecord(phoneStatusRows),
        items: phones,
      },
      channels: {
        unmapped: unmappedChannels,
        awaitingResponse: awaitingResponseChannels,
      },
      tickets: {
        byStatus: ticketCounts,
        open: ticketCounts.open ?? 0,
        pending: ticketCounts.pending ?? 0,
      },
      outbox: {
        byStatus: toCountRecord(outboxStatusRows),
        recentFailures: recentOutboxFailures,
      },
      registry: {
        pendingMetadataEvents,
      },
      queues: queueCounts,
    };
  }

  /** Prometheus-style text output for the current operational summary. */
  async metrics(user: AuthUser) {
    const summary = await this.summary(user);
    const ws = labelValue(user.workspaceId);
    const lines = [
      "# HELP clariodesk_phone_status_count Number of phones by status",
      "# TYPE clariodesk_phone_status_count gauge",
      ...Object.entries(summary.phones.byStatus).map(
        ([status, value]) =>
          `clariodesk_phone_status_count{workspace="${ws}",status="${labelValue(status)}"} ${value}`,
      ),
      "# HELP clariodesk_channel_unmapped_count Number of unmapped channels",
      "# TYPE clariodesk_channel_unmapped_count gauge",
      `clariodesk_channel_unmapped_count{workspace="${ws}"} ${summary.channels.unmapped}`,
      "# HELP clariodesk_channel_awaiting_response_count Number of channels awaiting response",
      "# TYPE clariodesk_channel_awaiting_response_count gauge",
      `clariodesk_channel_awaiting_response_count{workspace="${ws}"} ${summary.channels.awaitingResponse}`,
      "# HELP clariodesk_ticket_count Number of tickets by status",
      "# TYPE clariodesk_ticket_count gauge",
      ...Object.entries(summary.tickets.byStatus).map(
        ([status, value]) =>
          `clariodesk_ticket_count{workspace="${ws}",status="${labelValue(status)}"} ${value}`,
      ),
      "# HELP clariodesk_outbox_count Number of outbox messages by status",
      "# TYPE clariodesk_outbox_count gauge",
      ...Object.entries(summary.outbox.byStatus).map(
        ([status, value]) =>
          `clariodesk_outbox_count{workspace="${ws}",status="${labelValue(status)}"} ${value}`,
      ),
      "# HELP clariodesk_queue_depth Number of jobs in each queue state",
      "# TYPE clariodesk_queue_depth gauge",
    ];

    for (const [queueName, counts] of Object.entries(summary.queues)) {
      for (const [state, value] of Object.entries(counts)) {
        lines.push(
          `clariodesk_queue_depth{workspace="${ws}",queue="${labelValue(queueName)}",state="${labelValue(state)}"} ${value}`,
        );
      }
    }

    return `${lines.join("\n")}\n`;
  }

  private async countRows(query: Promise<CountRow[]>): Promise<number> {
    const rows = await query;
    return Number(rows[0]?.count ?? 0);
  }

  private async queueSummary() {
    const [
      messageNormalization,
      mediaDownloadLive,
      mediaDownloadBackfill,
      outboxSend,
    ] = await Promise.all([
      this.queueCounts(this.queues.messageNormalization),
      this.queueCounts(this.queues.mediaDownloadLive),
      this.queueCounts(this.queues.mediaDownloadBackfill),
      this.queueCounts(this.queues.outboxSend),
    ]);
    return {
      messageNormalization,
      mediaDownloadLive,
      mediaDownloadBackfill,
      outboxSend,
    };
  }

  private async queueCounts(queue: CountableQueue): Promise<QueueCounts> {
    const counts = await queue.getJobCounts(...QUEUE_COUNT_TYPES);
    return {
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      paused: counts.paused ?? 0,
    };
  }
}

function toCountRecord(rows: StatusCountRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.status] = Number(row.count ?? 0);
  }
  return out;
}

function labelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

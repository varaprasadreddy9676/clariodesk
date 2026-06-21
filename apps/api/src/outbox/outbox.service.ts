import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import type { SendReplyInput } from "@clariodesk/schemas";
import { RealtimePublisher } from "@clariodesk/events";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { QueueRegistry, QUEUE } from "../core/queues.js";

@Injectable()
export class OutboxService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create an outbound reply through the outbox (TDD §10). The message is held
   * for the configured send-delay before dispatch so it can still be cancelled —
   * this is a delay, not a true undo (§10.3). Never sends directly to a gateway.
   */
  async send(user: AuthUser, input: SendReplyInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot send replies");
    }
    await this.access.assertChannelAccess(user, input.channelId);

    const channel = await this.db
      .select({
        phoneInstanceId: schema.channels.phoneInstanceId,
        status: schema.channels.status,
      })
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.id, input.channelId),
          eq(schema.channels.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!channel[0]) throw new NotFoundException("Channel not found");

    const mapping = await this.db
      .select({
        mappingMode: schema.channelMappings.mappingMode,
        clientId: schema.channelMappings.clientId,
      })
      .from(schema.channelMappings)
      .where(
        and(
          eq(schema.channelMappings.channelId, input.channelId),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .limit(1);
    const delayMs = input.useSendDelay ? this.config.SEND_DELAY_MS : 0;
    const sendAfter = new Date(Date.now() + delayMs);

    const [row] = await this.db
      .insert(schema.outboxMessages)
      .values({
        workspaceId: user.workspaceId,
        channelId: input.channelId,
        clientId: mapping[0]?.clientId ?? null,
        phoneInstanceId: channel[0].phoneInstanceId,
        createdByUserId: user.userId,
        messageType: "text",
        body: input.body,
        quotedMessageId: input.quotedMessageId ?? null,
        sendMode: delayMs > 0 ? "delayed" : "immediate",
        sendAfter,
        status: delayMs > 0 ? "waiting_delay" : "pending",
      })
      .returning({ id: schema.outboxMessages.id });
    if (!row) throw new Error("failed to create outbox row");

    // jobId = outbox id so we can remove it if the user cancels within the window.
    await this.queues.outboxSend.add(
      QUEUE.outboxSend,
      { workspaceId: user.workspaceId, outboxId: row.id },
      {
        jobId: row.id,
        delay: delayMs,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "message.queued",
      targetType: "channel",
      targetId: input.channelId,
      metadata: { outboxId: row.id, delayMs },
    });
    await this.realtime.publish({
      type: "outbox.status_changed",
      workspaceId: user.workspaceId,
      channelId: input.channelId,
      payload: {
        outboxId: row.id,
        status: delayMs > 0 ? "waiting_delay" : "pending",
      },
    });

    return {
      outboxId: row.id,
      sendAfter: sendAfter.toISOString(),
      cancellableForMs: delayMs,
    };
  }

  /** Cancel a queued reply while it is still within the send-delay window. */
  async cancel(user: AuthUser, outboxId: string) {
    const rows = await this.db
      .select({
        status: schema.outboxMessages.status,
        channelId: schema.outboxMessages.channelId,
      })
      .from(schema.outboxMessages)
      .where(
        and(
          eq(schema.outboxMessages.id, outboxId),
          eq(schema.outboxMessages.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Outbox message not found");
    await this.access.assertChannelAccess(user, row.channelId);

    if (row.status !== "waiting_delay" && row.status !== "pending") {
      throw new BadRequestException(
        `Cannot cancel — message is already ${row.status}`,
      );
    }

    await this.db
      .update(schema.outboxMessages)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(schema.outboxMessages.id, outboxId));
    // Best-effort removal of the delayed job.
    await this.queues.outboxSend.remove(outboxId).catch(() => undefined);

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "message.cancelled",
      targetType: "outbox",
      targetId: outboxId,
    });
    await this.realtime.publish({
      type: "outbox.status_changed",
      workspaceId: user.workspaceId,
      channelId: row.channelId,
      payload: { outboxId, status: "cancelled" },
    });
    return { ok: true };
  }
}

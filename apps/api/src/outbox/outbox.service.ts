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
import type { SendMediaCommandInput } from "@clariodesk/schemas";
import { RealtimePublisher } from "@clariodesk/events";
import { ObjectStorage, mediaKey } from "@clariodesk/storage";
import { randomUUID, createHash } from "node:crypto";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { QueueRegistry, QUEUE } from "../core/queues.js";

@Injectable()
export class OutboxService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.STORAGE) private readonly storage: ObjectStorage,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async sendMedia(user: AuthUser, input: SendMediaCommandInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot send attachments");
    }
    await this.access.assertChannelAccess(user, input.channelId);
    const [existing] = await this.db
      .select({ id: schema.outboxMessages.id })
      .from(schema.outboxMessages)
      .where(
        and(
          eq(schema.outboxMessages.workspaceId, user.workspaceId),
          eq(schema.outboxMessages.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) {
      return {
        outboxId: existing.id,
        sendAfter: new Date().toISOString(),
        cancellableForMs: 0,
      };
    }

    if (
      input.mediaBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.mediaBase64)
    ) {
      throw new BadRequestException("Attachment data is not valid base64");
    }
    const bytes = Uint8Array.from(Buffer.from(input.mediaBase64, "base64"));
    if (!bytes.byteLength || bytes.byteLength > 16 * 1024 * 1024) {
      throw new BadRequestException(
        "Attachment must be between 1 byte and 16 MB",
      );
    }
    if (!contentMatchesMime(bytes, input.mimeType)) {
      throw new BadRequestException(
        "Attachment content does not match its declared file type",
      );
    }
    const [channel] = await this.db
      .select({
        phoneInstanceId: schema.channels.phoneInstanceId,
        clientId: schema.channelMappings.clientId,
      })
      .from(schema.channels)
      .leftJoin(
        schema.channelMappings,
        and(
          eq(schema.channelMappings.channelId, schema.channels.id),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .where(
        and(
          eq(schema.channels.id, input.channelId),
          eq(schema.channels.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!channel) throw new NotFoundException("Channel not found");

    const outboxId = randomUUID();
    const mediaId = randomUUID();
    const now = new Date();
    const storageKey = mediaKey({
      workspaceId: user.workspaceId,
      clientId: channel.clientId ?? null,
      channelId: input.channelId,
      messageId: outboxId,
      mediaId,
      at: now,
    });
    await this.storage.putMedia(storageKey, bytes, input.mimeType);
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(schema.messageMedia).values({
          id: mediaId,
          workspaceId: user.workspaceId,
          messageId: null,
          clientId: channel.clientId ?? null,
          channelId: input.channelId,
          storageKey,
          fileName: sanitizeFileName(input.fileName),
          mimeType: input.mimeType,
          sizeBytes: bytes.byteLength,
          sha256Hash: createHash("sha256").update(bytes).digest("hex"),
          mediaType: mediaTypeForMime(input.mimeType),
          storageStatus: "downloaded",
          source: "upload",
        });
        await tx.insert(schema.outboxMessages).values({
          id: outboxId,
          workspaceId: user.workspaceId,
          channelId: input.channelId,
          clientId: channel.clientId ?? null,
          phoneInstanceId: channel.phoneInstanceId,
          createdByUserId: user.userId,
          messageType: mediaTypeForMime(input.mimeType),
          body: input.body || null,
          mediaId,
          idempotencyKey: input.idempotencyKey,
          sendMode: "immediate",
          sendAfter: now,
          status: "pending",
        });
      });
    } catch (error) {
      await this.storage.deleteMedia(storageKey).catch(() => undefined);
      throw error;
    }
    await this.queues.outboxSend.add(
      QUEUE.outboxSend,
      { workspaceId: user.workspaceId, outboxId },
      {
        jobId: outboxId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "media.queued",
      targetType: "channel",
      targetId: input.channelId,
      metadata: { outboxId, mediaId, mimeType: input.mimeType },
    });
    await this.realtime.publish({
      type: "outbox.status_changed",
      workspaceId: user.workspaceId,
      channelId: input.channelId,
      payload: { outboxId, status: "pending" },
    });
    return { outboxId, sendAfter: now.toISOString(), cancellableForMs: 0 };
  }

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

    if (input.idempotencyKey) {
      const [existing] = await this.db
        .select({
          id: schema.outboxMessages.id,
          sendAfter: schema.outboxMessages.sendAfter,
          status: schema.outboxMessages.status,
        })
        .from(schema.outboxMessages)
        .where(
          and(
            eq(schema.outboxMessages.workspaceId, user.workspaceId),
            eq(schema.outboxMessages.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          outboxId: existing.id,
          sendAfter:
            existing.sendAfter?.toISOString() ?? new Date().toISOString(),
          cancellableForMs:
            existing.status === "waiting_delay" ? this.config.SEND_DELAY_MS : 0,
        };
      }
    }

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
        idempotencyKey: input.idempotencyKey ?? null,
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

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/\0\r\n]/g, "_").slice(0, 255);
}

function mediaTypeForMime(
  mimeType: string,
): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function contentMatchesMime(bytes: Uint8Array, mimeType: string): boolean {
  const buffer = Buffer.from(bytes);
  switch (mimeType) {
    case "image/png":
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/gif":
      return /^(GIF87a|GIF89a)$/.test(buffer.subarray(0, 6).toString("ascii"));
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "video/mp4":
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "audio/ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";
    case "audio/mpeg":
      return (
        buffer.subarray(0, 3).toString("ascii") === "ID3" ||
        (buffer[0] === 0xff &&
          buffer[1] !== undefined &&
          (buffer[1] & 0xe0) === 0xe0)
      );
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "text/plain":
      return !buffer.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

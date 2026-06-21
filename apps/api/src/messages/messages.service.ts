import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import type {
  CursorPagination,
  CreateInternalNoteInput,
} from "@clariodesk/schemas";
import { RealtimePublisher } from "@clariodesk/events";
import type { GatewayChatMessage } from "@clariodesk/gateway-adapters";
import type { NormalizedGatewayEvent } from "@clariodesk/types";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { AdapterFactory } from "../core/adapters.js";
import { QUEUE, QueueRegistry } from "../core/queues.js";

@Injectable()
export class MessagesService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
    @Inject(TOKENS.ADAPTERS) private readonly adapters: AdapterFactory,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** Cursor-paginated channel timeline, newest first (TDD §20.3). */
  async timeline(user: AuthUser, channelId: string, page: CursorPagination) {
    await this.access.assertChannelAccess(user, channelId);

    const cursor =
      page.beforeProviderTimestampMs !== undefined
        ? lt(
            schema.messages.providerTimestamp,
            new Date(page.beforeProviderTimestampMs),
          )
        : undefined;

    const messageRows = await this.db
      .select({
        id: schema.messages.id,
        body: schema.messages.body,
        messageType: schema.messages.messageType,
        direction: schema.messages.direction,
        sentByType: schema.messages.sentByType,
        senderName: schema.contacts.canonicalName,
        providerTimestamp: schema.messages.providerTimestamp,
        isBackfill: schema.messages.isBackfill,
        status: schema.messages.status,
      })
      .from(schema.messages)
      .leftJoin(
        schema.contacts,
        eq(schema.contacts.id, schema.messages.senderContactId),
      )
      .where(
        cursor
          ? and(
              eq(schema.messages.workspaceId, user.workspaceId),
              eq(schema.messages.channelId, channelId),
              cursor,
            )
          : and(
              eq(schema.messages.workspaceId, user.workspaceId),
              eq(schema.messages.channelId, channelId),
            ),
      )
      .orderBy(desc(schema.messages.providerTimestamp))
      .limit(page.limit);

    const noteRows = await this.db
      .select({
        id: schema.internalNotes.id,
        body: schema.internalNotes.body,
        providerTimestamp: schema.internalNotes.createdAt,
        authorUserId: schema.internalNotes.authorUserId,
      })
      .from(schema.internalNotes)
      .where(
        cursor
          ? and(
              eq(schema.internalNotes.workspaceId, user.workspaceId),
              eq(schema.internalNotes.channelId, channelId),
              lt(
                schema.internalNotes.createdAt,
                new Date(page.beforeProviderTimestampMs!),
              ),
            )
          : and(
              eq(schema.internalNotes.workspaceId, user.workspaceId),
              eq(schema.internalNotes.channelId, channelId),
            ),
      )
      .orderBy(desc(schema.internalNotes.createdAt))
      .limit(page.limit);

    const rowsWithoutMedia = [
      ...messageRows,
      ...noteRows.map((note) => ({
        id: note.id,
        body: note.body,
        messageType: "text" as const,
        direction: "note" as const,
        sentByType: "dashboard_agent" as const,
        senderName: null,
        providerTimestamp: note.providerTimestamp,
        isBackfill: false,
        status: "received" as const,
        media: [],
      })),
    ]
      .sort(
        (a, b) => b.providerTimestamp.getTime() - a.providerTimestamp.getTime(),
      )
      .slice(0, page.limit);

    const messageIds = rowsWithoutMedia
      .filter((row) => row.direction !== "note")
      .map((row) => row.id);
    const mediaRows = messageIds.length
      ? await this.db
          .select({
            id: schema.messageMedia.id,
            messageId: schema.messageMedia.messageId,
            mediaType: schema.messageMedia.mediaType,
            mimeType: schema.messageMedia.mimeType,
            fileName: schema.messageMedia.fileName,
            storageStatus: schema.messageMedia.storageStatus,
          })
          .from(schema.messageMedia)
          .where(inArray(schema.messageMedia.messageId, messageIds))
      : [];
    const mediaByMessage = new Map<string, typeof mediaRows>();
    for (const media of mediaRows) {
      if (!media.messageId) continue;
      const items = mediaByMessage.get(media.messageId) ?? [];
      items.push(media);
      mediaByMessage.set(media.messageId, items);
    }
    const rows = rowsWithoutMedia.map((row) => ({
      ...row,
      media: mediaByMessage.get(row.id) ?? [],
    }));

    const nextCursor =
      rows.length === page.limit
        ? rows[rows.length - 1]?.providerTimestamp.getTime()
        : null;
    return { messages: rows, nextCursor };
  }

  /** Add an internal note — NEVER sent to WhatsApp (TDD §15.2). */
  async createNote(user: AuthUser, input: CreateInternalNoteInput) {
    await this.access.assertChannelAccess(user, input.channelId);
    const [note] = await this.db
      .insert(schema.internalNotes)
      .values({
        workspaceId: user.workspaceId,
        channelId: input.channelId,
        ticketId: input.ticketId ?? null,
        authorUserId: user.userId,
        body: input.body,
      })
      .returning({ id: schema.internalNotes.id });

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "note.created",
      targetType: "channel",
      targetId: input.channelId,
    });
    await this.realtime.publish({
      type: "note.created",
      workspaceId: user.workspaceId,
      channelId: input.channelId,
      payload: { noteId: note?.id },
    });
    return note;
  }

  async react(user: AuthUser, messageId: string, reaction: string) {
    const [row] = await this.db
      .select({
        channelId: schema.messages.channelId,
        providerMessageId: schema.messages.providerMessageId,
        providerChatId: schema.messages.providerChatId,
        phoneInstanceId: schema.messages.phoneInstanceId,
        adapterType: schema.phoneInstances.adapterType,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        encryptedApiKey: schema.phoneInstances.encryptedApiKey,
      })
      .from(schema.messages)
      .innerJoin(
        schema.phoneInstances,
        eq(schema.phoneInstances.id, schema.messages.phoneInstanceId),
      )
      .where(
        and(
          eq(schema.messages.id, messageId),
          eq(schema.messages.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Message not found");
    await this.access.assertChannelAccess(user, row.channelId);
    const adapter = this.adapters.forPhone(row);
    if (!adapter.reactToMessage) {
      throw new BadRequestException("Gateway does not support reactions");
    }
    await adapter.reactToMessage({
      providerInstanceId: row.providerInstanceId ?? row.phoneInstanceId,
      providerChatId: row.providerChatId,
      providerMessageId: row.providerMessageId,
      reaction,
    });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "message.reacted",
      targetType: "message",
      targetId: messageId,
      metadata: { reaction },
    });
    return { ok: true as const };
  }

  /**
   * Dev-only helper for browser coverage and local demos. Seeds one inbound
   * timeline message so the UI can exercise ticket, note, and reply actions
   * against a real API-backed channel.
   */
  async seedDemoMessage(
    user: AuthUser,
    channelId: string,
    body = "Need help with the onboarding checklist.",
  ) {
    if (this.config.NODE_ENV === "production") {
      throw new Error("Demo message seeding is disabled in production");
    }
    if (user.role !== "admin") {
      throw new Error("Only admins may seed demo messages");
    }
    await this.access.assertChannelAccess(user, channelId);

    const rows = await this.db
      .select({
        channelId: schema.channels.id,
        workspaceId: schema.channels.workspaceId,
        phoneInstanceId: schema.channels.phoneInstanceId,
        providerChatId: schema.channels.providerChatId,
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
      .where(eq(schema.channels.id, channelId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error("Channel not found");

    const now = new Date();
    const providerMessageId = `demo-${randomUUID()}`;
    await this.db
      .insert(schema.messages)
      .values({
        workspaceId: row.workspaceId,
        channelId: row.channelId,
        clientId: row.clientId ?? null,
        phoneInstanceId: row.phoneInstanceId,
        providerMessageId,
        providerChatId: row.providerChatId,
        messageType: "text",
        direction: "inbound",
        sentByType: "client_user",
        body,
        providerTimestamp: now,
        isBackfill: false,
        isLiveEvent: true,
        automationSuppressed: false,
        slaEligible: true,
        ticketAutoCreateEligible: true,
        status: "received",
      })
      .onConflictDoNothing();

    await this.db
      .update(schema.channels)
      .set({
        lastMessageAt: now,
        awaitingResponseSince: now,
        status: "active",
        updatedAt: now,
      })
      .where(eq(schema.channels.id, channelId));

    await this.realtime.publish({
      type: "message.received",
      workspaceId: row.workspaceId,
      channelId,
      payload: { providerMessageId, body },
    });

    return {
      ok: true,
      providerMessageId,
      providerTimestamp: now.toISOString(),
    };
  }

  /**
   * Pull recent chat history from a capable linked-device gateway and enqueue it
   * through the normal worker pipeline. This is intentionally history sync, not
   * live ingest, so backfill safety rules suppress SLA/automation.
   */
  async syncMessages(
    user: AuthUser,
    channelId: string,
    requestedLimit: number,
  ) {
    await this.access.assertChannelAccess(user, channelId);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
      : 50;

    const [row] = await this.db
      .select({
        channelId: schema.channels.id,
        providerChatId: schema.channels.providerChatId,
        channelType: schema.channels.channelType,
        phoneInstanceId: schema.channels.phoneInstanceId,
        adapterType: schema.phoneInstances.adapterType,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        encryptedApiKey: schema.phoneInstances.encryptedApiKey,
      })
      .from(schema.channels)
      .innerJoin(
        schema.phoneInstances,
        eq(schema.phoneInstances.id, schema.channels.phoneInstanceId),
      )
      .where(
        and(
          eq(schema.channels.id, channelId),
          eq(schema.channels.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);

    if (!row) return { accepted: 0, reason: "channel_not_found" };

    const adapter = this.adapters.forPhone({
      adapterType: row.adapterType,
      gatewayBaseUrl: row.gatewayBaseUrl,
      encryptedApiKey: row.encryptedApiKey,
    });
    if (!adapter.fetchMessages) {
      return { accepted: 0, reason: "gateway_does_not_support_message_sync" };
    }

    let events: NormalizedGatewayEvent[];
    try {
      const messages = await adapter.fetchMessages({
        providerInstanceId: row.providerInstanceId ?? row.phoneInstanceId,
        providerChatId: row.providerChatId,
        limit,
      });
      events = messages.map((message) =>
        toNormalizedHistoryEvent(message, row.adapterType, row.channelType),
      );
    } catch {
      return { accepted: 0, reason: "gateway_message_sync_failed" };
    }

    if (events.length > 0) {
      await this.queues.messageNormalization.add(
        QUEUE.messageNormalization,
        {
          workspaceId: user.workspaceId,
          phoneInstanceId: row.phoneInstanceId,
          rawEventRefId: null,
          events,
          isReconnectSync: true,
        },
        {
          priority: 8,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        },
      );
    }

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "channel.messages_synced",
      targetType: "channel",
      targetId: channelId,
      metadata: { requestedLimit: limit, accepted: events.length },
    });
    return { accepted: events.length };
  }
}

function toNormalizedHistoryEvent(
  message: GatewayChatMessage,
  adapterType: NormalizedGatewayEvent["adapterType"],
  channelType: NormalizedGatewayEvent["channelType"],
): NormalizedGatewayEvent {
  return {
    adapterType,
    providerMessageId: message.providerMessageId,
    providerChatId: message.providerChatId,
    providerSenderId: message.providerSenderId ?? undefined,
    channelType,
    messageType: toKnownMessageType(message.messageType),
    direction: message.direction,
    body: message.body ?? undefined,
    ...(message.media?.length ? { media: message.media } : {}),
    quotedProviderMessageId: message.quotedProviderMessageId ?? undefined,
    providerTimestampMs: message.providerTimestampMs,
    isHistorySync: true,
    raw: message,
  };
}

function toKnownMessageType(
  value: string,
): NormalizedGatewayEvent["messageType"] {
  switch (value) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
    case "reaction":
    case "location":
    case "contact_card":
    case "poll":
    case "system":
    case "deleted":
      return value;
    default:
      return "unknown";
  }
}

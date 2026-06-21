import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type {
  ChannelActionInput,
  MapChannelInput,
  UpdateReadStateInput,
} from "@clariodesk/schemas";
import type { RealtimePublisher } from "@clariodesk/events";
import type { SetChatStateInput } from "@clariodesk/gateway-adapters";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";
import { AdapterFactory } from "../core/adapters.js";
import { MessagesService } from "../messages/messages.service.js";

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.ADAPTERS) private readonly adapters: AdapterFactory,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly messages: MessagesService,
  ) {}

  /** List channels visible to the user (permission-scoped, TDD §12.2). */
  async list(user: AuthUser, view: "inbox" | "archived" = "inbox") {
    const allowed = await this.access.accessibleChannelIds(user);
    const accessWhere =
      allowed === "all"
        ? eq(schema.channels.workspaceId, user.workspaceId)
        : allowed.length === 0
          ? eq(schema.channels.id, "00000000-0000-0000-0000-000000000000") // none
          : and(
              eq(schema.channels.workspaceId, user.workspaceId),
              inArray(schema.channels.id, allowed),
            );
    const lifecycleWhere =
      view === "archived"
        ? eq(schema.channels.status, "archived")
        : ne(schema.channels.status, "archived");
    const where = and(
      accessWhere,
      eq(schema.phoneInstances.adapterType, "clario_gateway"),
      lifecycleWhere,
    );

    return this.db
      .select({
        id: schema.channels.id,
        providerChatId: schema.channels.providerChatId,
        title: schema.channels.title,
        avatarUrl: schema.channels.avatarUrl,
        channelType: schema.channels.channelType,
        status: schema.channels.status,
        isPinned: schema.channels.isPinned,
        isMuted: schema.channels.isMuted,
        isMarkedUnread: sql<boolean>`coalesce(${schema.userChannelReadState.isMarkedUnread}, false)`,
        lastMessageAt: schema.channels.lastMessageAt,
        awaitingResponseSince: schema.channels.awaitingResponseSince,
        lastAgentReplyAt: schema.channels.lastAgentReplyAt,
        lastMessage: sql<string | null>`(
          select ${schema.messages.body}
          from ${schema.messages}
          where ${schema.messages.channelId} = ${schema.channels.id}
          order by ${schema.messages.providerTimestamp} desc
          limit 1
        )`,
        lastMessageType: sql<string | null>`(
          select ${schema.messages.messageType}::text
          from ${schema.messages}
          where ${schema.messages.channelId} = ${schema.channels.id}
          order by ${schema.messages.providerTimestamp} desc
          limit 1
        )`,
        clientId: schema.channelMappings.clientId,
        clientName: schema.clients.name,
        projectId: schema.channelMappings.projectId,
        projectName: schema.projects.name,
        mappingMode: schema.channelMappings.mappingMode,
      })
      .from(schema.channels)
      .innerJoin(
        schema.phoneInstances,
        eq(schema.phoneInstances.id, schema.channels.phoneInstanceId),
      )
      .leftJoin(
        schema.channelMappings,
        and(
          eq(schema.channelMappings.channelId, schema.channels.id),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .leftJoin(
        schema.clients,
        eq(schema.clients.id, schema.channelMappings.clientId),
      )
      .leftJoin(
        schema.projects,
        eq(schema.projects.id, schema.channelMappings.projectId),
      )
      .leftJoin(
        schema.userChannelReadState,
        and(
          eq(schema.userChannelReadState.channelId, schema.channels.id),
          eq(schema.userChannelReadState.userId, user.userId),
        ),
      )
      .where(where)
      .orderBy(
        desc(schema.channels.isPinned),
        sql`${schema.channels.lastMessageAt} desc nulls last`,
        schema.channels.id,
      );
  }

  async applyAction(
    user: AuthUser,
    channelId: string,
    input: ChannelActionInput,
  ) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot change WhatsApp chat state");
    }
    await this.access.assertChannelAccess(user, channelId);
    const channel = await this.loadChannel(user, channelId);
    if (channel.phoneStatus !== "connected") {
      throw new BadRequestException("WhatsApp phone is not connected");
    }
    const adapter = this.adapters.forPhone(channel);
    if (!adapter.setChatState) {
      throw new BadRequestException("Gateway does not support chat actions");
    }

    const confirmed = await adapter.setChatState({
      providerInstanceId: channel.providerInstanceId ?? channel.phoneInstanceId,
      providerChatId: channel.providerChatId,
      ...input,
    } as SetChatStateInput);
    const now = new Date();
    let status = channel.status;
    let isPinned = channel.isPinned;
    let isMuted = channel.isMuted;

    switch (input.action) {
      case "pin":
        isPinned = confirmed.isPinned ?? input.pinned;
        await this.db
          .update(schema.channels)
          .set({ isPinned, updatedAt: now })
          .where(eq(schema.channels.id, channelId));
        break;
      case "mute":
        isMuted = confirmed.isMuted ?? input.muted;
        await this.db
          .update(schema.channels)
          .set({ isMuted, updatedAt: now })
          .where(eq(schema.channels.id, channelId));
        break;
      case "archive": {
        const archived = confirmed.isArchived ?? input.archived;
        status = archived
          ? "archived"
          : channel.mappingMode && channel.mappingMode !== "unmapped"
            ? "active"
            : channel.channelType === "group"
              ? "unmapped"
              : "active";
        await this.db
          .update(schema.channels)
          .set({ status, updatedAt: now })
          .where(eq(schema.channels.id, channelId));
        break;
      }
      case "mark_unread":
        await this.upsertReadState(user, channelId, true);
        break;
    }

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: `channel.${input.action}`,
      targetType: "channel",
      targetId: channelId,
      metadata: input,
    });
    await this.realtime.publish({
      type: "channel.updated",
      workspaceId: user.workspaceId,
      channelId,
      payload: { status, isPinned, isMuted },
    });
    return {
      channelId,
      status,
      isPinned,
      isMuted,
      isMarkedUnread: input.action === "mark_unread",
    };
  }

  async updateReadState(
    user: AuthUser,
    channelId: string,
    _input: UpdateReadStateInput,
  ) {
    await this.access.assertChannelAccess(user, channelId);
    await this.loadChannel(user, channelId);
    await this.upsertReadState(user, channelId, false);
    await this.realtime.publish({
      type: "channel.read_state_changed",
      workspaceId: user.workspaceId,
      channelId,
      userId: user.userId,
      payload: { isMarkedUnread: false },
    });
    return { channelId, isMarkedUnread: false };
  }

  async refreshChannel(user: AuthUser, channelId: string) {
    await this.access.assertChannelAccess(user, channelId);
    const channel = await this.loadChannel(user, channelId);
    if (channel.phoneStatus !== "connected") {
      throw new BadRequestException("WhatsApp phone is not connected");
    }
    const adapter = this.adapters.forPhone(channel);
    if (!adapter.fetchChat) {
      throw new BadRequestException("Gateway does not support chat refresh");
    }
    const confirmed = await adapter.fetchChat({
      providerInstanceId: channel.providerInstanceId ?? channel.phoneInstanceId,
      providerChatId: channel.providerChatId,
    });
    const nextStatus = confirmed.isArchived
      ? "archived"
      : channel.status === "archived"
        ? channel.channelType === "group"
          ? "unmapped"
          : "active"
        : channel.status;
    const metadataChanged =
      confirmed.title !== channel.title ||
      (confirmed.avatarUrl ?? null) !== channel.avatarUrl ||
      (confirmed.isPinned ?? channel.isPinned) !== channel.isPinned ||
      (confirmed.isMuted ?? channel.isMuted) !== channel.isMuted ||
      nextStatus !== channel.status;
    if (metadataChanged) {
      await this.db
        .update(schema.channels)
        .set({
          title: confirmed.title,
          avatarUrl: confirmed.avatarUrl ?? null,
          isPinned: confirmed.isPinned ?? channel.isPinned,
          isMuted: confirmed.isMuted ?? channel.isMuted,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.channels.id, channelId));
    }
    const sync = await this.messages.syncMessages(user, channelId, 50);
    await this.realtime.publish({
      type: "channel.updated",
      workspaceId: user.workspaceId,
      channelId,
      payload: { refreshed: true, metadataChanged },
    });
    return {
      acceptedMessages: sync.accepted,
      metadataChanged,
    };
  }

  /**
   * Map a channel to a client/project (admin only, FRS §10.3). Sets the mapping
   * boundary `mappingEffectiveAt = now`; messages before it stay historical.
   * Supersedes any existing active mapping (context-drift safe, §O.4.5).
   */
  async map(user: AuthUser, input: MapChannelInput) {
    if (user.role !== "admin") {
      throw new ForbiddenException("Only admins may map channels");
    }
    if (input.mappingMode === "single_client" && !input.clientId) {
      throw new BadRequestException(
        "single_client mapping requires a clientId",
      );
    }

    const channel = await this.db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.id, input.channelId),
          eq(schema.channels.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!channel[0]) throw new NotFoundException("Channel not found");

    const now = new Date();
    await this.db.transaction(async (tx) => {
      // End the current active mapping, if any (preserves history boundaries).
      await tx
        .update(schema.channelMappings)
        .set({ status: "ended", updatedAt: now })
        .where(
          and(
            eq(schema.channelMappings.channelId, input.channelId),
            eq(schema.channelMappings.status, "active"),
          ),
        );
      await tx.insert(schema.channelMappings).values({
        workspaceId: user.workspaceId,
        channelId: input.channelId,
        clientId: input.clientId,
        projectId: input.projectId,
        mappingMode: input.mappingMode,
        mappingEffectiveAt: now,
        mappedByUserId: user.userId,
        status: "active",
        notes: input.notes ?? null,
      });
      await tx
        .update(schema.channels)
        .set({
          status: input.mappingMode === "unmapped" ? "unmapped" : "active",
          updatedAt: now,
        })
        .where(eq(schema.channels.id, input.channelId));
    });

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "channel.mapped",
      targetType: "channel",
      targetId: input.channelId,
      metadata: { mappingMode: input.mappingMode, clientId: input.clientId },
    });

    return { ok: true, mappingEffectiveAt: now.toISOString() };
  }

  /**
   * Channel Registry review queue: group metadata changes (renames etc.) that
   * an admin should review for possible remapping (TDD §O.4). Admin-only.
   */
  async listMetadataEvents(user: AuthUser, status = "pending") {
    assertAdmin(user);
    return this.db
      .select({
        id: schema.groupMetadataEvents.id,
        channelId: schema.groupMetadataEvents.channelId,
        eventType: schema.groupMetadataEvents.eventType,
        oldValue: schema.groupMetadataEvents.oldValue,
        newValue: schema.groupMetadataEvents.newValue,
        providerTimestamp: schema.groupMetadataEvents.providerTimestamp,
        reviewStatus: schema.groupMetadataEvents.reviewStatus,
      })
      .from(schema.groupMetadataEvents)
      .where(
        and(
          eq(schema.groupMetadataEvents.workspaceId, user.workspaceId),
          eq(schema.groupMetadataEvents.reviewStatus, status),
        ),
      )
      .orderBy(desc(schema.groupMetadataEvents.providerTimestamp));
  }

  /** Resolve a review item (keep mapping / acknowledge rename / ignore). */
  async reviewMetadataEvent(
    user: AuthUser,
    eventId: string,
    resolution: "reviewed" | "ignored",
  ) {
    assertAdmin(user);
    const updated = await this.db
      .update(schema.groupMetadataEvents)
      .set({
        reviewStatus: resolution,
        reviewedByUserId: user.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.groupMetadataEvents.id, eventId),
          eq(schema.groupMetadataEvents.workspaceId, user.workspaceId),
        ),
      )
      .returning({ id: schema.groupMetadataEvents.id });
    if (!updated[0]) throw new NotFoundException("Review item not found");
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "channel.metadata_reviewed",
      targetType: "group_metadata_event",
      targetId: eventId,
      metadata: { resolution },
    });
    return { ok: true };
  }

  private async loadChannel(user: AuthUser, channelId: string) {
    const [channel] = await this.db
      .select({
        id: schema.channels.id,
        workspaceId: schema.channels.workspaceId,
        phoneInstanceId: schema.channels.phoneInstanceId,
        providerChatId: schema.channels.providerChatId,
        channelType: schema.channels.channelType,
        title: schema.channels.title,
        avatarUrl: schema.channels.avatarUrl,
        status: schema.channels.status,
        isPinned: schema.channels.isPinned,
        isMuted: schema.channels.isMuted,
        mappingMode: schema.channelMappings.mappingMode,
        adapterType: schema.phoneInstances.adapterType,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        encryptedApiKey: schema.phoneInstances.encryptedApiKey,
        phoneStatus: schema.phoneInstances.status,
      })
      .from(schema.channels)
      .innerJoin(
        schema.phoneInstances,
        eq(schema.phoneInstances.id, schema.channels.phoneInstanceId),
      )
      .leftJoin(
        schema.channelMappings,
        and(
          eq(schema.channelMappings.channelId, schema.channels.id),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .where(
        and(
          eq(schema.channels.id, channelId),
          eq(schema.channels.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!channel) throw new NotFoundException("Channel not found");
    return channel;
  }

  private async upsertReadState(
    user: AuthUser,
    channelId: string,
    isMarkedUnread: boolean,
  ) {
    const now = new Date();
    await this.db
      .insert(schema.userChannelReadState)
      .values({
        workspaceId: user.workspaceId,
        userId: user.userId,
        channelId,
        isMarkedUnread,
        lastReadAt: isMarkedUnread ? null : now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.userChannelReadState.userId,
          schema.userChannelReadState.channelId,
        ],
        set: {
          isMarkedUnread,
          lastReadAt: isMarkedUnread ? null : now,
          updatedAt: now,
        },
      });
  }
}

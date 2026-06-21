import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { MapChannelInput } from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** List channels visible to the user (permission-scoped, TDD §12.2). */
  async list(user: AuthUser) {
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
    const where = and(
      accessWhere,
      eq(schema.phoneInstances.adapterType, "clario_gateway"),
    );

    return this.db
      .select({
        id: schema.channels.id,
        title: schema.channels.title,
        channelType: schema.channels.channelType,
        status: schema.channels.status,
        lastMessageAt: schema.channels.lastMessageAt,
        awaitingResponseSince: schema.channels.awaitingResponseSince,
        lastAgentReplyAt: schema.channels.lastAgentReplyAt,
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
      .where(where)
      .orderBy(desc(schema.channels.lastMessageAt));
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
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { CreateTicketInput, UpdateTicketInput } from "@clariodesk/schemas";
import { RealtimePublisher } from "@clariodesk/events";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";

@Injectable()
export class TicketsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** List tickets the user may see (permission-scoped by channel). */
  async list(user: AuthUser) {
    const allowed = await this.access.accessibleChannelIds(user);
    if (allowed !== "all" && allowed.length === 0) return [];
    const where =
      allowed === "all"
        ? eq(schema.tickets.workspaceId, user.workspaceId)
        : and(
            eq(schema.tickets.workspaceId, user.workspaceId),
            inArray(schema.tickets.channelId, allowed),
          );
    return this.db
      .select({
        id: schema.tickets.id,
        title: schema.tickets.title,
        status: schema.tickets.status,
        priority: schema.tickets.priority,
        channelId: schema.tickets.channelId,
        clientId: schema.tickets.clientId,
        assignedUserId: schema.tickets.assignedUserId,
        firstResponseAt: schema.tickets.firstResponseAt,
        createdAt: schema.tickets.createdAt,
      })
      .from(schema.tickets)
      .where(where)
      .orderBy(desc(schema.tickets.createdAt));
  }

  /** Get one ticket (permission-scoped). */
  async get(user: AuthUser, ticketId: string) {
    const rows = await this.db
      .select()
      .from(schema.tickets)
      .where(
        and(
          eq(schema.tickets.id, ticketId),
          eq(schema.tickets.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Ticket not found");
    await this.access.assertChannelAccess(user, rows[0].channelId);
    return rows[0];
  }

  /**
   * Create a ticket from a message (TDD §14.2). For single_client channels the
   * client/project are inherited from the mapping; for mixed channels they must
   * be chosen explicitly (FRS §11.4).
   */
  async create(user: AuthUser, input: CreateTicketInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot create tickets");
    }
    await this.access.assertChannelAccess(user, input.channelId);

    const mapping = await this.db
      .select({
        mappingMode: schema.channelMappings.mappingMode,
        clientId: schema.channelMappings.clientId,
        projectId: schema.channelMappings.projectId,
      })
      .from(schema.channelMappings)
      .where(
        and(
          eq(schema.channelMappings.channelId, input.channelId),
          eq(schema.channelMappings.status, "active"),
        ),
      )
      .limit(1);
    const m = mapping[0];

    let clientId = input.clientId ?? null;
    let projectId = input.projectId ?? null;
    if (m && m.mappingMode === "single_client") {
      clientId = m.clientId;
      projectId = m.projectId;
    } else if (m && m.mappingMode === "mixed" && !clientId) {
      throw new BadRequestException(
        "Mixed-group tickets must specify a client (FRS §11.4)",
      );
    }

    const [sourceState] = await this.db
      .select({
        providerTimestamp: schema.messages.providerTimestamp,
        slaEligible: schema.messages.slaEligible,
        lastAgentReplyAt: schema.channels.lastAgentReplyAt,
      })
      .from(schema.messages)
      .innerJoin(
        schema.channels,
        eq(schema.channels.id, schema.messages.channelId),
      )
      .where(
        and(
          eq(schema.messages.id, input.sourceMessageId),
          eq(schema.messages.workspaceId, user.workspaceId),
          eq(schema.messages.channelId, input.channelId),
        ),
      )
      .limit(1);
    if (!sourceState) {
      throw new BadRequestException("Source message not found in channel");
    }
    const firstResponseAt =
      sourceState.slaEligible &&
      sourceState.lastAgentReplyAt &&
      sourceState.lastAgentReplyAt >= sourceState.providerTimestamp
        ? sourceState.lastAgentReplyAt
        : null;

    const ticket = await this.db.transaction(async (tx) => {
      const [t] = await tx
        .insert(schema.tickets)
        .values({
          workspaceId: user.workspaceId,
          clientId,
          projectId,
          channelId: input.channelId,
          sourceMessageId: input.sourceMessageId,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          status: "open",
          assignedUserId: input.assignedUserId ?? null,
          createdByUserId: user.userId,
          firstResponseAt,
        })
        .returning({ id: schema.tickets.id });
      if (!t) throw new Error("failed to create ticket");
      await tx.insert(schema.ticketMessages).values({
        workspaceId: user.workspaceId,
        ticketId: t.id,
        messageId: input.sourceMessageId,
      });
      return t;
    });

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "ticket.created",
      targetType: "ticket",
      targetId: ticket.id,
    });
    await this.realtime.publish({
      type: "ticket.created",
      workspaceId: user.workspaceId,
      channelId: input.channelId,
      ticketId: ticket.id,
      payload: { title: input.title, priority: input.priority },
    });
    return ticket;
  }

  async update(user: AuthUser, ticketId: string, input: UpdateTicketInput) {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot modify tickets");
    }
    const rows = await this.db
      .select({ channelId: schema.tickets.channelId })
      .from(schema.tickets)
      .where(
        and(
          eq(schema.tickets.id, ticketId),
          eq(schema.tickets.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Ticket not found");
    await this.access.assertChannelAccess(user, rows[0].channelId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "closed") patch.closedAt = new Date();
    }
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.assignedUserId !== undefined)
      patch.assignedUserId = input.assignedUserId;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;

    await this.db
      .update(schema.tickets)
      .set(patch)
      .where(eq(schema.tickets.id, ticketId));

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "ticket.updated",
      targetType: "ticket",
      targetId: ticketId,
      metadata: input as Record<string, unknown>,
    });
    await this.realtime.publish({
      type: "ticket.updated",
      workspaceId: user.workspaceId,
      channelId: rows[0].channelId,
      ticketId,
      payload: input as Record<string, unknown>,
    });
    return { ok: true };
  }
}

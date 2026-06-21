import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type {
  AssignChannelInput,
  AssignClientInput,
  CreateUserInput,
} from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";
import { hashPassword } from "../auth/password.js";

@Injectable()
export class TeamService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** List workspace members + their roles (TDD §32.4). */
  async listMembers(user: AuthUser) {
    assertAdmin(user);
    return this.db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.workspaceUsers.role,
        status: schema.workspaceUsers.status,
      })
      .from(schema.workspaceUsers)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.workspaceUsers.userId),
      )
      .where(eq(schema.workspaceUsers.workspaceId, user.workspaceId));
  }

  /** Create a user and add them to the workspace with a role. */
  async createUser(user: AuthUser, input: CreateUserInput) {
    assertAdmin(user);
    const existing = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);
    if (existing[0]) throw new ConflictException("Email already registered");

    const passwordHash = await hashPassword(input.password);
    const created = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(schema.users)
        .values({
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        })
        .returning({ id: schema.users.id });
      if (!u) throw new Error("failed to create user");
      await tx.insert(schema.workspaceUsers).values({
        workspaceId: user.workspaceId,
        userId: u.id,
        role: input.role,
        status: "active",
      });
      return u;
    });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "user.created",
      targetType: "user",
      targetId: created.id,
      metadata: { role: input.role },
    });
    return { userId: created.id };
  }

  async assignClient(user: AuthUser, input: AssignClientInput) {
    assertAdmin(user);
    await this.assertWorkspaceClient(user, input.clientId);
    await this.db
      .insert(schema.clientAssignments)
      .values({
        workspaceId: user.workspaceId,
        clientId: input.clientId,
        userId: input.userId,
        accessLevel: input.accessLevel,
      })
      .onConflictDoUpdate({
        target: [
          schema.clientAssignments.clientId,
          schema.clientAssignments.userId,
        ],
        set: { accessLevel: input.accessLevel, updatedAt: new Date() },
      });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "access.client_assigned",
      targetType: "client",
      targetId: input.clientId,
      metadata: { userId: input.userId, accessLevel: input.accessLevel },
    });
    return { ok: true };
  }

  async assignChannel(user: AuthUser, input: AssignChannelInput) {
    assertAdmin(user);
    await this.db
      .insert(schema.channelAssignments)
      .values({
        workspaceId: user.workspaceId,
        channelId: input.channelId,
        userId: input.userId,
        accessLevel: input.accessLevel,
      })
      .onConflictDoUpdate({
        target: [
          schema.channelAssignments.channelId,
          schema.channelAssignments.userId,
        ],
        set: { accessLevel: input.accessLevel, updatedAt: new Date() },
      });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "access.channel_assigned",
      targetType: "channel",
      targetId: input.channelId,
      metadata: { userId: input.userId, accessLevel: input.accessLevel },
    });
    return { ok: true };
  }

  private async assertWorkspaceClient(user: AuthUser, clientId: string) {
    const rows = await this.db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, clientId),
          eq(schema.clients.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Client not found");
  }
}

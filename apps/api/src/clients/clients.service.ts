import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type {
  CreateClientInput,
  CreateProjectInput,
} from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";

@Injectable()
export class ClientsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** List clients visible to the user (permission-scoped). */
  async list(user: AuthUser) {
    const allowed = await this.access.accessibleClientIds(user);
    if (allowed !== "all" && allowed.length === 0) return [];
    const where =
      allowed === "all"
        ? eq(schema.clients.workspaceId, user.workspaceId)
        : and(
            eq(schema.clients.workspaceId, user.workspaceId),
            inArray(schema.clients.id, allowed),
          );
    return this.db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        status: schema.clients.status,
      })
      .from(schema.clients)
      .where(where);
  }

  async create(user: AuthUser, input: CreateClientInput) {
    assertAdmin(user);
    const [client] = await this.db
      .insert(schema.clients)
      .values({ workspaceId: user.workspaceId, name: input.name })
      .returning({ id: schema.clients.id, name: schema.clients.name });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "client.created",
      targetType: "client",
      targetId: client?.id,
    });
    return client;
  }

  async archive(user: AuthUser, clientId: string) {
    assertAdmin(user);
    const updated = await this.db
      .update(schema.clients)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(schema.clients.id, clientId),
          eq(schema.clients.workspaceId, user.workspaceId),
        ),
      )
      .returning({ id: schema.clients.id });
    if (!updated[0]) throw new NotFoundException("Client not found");
    return { ok: true };
  }

  // ── Projects (sub-containers under a client) ──

  async listProjects(user: AuthUser, clientId: string) {
    await this.access.assertClientAccess(user, clientId);
    return this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        status: schema.projects.status,
      })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.workspaceId, user.workspaceId),
          eq(schema.projects.clientId, clientId),
        ),
      );
  }

  async createProject(user: AuthUser, input: CreateProjectInput) {
    assertAdmin(user);
    const client = await this.db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, input.clientId),
          eq(schema.clients.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!client[0]) throw new NotFoundException("Client not found");
    const [project] = await this.db
      .insert(schema.projects)
      .values({
        workspaceId: user.workspaceId,
        clientId: input.clientId,
        name: input.name,
      })
      .returning({ id: schema.projects.id, name: schema.projects.name });
    return project;
  }
}

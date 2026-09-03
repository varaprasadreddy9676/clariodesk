import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AuditLogQuery } from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { assertAdmin } from "../common/roles.js";

/**
 * Read side of the append-only audit trail (packages/db/src/schema/audit.ts).
 * AuditService only ever writes; this is the first thing that reads it back,
 * so admins can actually see what happened instead of the data sitting
 * write-only in Postgres.
 */
@Injectable()
export class AuditLogReaderService {
  constructor(@Inject(TOKENS.DB) private readonly db: Database) {}

  async list(user: AuthUser, query: AuditLogQuery) {
    assertAdmin(user);

    const conditions = [eq(schema.auditLogs.workspaceId, user.workspaceId)];
    if (query.beforeCreatedAtMs !== undefined) {
      conditions.push(
        lt(schema.auditLogs.createdAt, new Date(query.beforeCreatedAtMs)),
      );
    }
    if (query.action)
      conditions.push(eq(schema.auditLogs.action, query.action));
    if (query.targetType) {
      conditions.push(eq(schema.auditLogs.targetType, query.targetType));
    }
    if (query.actorUserId) {
      conditions.push(eq(schema.auditLogs.actorUserId, query.actorUserId));
    }

    const rows = await this.db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        targetType: schema.auditLogs.targetType,
        targetId: schema.auditLogs.targetId,
        metadata: schema.auditLogs.metadata,
        createdAt: schema.auditLogs.createdAt,
        actorUserId: schema.auditLogs.actorUserId,
        actorName: schema.users.displayName,
        actorEmail: schema.users.email,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorUserId))
      .where(and(...conditions))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(query.limit);

    return rows;
  }
}

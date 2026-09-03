import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type {
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";

const SELECT_COLUMNS = {
  id: schema.cannedResponses.id,
  title: schema.cannedResponses.title,
  body: schema.cannedResponses.body,
  createdByUserId: schema.cannedResponses.createdByUserId,
  createdAt: schema.cannedResponses.createdAt,
  updatedAt: schema.cannedResponses.updatedAt,
};

/** Shared workspace "quick replies" agents insert into the composer instead of retyping common answers. */
@Injectable()
export class CannedResponsesService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** List, optionally filtered by a search term over title + body. */
  async list(user: AuthUser, query?: string) {
    const q = query?.trim();
    const where = q
      ? and(
          eq(schema.cannedResponses.workspaceId, user.workspaceId),
          sql`to_tsvector('simple', coalesce(${schema.cannedResponses.title}, '') || ' ' || coalesce(${schema.cannedResponses.body}, '')) @@ websearch_to_tsquery('simple', ${q})`,
        )
      : eq(schema.cannedResponses.workspaceId, user.workspaceId);
    return this.db
      .select(SELECT_COLUMNS)
      .from(schema.cannedResponses)
      .where(where)
      .orderBy(schema.cannedResponses.title);
  }

  async create(user: AuthUser, input: CreateCannedResponseInput) {
    this.assertCanManage(user);
    const existing = await this.db
      .select({ id: schema.cannedResponses.id })
      .from(schema.cannedResponses)
      .where(
        and(
          eq(schema.cannedResponses.workspaceId, user.workspaceId),
          eq(schema.cannedResponses.title, input.title),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw new ConflictException(
        "A quick reply with this title already exists",
      );
    }
    const [created] = await this.db
      .insert(schema.cannedResponses)
      .values({
        workspaceId: user.workspaceId,
        title: input.title,
        body: input.body,
        createdByUserId: user.userId,
      })
      .returning(SELECT_COLUMNS);
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "canned_response.created",
      targetType: "canned_response",
      targetId: created?.id,
    });
    return created;
  }

  async update(user: AuthUser, id: string, input: UpdateCannedResponseInput) {
    this.assertCanManage(user);
    if (input.title) {
      const existing = await this.db
        .select({ id: schema.cannedResponses.id })
        .from(schema.cannedResponses)
        .where(
          and(
            eq(schema.cannedResponses.workspaceId, user.workspaceId),
            eq(schema.cannedResponses.title, input.title),
          ),
        )
        .limit(1);
      if (existing[0] && existing[0].id !== id) {
        throw new ConflictException(
          "A quick reply with this title already exists",
        );
      }
    }
    const [updated] = await this.db
      .update(schema.cannedResponses)
      .set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.body ? { body: input.body } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.cannedResponses.id, id),
          eq(schema.cannedResponses.workspaceId, user.workspaceId),
        ),
      )
      .returning(SELECT_COLUMNS);
    if (!updated) throw new NotFoundException("Quick reply not found");
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "canned_response.updated",
      targetType: "canned_response",
      targetId: updated.id,
    });
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    this.assertCanManage(user);
    const [deleted] = await this.db
      .delete(schema.cannedResponses)
      .where(
        and(
          eq(schema.cannedResponses.id, id),
          eq(schema.cannedResponses.workspaceId, user.workspaceId),
        ),
      )
      .returning({ id: schema.cannedResponses.id });
    if (!deleted) throw new NotFoundException("Quick reply not found");
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "canned_response.deleted",
      targetType: "canned_response",
      targetId: deleted.id,
    });
    return { ok: true };
  }

  /** Viewers can read the shared list but never author/edit/delete it. */
  private assertCanManage(user: AuthUser): void {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot manage quick replies");
    }
  }
}

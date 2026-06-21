import { Inject, Injectable } from "@nestjs/common";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";

/** Append-only audit writer (TDD §23.5). Never throws into the request path. */
@Injectable()
export class AuditService {
  constructor(@Inject(TOKENS.DB) private readonly db: Database) {}

  async record(entry: {
    workspaceId: string;
    actorUserId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.db.insert(schema.auditLogs).values({
        workspaceId: entry.workspaceId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch {
      // Audit must not break the operation it records; failures are tolerated.
    }
  }
}

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { auditLogQuerySchema, type AuditLogQuery } from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { AuditLogReaderService } from "./audit-log-reader.service.js";

/** Admin-only audit trail viewer. */
@Controller("audit-logs")
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly reader: AuditLogReaderService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ) {
    return this.reader.list(user, query);
  }
}

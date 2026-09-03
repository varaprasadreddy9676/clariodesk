import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AuditLogController } from "./audit-log.controller.js";
import { AuditLogReaderService } from "./audit-log-reader.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogReaderService],
})
export class AuditLogModule {}

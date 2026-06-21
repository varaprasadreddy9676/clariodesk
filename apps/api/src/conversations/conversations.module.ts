import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AuditService } from "../common/audit.service.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { ConversationsController } from "./conversations.controller.js";
import { ConversationsService } from "./conversations.service.js";

@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, AuditService],
})
export class ConversationsModule {}

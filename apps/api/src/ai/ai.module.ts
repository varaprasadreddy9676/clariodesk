import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AiConnectionsController } from "./ai-connections.controller.js";
import { AiConnectionsService } from "./ai-connections.service.js";
import { AiDraftReplyController } from "./ai-draft-reply.controller.js";
import { AiDraftReplyService } from "./ai-draft-reply.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AiConnectionsController, AiDraftReplyController],
  providers: [AiConnectionsService, AiDraftReplyService],
})
export class AiModule {}

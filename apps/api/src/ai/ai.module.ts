import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AiConnectionsController } from "./ai-connections.controller.js";
import { AiConnectionsService } from "./ai-connections.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AiConnectionsController],
  providers: [AiConnectionsService],
})
export class AiModule {}

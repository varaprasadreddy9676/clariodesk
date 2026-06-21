import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ChannelsController } from "./channels.controller.js";
import { ChannelsService } from "./channels.service.js";
import { MessagesModule } from "../messages/messages.module.js";

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}

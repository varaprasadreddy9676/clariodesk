import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OutboxController } from "./outbox.controller.js";
import { OutboxService } from "./outbox.service.js";

@Module({
  imports: [AuthModule],
  controllers: [OutboxController],
  providers: [OutboxService],
})
export class OutboxModule {}

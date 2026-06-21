import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { sendReplySchema, type SendReplyInput } from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { OutboxService } from "./outbox.service.js";

@Controller("outbox")
@UseGuards(JwtAuthGuard)
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Post()
  send(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(sendReplySchema)) body: SendReplyInput,
  ) {
    return this.outbox.send(user, body);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.outbox.cancel(user, id);
  }
}

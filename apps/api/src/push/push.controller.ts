import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  type PushSubscribeInput,
  type PushUnsubscribeInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { PushService } from "./push.service.js";

@Controller("push")
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get("vapid-public-key")
  vapidPublicKey() {
    return this.push.vapidPublicKey();
  }

  @Post("subscribe")
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushSubscribeSchema)) body: PushSubscribeInput,
  ) {
    return this.push.subscribe(user, body);
  }

  @Delete("subscribe")
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushUnsubscribeSchema))
    body: PushUnsubscribeInput,
  ) {
    return this.push.unsubscribe(user, body);
  }
}

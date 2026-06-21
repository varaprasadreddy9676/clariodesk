import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { OpsService } from "./ops.service.js";

@Controller("ops")
@UseGuards(JwtAuthGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.ops.summary(user);
  }

  @Get("metrics")
  @Header("content-type", "text/plain; charset=utf-8")
  metrics(@CurrentUser() user: AuthUser) {
    return this.ops.metrics(user);
  }
}

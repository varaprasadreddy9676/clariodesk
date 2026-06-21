import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createPhoneSchema, type CreatePhoneInput } from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { PhonesService } from "./phones.service.js";

@Controller("phones")
@UseGuards(JwtAuthGuard)
export class PhonesController {
  constructor(private readonly phones: PhonesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.phones.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPhoneSchema)) body: CreatePhoneInput,
  ) {
    return this.phones.create(user, body);
  }

  @Post(":id/connect")
  connect(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.phones.connect(user, id);
  }

  @Post(":id/repair")
  repair(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.phones.repair(user, id);
  }

  @Get(":id/status")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.phones.status(user, id);
  }

  @Post(":id/sync-groups")
  syncGroups(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.phones.syncGroups(user, id);
  }

  @Post(":id/disconnect")
  disconnect(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.phones.disconnect(user, id);
  }
}

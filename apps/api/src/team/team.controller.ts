import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  assignChannelSchema,
  assignClientSchema,
  createUserSchema,
  type AssignChannelInput,
  type AssignClientInput,
  type CreateUserInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { TeamService } from "./team.service.js";

@Controller("team")
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get("members")
  members(@CurrentUser() user: AuthUser) {
    return this.team.listMembers(user);
  }

  @Post("users")
  createUser(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ) {
    return this.team.createUser(user, body);
  }

  @Post("assign-client")
  assignClient(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(assignClientSchema)) body: AssignClientInput,
  ) {
    return this.team.assignClient(user, body);
  }

  @Post("assign-channel")
  assignChannel(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(assignChannelSchema)) body: AssignChannelInput,
  ) {
    return this.team.assignChannel(user, body);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createCannedResponseSchema,
  updateCannedResponseSchema,
  type CreateCannedResponseInput,
  type UpdateCannedResponseInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { CannedResponsesService } from "./canned-responses.service.js";

@Controller("canned-responses")
@UseGuards(JwtAuthGuard)
export class CannedResponsesController {
  constructor(private readonly cannedResponses: CannedResponsesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("q") q?: string) {
    return this.cannedResponses.list(user, q);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCannedResponseSchema))
    body: CreateCannedResponseInput,
  ) {
    return this.cannedResponses.create(user, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCannedResponseSchema))
    body: UpdateCannedResponseInput,
  ) {
    return this.cannedResponses.update(user, id, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cannedResponses.remove(user, id);
  }
}

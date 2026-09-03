import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createAiProviderConnectionSchema,
  updateAiProviderConnectionSchema,
  type CreateAiProviderConnectionInput,
  type UpdateAiProviderConnectionInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { AiConnectionsService } from "./ai-connections.service.js";

/** BYOK provider-connection admin endpoints. Never returns a key, encrypted or otherwise. */
@Controller("ai/connections")
@UseGuards(JwtAuthGuard)
export class AiConnectionsController {
  constructor(private readonly connections: AiConnectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.connections.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAiProviderConnectionSchema))
    body: CreateAiProviderConnectionInput,
  ) {
    return this.connections.create(user, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAiProviderConnectionSchema))
    body: UpdateAiProviderConnectionInput,
  ) {
    return this.connections.update(user, id, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.connections.remove(user, id);
  }

  @Post(":id/test")
  test(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.connections.testConnection(user, id);
  }
}

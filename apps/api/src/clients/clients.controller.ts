import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createClientSchema,
  createProjectSchema,
  type CreateClientInput,
  type CreateProjectInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { ClientsService } from "./clients.service.js";

@Controller()
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get("clients")
  list(@CurrentUser() user: AuthUser) {
    return this.clients.list(user);
  }

  @Post("clients")
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ) {
    return this.clients.create(user, body);
  }

  @Delete("clients/:id")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.clients.archive(user, id);
  }

  @Get("clients/:id/projects")
  listProjects(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.clients.listProjects(user, id);
  }

  @Post("projects")
  createProject(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.clients.createProject(user, body);
  }
}

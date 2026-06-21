import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  createDirectConversationSchema,
  createGroupConversationSchema,
  type CreateDirectConversationInput,
  type CreateGroupConversationInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { ConversationsService } from "./conversations.service.js";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post("direct")
  createDirect(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDirectConversationSchema))
    body: CreateDirectConversationInput,
  ) {
    return this.conversations.createDirect(user, body);
  }

  @Post("groups")
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createGroupConversationSchema))
    body: CreateGroupConversationInput,
  ) {
    return this.conversations.createGroup(user, body);
  }
}

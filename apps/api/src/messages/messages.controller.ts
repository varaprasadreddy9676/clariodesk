import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  cursorPaginationSchema,
  createInternalNoteSchema,
  type CursorPagination,
  type CreateInternalNoteInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { MessagesService } from "./messages.service.js";

const reactionSchema = z.object({
  reaction: z.string().min(1).max(16),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("channels/:channelId/messages")
  timeline(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    page: CursorPagination,
  ) {
    return this.messages.timeline(user, channelId, page);
  }

  @Post("notes")
  createNote(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInternalNoteSchema))
    body: CreateInternalNoteInput,
  ) {
    return this.messages.createNote(user, body);
  }

  @Post("messages/:messageId/reactions")
  react(
    @CurrentUser() user: AuthUser,
    @Param("messageId") messageId: string,
    @Body(new ZodValidationPipe(reactionSchema))
    body: z.infer<typeof reactionSchema>,
  ) {
    return this.messages.react(user, messageId, body.reaction);
  }

  @Post("channels/:channelId/dev-seed-message")
  seedDemoMessage(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Body("body") body?: string,
  ) {
    return this.messages.seedDemoMessage(user, channelId, body);
  }

  @Post("channels/:channelId/sync-messages")
  syncMessages(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Query("limit") limit?: string,
  ) {
    return this.messages.syncMessages(
      user,
      channelId,
      limit ? Number.parseInt(limit, 10) : 50,
    );
  }
}

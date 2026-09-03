import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { AiDraftReplyService } from "./ai-draft-reply.service.js";

/** AI reply drafting, gated by ordinary channel access (any role). */
@Controller("channels")
@UseGuards(JwtAuthGuard)
export class AiDraftReplyController {
  constructor(private readonly drafts: AiDraftReplyService) {}

  @Post(":channelId/ai/draft-reply")
  draftReply(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
  ) {
    return this.drafts.draftReply(user, channelId);
  }
}

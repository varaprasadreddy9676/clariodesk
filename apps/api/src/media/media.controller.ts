import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { MediaService } from "./media.service.js";

@Controller("media")
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(":id/url")
  signedUrl(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.media.signedUrl(user, id);
  }
}

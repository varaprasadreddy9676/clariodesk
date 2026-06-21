import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ContactsService } from "./contacts.service.js";

@Controller()
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get("contacts")
  list(@CurrentUser() user: AuthUser) {
    return this.contacts.list(user);
  }

  @Get("channels/:channelId/members")
  members(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
  ) {
    return this.contacts.listChannelMembers(user, channelId);
  }
}

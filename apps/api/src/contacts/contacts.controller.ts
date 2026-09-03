import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
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

  /** Access-scoped contact search for starting a new chat (any role). */
  @Get("contacts/search")
  searchForNewChat(@CurrentUser() user: AuthUser, @Query("q") q?: string) {
    return this.contacts.searchForNewChat(user, q);
  }

  @Get("channels/:channelId/members")
  members(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
  ) {
    return this.contacts.listChannelMembers(user, channelId);
  }
}

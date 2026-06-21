import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  channelActionSchema,
  mapChannelSchema,
  updateReadStateSchema,
  type ChannelActionInput,
  type MapChannelInput,
  type UpdateReadStateInput,
} from "@clariodesk/schemas";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { AuthUser } from "../common/auth-context.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { ChannelsService } from "./channels.service.js";

@Controller("channels")
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("view") view?: string) {
    if (view && view !== "archived") {
      throw new BadRequestException("view must be 'archived' when provided");
    }
    return this.channels.list(user, view === "archived" ? "archived" : "inbox");
  }

  @Post(":channelId/actions")
  applyAction(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(channelActionSchema)) body: ChannelActionInput,
  ) {
    return this.channels.applyAction(user, channelId, body);
  }

  @Patch(":channelId/read-state")
  updateReadState(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(updateReadStateSchema))
    body: UpdateReadStateInput,
  ) {
    return this.channels.updateReadState(user, channelId, body);
  }

  @Post(":channelId/refresh")
  refresh(
    @CurrentUser() user: AuthUser,
    @Param("channelId") channelId: string,
  ) {
    return this.channels.refreshChannel(user, channelId);
  }

  @Post("map")
  map(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(mapChannelSchema)) body: MapChannelInput,
  ) {
    return this.channels.map(user, body);
  }

  /** Channel Registry review queue (group renames/metadata drift). */
  @Get("metadata-events")
  metadataEvents(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: string,
  ) {
    return this.channels.listMetadataEvents(user, status ?? "pending");
  }

  @Post("metadata-events/:id/review")
  reviewMetadataEvent(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body("resolution") resolution: string,
  ) {
    if (resolution !== "reviewed" && resolution !== "ignored") {
      throw new BadRequestException(
        "resolution must be 'reviewed' or 'ignored'",
      );
    }
    return this.channels.reviewMetadataEvent(user, id, resolution);
  }
}

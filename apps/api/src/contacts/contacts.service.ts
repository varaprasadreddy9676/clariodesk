import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { assertAdmin } from "../common/roles.js";

@Injectable()
export class ContactsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly access: AccessService,
  ) {}

  /** All workspace contacts (admin view, TDD §14.2). */
  async list(user: AuthUser) {
    assertAdmin(user);
    return this.db
      .select({
        id: schema.contacts.id,
        primaryPhone: schema.contacts.primaryPhone,
        canonicalName: schema.contacts.canonicalName,
        isInternalGlobal: schema.contacts.isInternalGlobal,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.workspaceId, user.workspaceId));
  }

  /** Members of a channel with their per-channel alias + role (TDD §14.4). */
  async listChannelMembers(user: AuthUser, channelId: string) {
    await this.access.assertChannelAccess(user, channelId);
    return this.db
      .select({
        contactId: schema.contacts.id,
        canonicalName: schema.contacts.canonicalName,
        displayNameInChannel: schema.channelMemberships.displayNameInChannel,
        roleInChannel: schema.channelMemberships.roleInChannel,
        isVerified: schema.channelMemberships.isVerified,
        isInternalOverride: schema.channelMemberships.isInternalOverride,
        lastSeenAt: schema.channelMemberships.lastSeenAt,
      })
      .from(schema.channelMemberships)
      .innerJoin(
        schema.contacts,
        eq(schema.contacts.id, schema.channelMemberships.contactId),
      )
      .where(
        and(
          eq(schema.channelMemberships.workspaceId, user.workspaceId),
          eq(schema.channelMemberships.channelId, channelId),
        ),
      );
  }
}

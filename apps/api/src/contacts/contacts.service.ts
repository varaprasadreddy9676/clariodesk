import { Inject, Injectable } from "@nestjs/common";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { assertAdmin } from "../common/roles.js";

const NEW_CHAT_SEARCH_LIMIT = 20;

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

  /**
   * Contacts a user can start a new chat with, scoped to the channels/clients
   * they're allowed to see (same access model as search.service.ts). Unlike
   * `list()`, this is not admin-only — any workspace member can search their
   * own accessible contacts to start a conversation.
   */
  async searchForNewChat(user: AuthUser, query?: string) {
    const allowed = await this.access.accessibleChannelIds(user);
    if (allowed !== "all" && allowed.length === 0) return [];

    const trimmed = query?.trim();
    const conditions = [
      eq(schema.channelMemberships.workspaceId, user.workspaceId),
    ];
    if (allowed !== "all") {
      conditions.push(inArray(schema.channelMemberships.channelId, allowed));
    }
    if (trimmed) {
      const pattern = `%${trimmed}%`;
      const textMatch = or(
        ilike(schema.contacts.canonicalName, pattern),
        ilike(schema.contacts.primaryPhone, pattern),
      );
      if (textMatch) conditions.push(textMatch);
    }

    const rows = await this.db
      .select({
        id: schema.contacts.id,
        primaryPhone: schema.contacts.primaryPhone,
        canonicalName: schema.contacts.canonicalName,
      })
      .from(schema.channelMemberships)
      .innerJoin(
        schema.contacts,
        eq(schema.contacts.id, schema.channelMemberships.contactId),
      )
      .where(and(...conditions))
      .limit(NEW_CHAT_SEARCH_LIMIT * 4);

    const byContact = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!byContact.has(row.id)) byContact.set(row.id, row);
    }
    return [...byContact.values()].slice(0, NEW_CHAT_SEARCH_LIMIT);
  }
}

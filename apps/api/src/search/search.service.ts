import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";

@Injectable()
export class SearchService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly access: AccessService,
  ) {}

  /**
   * Permission-scoped full-text search across messages and tickets (TDD §16.1,
   * §28.4). Uses the GIN tsvector indexes. Results from channels the user cannot
   * access never appear — not even as snippets (Addendum §A.4).
   */
  async search(user: AuthUser, query: string, limit = 20) {
    const q = query.trim();
    if (!q) return { messages: [], tickets: [] };

    const allowed = await this.access.accessibleChannelIds(user);
    if (allowed !== "all" && allowed.length === 0) {
      return { messages: [], tickets: [] };
    }
    const channelScope = (column: AnyPgColumn): SQL | undefined =>
      allowed === "all" ? undefined : inArray(column, allowed);

    const messageMatch = sql`to_tsvector('simple', coalesce(${schema.messages.body}, '')) @@ websearch_to_tsquery('simple', ${q})`;
    const messages = await this.db
      .select({
        id: schema.messages.id,
        channelId: schema.messages.channelId,
        body: schema.messages.body,
        providerTimestamp: schema.messages.providerTimestamp,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, user.workspaceId),
          messageMatch,
          channelScope(schema.messages.channelId),
        ),
      )
      .limit(limit);

    const ticketMatch = sql`to_tsvector('simple', coalesce(${schema.tickets.title}, '') || ' ' || coalesce(${schema.tickets.description}, '')) @@ websearch_to_tsquery('simple', ${q})`;
    const tickets = await this.db
      .select({
        id: schema.tickets.id,
        channelId: schema.tickets.channelId,
        title: schema.tickets.title,
        status: schema.tickets.status,
      })
      .from(schema.tickets)
      .where(
        and(
          eq(schema.tickets.workspaceId, user.workspaceId),
          ticketMatch,
          channelScope(schema.tickets.channelId),
        ),
      )
      .limit(limit);

    return { messages, tickets };
  }
}

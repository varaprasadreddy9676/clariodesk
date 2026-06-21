import { Inject, Injectable, ForbiddenException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "./auth-context.js";

/**
 * Permission-scoped visibility (TDD §12, Addendum §A). The cardinal rule:
 * "No assignment = no visibility." Admins see the whole workspace; agents and
 * viewers see only channels in their assigned clients plus directly assigned
 * channels. Enforced in the backend, never just hidden in the UI.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(TOKENS.DB) private readonly db: Database) {}

  /** Channel ids the user may access, or "all" for workspace admins. */
  async accessibleChannelIds(user: AuthUser): Promise<string[] | "all"> {
    if (user.role === "admin") return "all";

    const viaClient = await this.db
      .selectDistinct({ channelId: schema.channelMappings.channelId })
      .from(schema.channelMappings)
      .innerJoin(
        schema.clientAssignments,
        eq(schema.clientAssignments.clientId, schema.channelMappings.clientId),
      )
      .where(
        and(
          eq(schema.channelMappings.workspaceId, user.workspaceId),
          eq(schema.channelMappings.status, "active"),
          eq(schema.clientAssignments.userId, user.userId),
        ),
      );

    const direct = await this.db
      .selectDistinct({ channelId: schema.channelAssignments.channelId })
      .from(schema.channelAssignments)
      .where(
        and(
          eq(schema.channelAssignments.workspaceId, user.workspaceId),
          eq(schema.channelAssignments.userId, user.userId),
        ),
      );

    const ids = new Set<string>();
    for (const r of viaClient) ids.add(r.channelId);
    for (const r of direct) ids.add(r.channelId);
    return [...ids];
  }

  /** Throws unless the user may access the given channel. */
  async assertChannelAccess(user: AuthUser, channelId: string): Promise<void> {
    const allowed = await this.accessibleChannelIds(user);
    if (allowed === "all") return;
    if (!allowed.includes(channelId)) {
      throw new ForbiddenException("You do not have access to this channel");
    }
  }

  /** Client ids the user may access, or "all" for workspace admins. */
  async accessibleClientIds(user: AuthUser): Promise<string[] | "all"> {
    if (user.role === "admin") return "all";
    const rows = await this.db
      .selectDistinct({ clientId: schema.clientAssignments.clientId })
      .from(schema.clientAssignments)
      .where(
        and(
          eq(schema.clientAssignments.workspaceId, user.workspaceId),
          eq(schema.clientAssignments.userId, user.userId),
        ),
      );
    return rows.map((r) => r.clientId);
  }

  async assertClientAccess(user: AuthUser, clientId: string): Promise<void> {
    const allowed = await this.accessibleClientIds(user);
    if (allowed === "all") return;
    if (!allowed.includes(clientId)) {
      throw new ForbiddenException("You do not have access to this client");
    }
  }
}

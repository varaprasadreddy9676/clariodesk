import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";

/**
 * Workspace user ids who may see this channel — mirrors the API's
 * AccessService.accessibleChannelIds rule (TDD §12.4), but resolved in the
 * opposite direction: given a channel, who can see it. Admins always can;
 * agents/viewers need a direct channel assignment or a client assignment
 * covering the channel's active mapping.
 */
export async function usersWithChannelAccess(
  db: Database,
  workspaceId: string,
  channelId: string,
): Promise<string[]> {
  const admins = await db
    .selectDistinct({ userId: schema.workspaceUsers.userId })
    .from(schema.workspaceUsers)
    .where(
      and(
        eq(schema.workspaceUsers.workspaceId, workspaceId),
        eq(schema.workspaceUsers.role, "admin"),
        eq(schema.workspaceUsers.status, "active"),
      ),
    );

  const direct = await db
    .selectDistinct({ userId: schema.channelAssignments.userId })
    .from(schema.channelAssignments)
    .where(
      and(
        eq(schema.channelAssignments.workspaceId, workspaceId),
        eq(schema.channelAssignments.channelId, channelId),
      ),
    );

  const viaClient = await db
    .selectDistinct({ userId: schema.clientAssignments.userId })
    .from(schema.channelMappings)
    .innerJoin(
      schema.clientAssignments,
      eq(schema.clientAssignments.clientId, schema.channelMappings.clientId),
    )
    .where(
      and(
        eq(schema.channelMappings.workspaceId, workspaceId),
        eq(schema.channelMappings.channelId, channelId),
        eq(schema.channelMappings.status, "active"),
      ),
    );

  const ids = new Set<string>();
  for (const r of admins) ids.add(r.userId);
  for (const r of direct) ids.add(r.userId);
  for (const r of viaClient) ids.add(r.userId);
  return [...ids];
}

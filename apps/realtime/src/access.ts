import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";

export type Role = "admin" | "agent" | "viewer";

/**
 * Compute the channel ids a user may receive realtime events for. Mirrors the
 * API's AccessService rule (TDD §13.4): admins get all workspace channels;
 * others only their assigned clients' channels plus direct channel grants.
 */
export async function accessibleChannelIds(
  db: Database,
  workspaceId: string,
  userId: string,
  role: Role,
): Promise<string[] | "all"> {
  if (role === "admin") return "all";

  const viaClient = await db
    .selectDistinct({ channelId: schema.channelMappings.channelId })
    .from(schema.channelMappings)
    .innerJoin(
      schema.clientAssignments,
      eq(schema.clientAssignments.clientId, schema.channelMappings.clientId),
    )
    .where(
      and(
        eq(schema.channelMappings.workspaceId, workspaceId),
        eq(schema.channelMappings.status, "active"),
        eq(schema.clientAssignments.userId, userId),
      ),
    );

  const direct = await db
    .selectDistinct({ channelId: schema.channelAssignments.channelId })
    .from(schema.channelAssignments)
    .where(
      and(
        eq(schema.channelAssignments.workspaceId, workspaceId),
        eq(schema.channelAssignments.userId, userId),
      ),
    );

  const ids = new Set<string>();
  for (const r of viaClient) ids.add(r.channelId);
  for (const r of direct) ids.add(r.channelId);
  return [...ids];
}

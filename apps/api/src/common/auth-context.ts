import type { WorkspaceRole } from "@clariodesk/types";

/** The authenticated principal, resolved by the JWT guard and attached to the request. */
export type AuthUser = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

/** JWT payload shape. */
export type JwtPayload = {
  sub: string; // user id
  ws: string; // workspace id
  role: WorkspaceRole;
};

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { TeamService } from "./team.service.js";

let container: StartedPostgreSqlContainer;
let db: Database;
let service: TeamService;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  service = new TeamService(db, new AuditService(db));
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

async function seedMember(): Promise<AuthUser> {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Workspace",
    slug: `ws-${workspaceId}`,
  });
  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@example.com`,
    displayName: "Agent",
  });
  await db.insert(schema.workspaceUsers).values({
    workspaceId,
    userId,
    role: "agent",
    status: "active",
  });
  return { userId, workspaceId, role: "agent" };
}

describe("TeamService — reply signature", () => {
  it("starts with no signature and can set/clear it", async () => {
    const user = await seedMember();

    const initial = await service.getMe(user);
    expect(initial.signature).toBeNull();

    const updated = await service.updateMySignature(user, {
      signature: "L1 Team",
    });
    expect(updated.signature).toBe("L1 Team");
    expect((await service.getMe(user)).signature).toBe("L1 Team");

    const cleared = await service.updateMySignature(user, {
      signature: null,
    });
    expect(cleared.signature).toBeNull();
  });

  it("scopes the signature to one workspace membership", async () => {
    const a = await seedMember();
    const b = await seedMember();
    await service.updateMySignature(a, { signature: "L2 Team" });
    expect((await service.getMe(b)).signature).toBeNull();
  });
});

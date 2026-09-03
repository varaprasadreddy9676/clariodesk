import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { CannedResponsesService } from "./canned-responses.service.js";

let container: StartedPostgreSqlContainer;
let db: Database;
let service: CannedResponsesService;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  service = new CannedResponsesService(db, new AuditService(db));
});

afterAll(async () => {
  await closeDb();
  await container?.stop();
});

async function seedWorkspace(): Promise<{
  workspaceId: string;
  userId: string;
}> {
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
  return { workspaceId, userId };
}

function authUser(
  workspaceId: string,
  userId: string,
  role: AuthUser["role"] = "agent",
): AuthUser {
  return { userId, workspaceId, role };
}

describe("CannedResponsesService", () => {
  it("creates, lists, updates, and deletes a quick reply", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const agent = authUser(workspaceId, userId);

    const created = await service.create(agent, {
      title: "Refund policy",
      body: "We process refunds within 5 business days.",
    });
    expect(created?.title).toBe("Refund policy");

    const listed = await service.list(agent);
    expect(listed.map((r) => r.id)).toContain(created?.id);

    const updated = await service.update(agent, created!.id, {
      body: "We process refunds within 3 business days.",
    });
    expect(updated.body).toBe("We process refunds within 3 business days.");
    expect(updated.title).toBe("Refund policy"); // untouched field preserved

    const found = await service.list(agent, "refund");
    expect(found.map((r) => r.id)).toContain(created?.id);

    await service.remove(agent, created!.id);
    const afterDelete = await service.list(agent);
    expect(afterDelete.map((r) => r.id)).not.toContain(created?.id);
  });

  it("rejects a duplicate title within the same workspace", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const agent = authUser(workspaceId, userId);
    await service.create(agent, { title: "Hours", body: "9-5 Mon-Fri." });
    await expect(
      service.create(agent, { title: "Hours", body: "Different body." }),
    ).rejects.toThrow(/already exists/);
  });

  it("forbids viewers from creating, updating, or deleting", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const viewer = authUser(workspaceId, userId, "viewer");
    await expect(
      service.create(viewer, { title: "X", body: "Y" }),
    ).rejects.toThrow(ForbiddenException);

    // A viewer can still read the shared list.
    const agentWorkspace = await seedWorkspace();
    const agent = authUser(agentWorkspace.workspaceId, agentWorkspace.userId);
    const created = await service.create(agent, {
      title: "Shared",
      body: "Visible to all roles.",
    });
    const viewerInSameWorkspace = authUser(
      agentWorkspace.workspaceId,
      agentWorkspace.userId,
      "viewer",
    );
    const listed = await service.list(viewerInSameWorkspace);
    expect(listed.map((r) => r.id)).toContain(created?.id);
    await expect(
      service.update(viewerInSameWorkspace, created!.id, { body: "z" }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.remove(viewerInSameWorkspace, created!.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it("never leaks quick replies across workspaces", async () => {
    const a = await seedWorkspace();
    const b = await seedWorkspace();
    await service.create(authUser(a.workspaceId, a.userId), {
      title: "Only in A",
      body: "Body A",
    });
    const listedFromB = await service.list(authUser(b.workspaceId, b.userId));
    expect(listedFromB).toHaveLength(0);
  });
});

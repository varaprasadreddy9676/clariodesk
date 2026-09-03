import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb, schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";

// Never hit a real provider from an integration test -- stub the health
// check so create/update/test exercise the DB path only.
vi.mock("./ai-provider-health.js", () => ({
  checkAiProviderHealth: vi.fn().mockResolvedValue({ ok: true, error: null }),
}));

const { AiConnectionsService } = await import("./ai-connections.service.js");

let container: StartedPostgreSqlContainer;
let db: Database;
let service: InstanceType<typeof AiConnectionsService>;

const config = {
  ENCRYPTION_KEY: "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
} as AppConfig;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  db = getDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  service = new AiConnectionsService(db, config, new AuditService(db));
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
    displayName: "Admin",
  });
  return { workspaceId, userId };
}

function authUser(
  workspaceId: string,
  userId: string,
  role: AuthUser["role"] = "admin",
): AuthUser {
  return { userId, workspaceId, role };
}

describe("AiConnectionsService", () => {
  it("creates a connection without ever returning the key, then lists it", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const admin = authUser(workspaceId, userId);

    const created = await service.create(admin, {
      provider: "anthropic",
      label: "Anthropic (prod)",
      apiKey: "sk-ant-super-secret",
      model: "claude-sonnet-5",
    });
    expect(created?.label).toBe("Anthropic (prod)");
    expect(created).not.toHaveProperty("apiKey");
    expect(created).not.toHaveProperty("encryptedApiKey");
    expect(JSON.stringify(created)).not.toContain("sk-ant-super-secret");

    const listed = await service.list(admin);
    expect(listed.map((c) => c.id)).toContain(created?.id);
    expect(JSON.stringify(listed)).not.toContain("sk-ant-super-secret");
  });

  it("rejects a duplicate label within the same workspace", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const admin = authUser(workspaceId, userId);
    await service.create(admin, {
      provider: "openai",
      label: "OpenAI",
      apiKey: "sk-one",
    });
    await expect(
      service.create(admin, {
        provider: "openai",
        label: "OpenAI",
        apiKey: "sk-two",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("forbids non-admins from every operation", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const agent = authUser(workspaceId, userId, "agent");
    await expect(service.list(agent)).rejects.toThrow(ForbiddenException);
    await expect(
      service.create(agent, {
        provider: "openai",
        label: "X",
        apiKey: "sk-x",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("can rotate the key and disable a connection without losing its identity", async () => {
    const { workspaceId, userId } = await seedWorkspace();
    const admin = authUser(workspaceId, userId);
    const created = await service.create(admin, {
      provider: "google",
      label: "Gemini",
      apiKey: "sk-old",
    });
    const updated = await service.update(admin, created!.id, {
      apiKey: "sk-new",
      status: "disabled",
    });
    expect(updated?.status).toBe("disabled");
    expect(JSON.stringify(updated)).not.toContain("sk-new");
    expect(JSON.stringify(updated)).not.toContain("sk-old");
  });

  it("never leaks connections across workspaces", async () => {
    const a = await seedWorkspace();
    const b = await seedWorkspace();
    await service.create(authUser(a.workspaceId, a.userId), {
      provider: "openai",
      label: "Only in A",
      apiKey: "sk-a",
    });
    const listedFromB = await service.list(authUser(b.workspaceId, b.userId));
    expect(listedFromB).toHaveLength(0);
  });
});

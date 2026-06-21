import "dotenv/config";
import { eq } from "drizzle-orm";
import { loadConfig } from "@clariodesk/config";
import { getDb, closeDb, schema } from "@clariodesk/db";
import { hashPassword } from "./auth/password.js";

/**
 * Idempotent local-dev seed: one workspace, an admin, a client, a project, and
 * an (unconnected) phone instance. Safe to run repeatedly. NOT for production.
 *
 *   node apps/api/dist/seed.js
 */
const DEMO = {
  workspace: { name: "Demo Workspace", slug: "demo" },
  admin: {
    email: "admin@demo.test",
    password: "demo-password",
    displayName: "Demo Admin",
  },
  client: { name: "Acme Hospital" },
  project: { name: "ERP Implementation" },
  phone: { displayName: "Support Line", providerInstanceId: "demo-support" },
};

async function main(): Promise<void> {
  const config = loadConfig();
  const db = getDb(config.DATABASE_URL);

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO.admin.email))
    .limit(1);
  if (existing[0]) {
    console.log("Seed already applied (admin@demo.test exists). Skipping.");
    await closeDb();
    return;
  }

  const passwordHash = await hashPassword(DEMO.admin.password);
  await db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(schema.workspaces)
      .values(DEMO.workspace)
      .returning({ id: schema.workspaces.id });
    const [user] = await tx
      .insert(schema.users)
      .values({
        email: DEMO.admin.email,
        passwordHash,
        displayName: DEMO.admin.displayName,
      })
      .returning({ id: schema.users.id });
    if (!ws || !user) throw new Error("seed failed");
    await tx.insert(schema.workspaceUsers).values({
      workspaceId: ws.id,
      userId: user.id,
      role: "admin",
      status: "active",
    });
    const [client] = await tx
      .insert(schema.clients)
      .values({ workspaceId: ws.id, name: DEMO.client.name })
      .returning({ id: schema.clients.id });
    if (!client) throw new Error("seed failed");
    await tx.insert(schema.projects).values({
      workspaceId: ws.id,
      clientId: client.id,
      name: DEMO.project.name,
    });
    await tx.insert(schema.phoneInstances).values({
      workspaceId: ws.id,
      adapterType: "clario_gateway",
      displayName: DEMO.phone.displayName,
      providerInstanceId: DEMO.phone.providerInstanceId,
      gatewayBaseUrl: config.CLARIO_GATEWAY_BASE_URL,
      connectionMode: "linked_device",
      status: "qr_required",
    });
  });

  console.log(
    `Seeded workspace '${DEMO.workspace.slug}'. Login: ${DEMO.admin.email} / ${DEMO.admin.password}`,
  );
  await closeDb();
}

main().catch((err) => {
  console.error("seed failed", err);
  process.exit(1);
});

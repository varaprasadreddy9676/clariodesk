import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { JwtPayload } from "../common/auth-context.js";
import { TOKENS } from "../tokens.js";
import { hashPassword, verifyPassword } from "./password.js";

export type AuthResult = {
  token: string;
  userId: string;
  workspaceId: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Bootstrap: create a workspace and its first admin user in one transaction.
   * Used for initial setup / onboarding (FRS §34.1).
   */
  async registerWorkspace(input: {
    workspaceName: string;
    workspaceSlug: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const existing = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);
    if (existing[0]) throw new ConflictException("Email already registered");

    const passwordHash = await hashPassword(input.password);
    return this.db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(schema.workspaces)
        .values({ name: input.workspaceName, slug: input.workspaceSlug })
        .returning({ id: schema.workspaces.id });
      const [user] = await tx
        .insert(schema.users)
        .values({
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        })
        .returning({ id: schema.users.id });
      if (!ws || !user) throw new Error("failed to create workspace/user");
      await tx.insert(schema.workspaceUsers).values({
        workspaceId: ws.id,
        userId: user.id,
        role: "admin",
        status: "active",
      });
      const token = await this.sign({ sub: user.id, ws: ws.id, role: "admin" });
      return { token, userId: user.id, workspaceId: ws.id, role: "admin" };
    });
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const rows = await this.db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const user = rows[0];
    if (
      !user?.passwordHash ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const membership = await this.db
      .select({
        workspaceId: schema.workspaceUsers.workspaceId,
        role: schema.workspaceUsers.role,
      })
      .from(schema.workspaceUsers)
      .where(
        and(
          eq(schema.workspaceUsers.userId, user.id),
          eq(schema.workspaceUsers.status, "active"),
        ),
      )
      .limit(1);
    const m = membership[0];
    if (!m) throw new UnauthorizedException("No active workspace membership");

    const token = await this.sign({
      sub: user.id,
      ws: m.workspaceId,
      role: m.role,
    });
    return { token, userId: user.id, workspaceId: m.workspaceId, role: m.role };
  }

  private sign(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}

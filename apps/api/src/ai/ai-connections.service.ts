import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import { encryptSecret, decryptSecret } from "@clariodesk/crypto";
import type {
  CreateAiProviderConnectionInput,
  UpdateAiProviderConnectionInput,
} from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";
import { checkAiProviderHealth } from "./ai-provider-health.js";

// Never select the encrypted key itself into an API response — decrypt it
// only transiently, inside this service, when a provider call needs it.
const PUBLIC_COLUMNS = {
  id: schema.aiProviderConnections.id,
  provider: schema.aiProviderConnections.provider,
  label: schema.aiProviderConnections.label,
  baseUrl: schema.aiProviderConnections.baseUrl,
  model: schema.aiProviderConnections.model,
  status: schema.aiProviderConnections.status,
  lastHealthCheckAt: schema.aiProviderConnections.lastHealthCheckAt,
  lastHealthCheckOk: schema.aiProviderConnections.lastHealthCheckOk,
  lastHealthCheckError: schema.aiProviderConnections.lastHealthCheckError,
  createdAt: schema.aiProviderConnections.createdAt,
  updatedAt: schema.aiProviderConnections.updatedAt,
};

/**
 * BYOK provider-connection management (docs/ai/ai-native-byok-architecture.md).
 * Foundation only: stores/tests encrypted keys. No AI feature reads from
 * this yet — that's later work, layered on top once this exists.
 */
@Injectable()
export class AiConnectionsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    assertAdmin(user);
    return this.db
      .select(PUBLIC_COLUMNS)
      .from(schema.aiProviderConnections)
      .where(eq(schema.aiProviderConnections.workspaceId, user.workspaceId))
      .orderBy(schema.aiProviderConnections.label);
  }

  async create(user: AuthUser, input: CreateAiProviderConnectionInput) {
    assertAdmin(user);
    const existing = await this.db
      .select({ id: schema.aiProviderConnections.id })
      .from(schema.aiProviderConnections)
      .where(
        and(
          eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
          eq(schema.aiProviderConnections.label, input.label),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw new ConflictException(
        "A connection with this label already exists",
      );
    }

    const health = await checkAiProviderHealth(
      input.provider,
      input.apiKey,
      input.baseUrl,
    );

    const [created] = await this.db
      .insert(schema.aiProviderConnections)
      .values({
        workspaceId: user.workspaceId,
        provider: input.provider,
        label: input.label,
        encryptedApiKey: encryptSecret(
          input.apiKey,
          this.config.ENCRYPTION_KEY,
        ),
        baseUrl: input.baseUrl ?? null,
        model: input.model ?? null,
        createdByUserId: user.userId,
        lastHealthCheckAt: new Date(),
        lastHealthCheckOk: health.ok,
        lastHealthCheckError: health.error,
      })
      .returning(PUBLIC_COLUMNS);
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "ai_connection.created",
      targetType: "ai_provider_connection",
      targetId: created?.id,
      metadata: { provider: input.provider },
    });
    return created;
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateAiProviderConnectionInput,
  ) {
    assertAdmin(user);
    const [existing] = await this.db
      .select()
      .from(schema.aiProviderConnections)
      .where(
        and(
          eq(schema.aiProviderConnections.id, id),
          eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException("Connection not found");

    if (input.label && input.label !== existing.label) {
      const clash = await this.db
        .select({ id: schema.aiProviderConnections.id })
        .from(schema.aiProviderConnections)
        .where(
          and(
            eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
            eq(schema.aiProviderConnections.label, input.label),
          ),
        )
        .limit(1);
      if (clash[0]) {
        throw new ConflictException(
          "A connection with this label already exists",
        );
      }
    }

    const [updated] = await this.db
      .update(schema.aiProviderConnections)
      .set({
        ...(input.label ? { label: input.label } : {}),
        ...(input.apiKey
          ? {
              encryptedApiKey: encryptSecret(
                input.apiKey,
                this.config.ENCRYPTION_KEY,
              ),
            }
          : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiProviderConnections.id, id))
      .returning(PUBLIC_COLUMNS);
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "ai_connection.updated",
      targetType: "ai_provider_connection",
      targetId: id,
    });
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    assertAdmin(user);
    const [deleted] = await this.db
      .delete(schema.aiProviderConnections)
      .where(
        and(
          eq(schema.aiProviderConnections.id, id),
          eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
        ),
      )
      .returning({ id: schema.aiProviderConnections.id });
    if (!deleted) throw new NotFoundException("Connection not found");
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "ai_connection.deleted",
      targetType: "ai_provider_connection",
      targetId: deleted.id,
    });
    return { ok: true };
  }

  /** Re-run the health check against the already-stored (decrypted) key. */
  async testConnection(user: AuthUser, id: string) {
    assertAdmin(user);
    const [existing] = await this.db
      .select()
      .from(schema.aiProviderConnections)
      .where(
        and(
          eq(schema.aiProviderConnections.id, id),
          eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException("Connection not found");

    const apiKey = decryptSecret(
      existing.encryptedApiKey,
      this.config.ENCRYPTION_KEY,
    );
    const health = await checkAiProviderHealth(
      existing.provider,
      apiKey,
      existing.baseUrl,
    );
    const [updated] = await this.db
      .update(schema.aiProviderConnections)
      .set({
        lastHealthCheckAt: new Date(),
        lastHealthCheckOk: health.ok,
        lastHealthCheckError: health.error,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiProviderConnections.id, id))
      .returning(PUBLIC_COLUMNS);
    return updated;
  }
}

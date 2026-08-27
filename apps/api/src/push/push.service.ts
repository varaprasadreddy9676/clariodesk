import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import type {
  PushSubscribeInput,
  PushUnsubscribeInput,
} from "@clariodesk/schemas";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";

@Injectable()
export class PushService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
  ) {}

  /** The public VAPID key the frontend needs to create a push subscription. */
  vapidPublicKey(): { publicKey: string | null } {
    return { publicKey: this.config.VAPID_PUBLIC_KEY ?? null };
  }

  /** Registers (or refreshes) one browser/device subscription for this user. */
  async subscribe(
    user: AuthUser,
    input: PushSubscribeInput,
  ): Promise<{ ok: true }> {
    await this.db
      .insert(schema.pushSubscriptions)
      .values({
        workspaceId: user.workspaceId,
        userId: user.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: {
          userId: user.userId,
          workspaceId: user.workspaceId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  }

  /** Removes one subscription — called on logout or when the user disables push. */
  async unsubscribe(
    user: AuthUser,
    input: PushUnsubscribeInput,
  ): Promise<{ ok: true }> {
    await this.db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, user.userId),
          eq(schema.pushSubscriptions.endpoint, input.endpoint),
        ),
      );
    return { ok: true };
  }
}

import webpush from "web-push";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import type { Logger } from "@clariodesk/logger";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Groups notifications from the same conversation into one (browser tag). */
  tag: string;
};

/**
 * Thin wrapper around web-push. No-ops when VAPID keys aren't configured, so
 * self-hosters who skip push setup don't get startup failures or noisy errors.
 */
export class PushService {
  private readonly enabled: boolean;

  constructor(
    config: AppConfig,
    private readonly db: Database,
    private readonly logger: Logger,
  ) {
    this.enabled = Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
    if (this.enabled) {
      webpush.setVapidDetails(
        config.VAPID_SUBJECT,
        config.VAPID_PUBLIC_KEY!,
        config.VAPID_PRIVATE_KEY!,
      );
    } else {
      this.logger.warn(
        "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications disabled",
      );
    }
  }

  /** Sends to every subscription owned by these users. Prunes dead ones (410/404). */
  async notifyUsers(
    workspaceId: string,
    userIds: string[],
    payload: PushPayload,
  ): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;

    const subs = await this.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.workspaceId, workspaceId));

    const targets = subs.filter((s) => userIds.includes(s.userId));
    await Promise.all(targets.map((sub) => this.sendOne(sub, payload)));
  }

  private async sendOne(
    sub: typeof schema.pushSubscriptions.$inferSelect,
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription is gone (uninstalled, browser data cleared, expired).
        await this.db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id));
        return;
      }
      this.logger.warn(
        { err: String(err), subscriptionId: sub.id },
        "push send failed",
      );
    }
  }
}

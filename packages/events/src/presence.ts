import { Redis } from "ioredis";

/**
 * Tracks which users currently have an active realtime (Socket.io) connection,
 * per workspace. Used to skip push notifications for users who already have
 * the app open — sending both a live update AND a push would be noisy.
 *
 * Coarse-grained by design (workspace-wide, not per-channel): a user with the
 * app open anywhere gets no push, even for a different conversation. Per-
 * channel presence would need the frontend to report which channel is
 * focused; that's a reasonable v0.2 follow-up, not needed for the MVP.
 */

const PRESENCE_TTL_SECONDS = 90; // refreshed by a 30s heartbeat while connected

function presenceKey(workspaceId: string): string {
  return `clariodesk:presence:${workspaceId}`;
}

export class PresenceTracker {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }

  /** Mark a user online. Call again periodically (heartbeat) to keep it fresh. */
  async markOnline(workspaceId: string, userId: string): Promise<void> {
    const key = presenceKey(workspaceId);
    await this.redis.hset(key, userId, Date.now().toString());
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  async markOffline(workspaceId: string, userId: string): Promise<void> {
    await this.redis.hdel(presenceKey(workspaceId), userId);
  }

  /** User ids whose last heartbeat is within the freshness window. */
  async onlineUserIds(workspaceId: string): Promise<Set<string>> {
    const entries = await this.redis.hgetall(presenceKey(workspaceId));
    const cutoffMs = Date.now() - PRESENCE_TTL_SECONDS * 1000;
    const online = new Set<string>();
    for (const [userId, tsRaw] of Object.entries(entries)) {
      if (Number(tsRaw) >= cutoffMs) online.add(userId);
    }
    return online;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

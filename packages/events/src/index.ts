import { Redis } from "ioredis";

/**
 * Lightweight realtime event bus over Redis pub/sub (TDD §13). The API and
 * worker publish domain events; the realtime server subscribes and relays them
 * to permission-scoped Socket.io rooms. Decoupled so no runtime imports another.
 */

export const REALTIME_CHANNEL = "clariodesk:realtime";

export type RealtimeEventType =
  | "message.received"
  | "message.updated"
  | "outbox.status_changed"
  | "ticket.created"
  | "ticket.updated"
  | "note.created"
  | "channel.updated"
  | "channel.read_state_changed"
  | "phone.status_changed";

/**
 * An event always carries the workspace; `channelId` (when present) determines
 * which permission-scoped room it is relayed to. Payload is small + non-sensitive.
 */
export interface RealtimeEvent {
  type: RealtimeEventType;
  workspaceId: string;
  channelId?: string;
  ticketId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

/** Publishes events. One per process; reuses a single Redis connection. */
export class RealtimePublisher {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }

  async publish(event: RealtimeEvent): Promise<void> {
    // Fire-and-forget; realtime delivery must never break the write path.
    try {
      await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
    } catch {
      // swallow — realtime is best-effort
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/** Subscribes to the bus and invokes `onEvent` for each parsed event. */
export function createEventSubscriber(
  redisUrl: string,
  onEvent: (event: RealtimeEvent) => void,
): Redis {
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
  void sub.subscribe(REALTIME_CHANNEL);
  sub.on("message", (_channel, message) => {
    try {
      onEvent(JSON.parse(message) as RealtimeEvent);
    } catch {
      // ignore malformed payloads
    }
  });
  return sub;
}

/**
 * Backpressure / reconnect-storm assessment (TDD §8.6, §19.3).
 *
 * When a linked-device phone reconnects after downtime it can dump a large
 * backlog in one webhook. Stale/live classification already prevents those
 * messages from triggering automation, but the sheer volume can still saturate
 * the database and media pipeline. These pure helpers decide when to throttle.
 */

export type StormAssessment = {
  isStorm: boolean;
  /** Per-event delay to apply while draining, in milliseconds. */
  throttleMs: number;
};

/**
 * A batch is a "storm" when it carries more events than the threshold, OR when
 * the gateway already flagged it as a reconnect/history sync. Storms are drained
 * with a small per-event delay so live traffic on other phones keeps flowing.
 */
export function assessBatch(input: {
  eventCount: number;
  isReconnectSync: boolean;
  stormThreshold: number;
  throttleMs: number;
}): StormAssessment {
  const isStorm =
    input.isReconnectSync || input.eventCount > input.stormThreshold;
  return {
    isStorm,
    throttleMs: isStorm ? Math.max(0, input.throttleMs) : 0,
  };
}

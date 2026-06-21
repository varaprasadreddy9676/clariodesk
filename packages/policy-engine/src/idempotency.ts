import { createHash } from "node:crypto";

/**
 * Deduplication keys (TDD §8.4). A message can arrive twice — once from the live
 * webhook and once from a backfill/history batch — and a dashboard-sent message
 * arrives again as the gateway's outbound echo. All must collapse to one row.
 */

/** Primary key: stable when the gateway provides a reliable per-message id. */
export function idempotencyKey(
  workspaceId: string,
  channelId: string,
  providerMessageId: string,
): string {
  return `${workspaceId}:${channelId}:${providerMessageId}`;
}

export type FingerprintInput = {
  providerChatId: string;
  senderId: string;
  providerTimestampMs: number;
  messageType: string;
  /** Message body, or a stable media reference when there is no body. */
  bodyOrMediaRef: string;
};

/**
 * Fallback fingerprint for gateways whose message ids are unreliable
 * (TDD §8.4). Note: timestamps are coarse, so two identical messages within the
 * same second collide — acceptable for dedup, documented as a known tradeoff.
 */
export function fingerprintKey(input: FingerprintInput): string {
  const content = createHash("sha256")
    .update(input.bodyOrMediaRef)
    .digest("hex");
  return [
    input.providerChatId,
    input.senderId,
    input.providerTimestampMs,
    input.messageType,
    content,
  ].join(":");
}

import type { MessageDirection } from "@clariodesk/types";

/**
 * Outbound echo reconciliation (TDD §8.4 review note + §10.6).
 *
 * Linked-device gateways re-emit every message the dashboard sent as an inbound
 * webhook ("echo"). Without this, every reply would appear twice. When an
 * outbound event arrives, we look for a pending outbox row that recorded this
 * provider_message_id at send time and MERGE into it instead of inserting.
 *
 * This is also how a "ghost agent" reply (sent directly from the physical phone,
 * never through our outbox) is distinguished: it's outbound but has no matching
 * outbox row, so it becomes a new message attributed to `phone_user`.
 */

export type EchoDecision =
  | { action: "merge_into_outbox"; outboxId: string }
  | { action: "new_ghost_agent_message" }
  | { action: "new_inbound_message" };

export type EchoInput = {
  direction: MessageDirection;
  /** The outbox row whose providerMessageId matches this event, if any. */
  matchingOutboxId: string | null;
};

export function reconcileEcho(input: EchoInput): EchoDecision {
  if (input.direction === "inbound") {
    return { action: "new_inbound_message" };
  }
  // Outbound:
  if (input.matchingOutboxId) {
    return { action: "merge_into_outbox", outboxId: input.matchingOutboxId };
  }
  // Outbound with no outbox row = replied from the physical device.
  return { action: "new_ghost_agent_message" };
}

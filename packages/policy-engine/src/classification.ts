import {
  NON_OPERATIONAL_MESSAGE_TYPES,
  type MappingMode,
  type MessageDirection,
  type MessageType,
} from "@clariodesk/types";

/**
 * The single most important safety computation in the platform.
 *
 * Decides whether an incoming message is a LIVE operational event (eligible for
 * SLA, automation, ticket auto-create, notifications) or HISTORICAL/STALE
 * context that must never trigger any of those (FRS §11, §2.2; TDD §8.5).
 *
 * Pure function — no I/O, deterministic, exhaustively unit-tested.
 */

export type ClassificationInput = {
  providerTimestampMs: number;
  /** now() injected for determinism in tests. */
  nowMs: number;
  /** Effective mapping boundary; null when the channel is unmapped. */
  mappingEffectiveAtMs: number | null;
  mappingMode: MappingMode;
  /** Gateway flagged this as part of a history-sync batch. */
  isHistorySync: boolean;
  /** Phone is in a reconnect/backlog drain phase. */
  isReconnectSync: boolean;
  /** Messages older than this (seconds) during reconnect are stale. */
  staleSyncThresholdSeconds: number;
  /** Operator explicitly imported this via a backfill job. */
  explicitBackfill: boolean;
  direction: MessageDirection;
  messageType: MessageType;
  /** Sender resolved to an internal workspace user/agent (FRS §14.6). */
  senderIsInternal: boolean;
  /** Phone instance is restricted/degraded — suppress outbound automation. */
  phoneRestricted: boolean;
};

export type SuppressionReason =
  | "historical_backfill"
  | "stale_sync"
  | "history_sync_event"
  | "explicit_backfill"
  | "unmapped_channel"
  | "mixed_channel"
  | "internal_sender"
  | "phone_restricted"
  | "non_operational_message_type";

export type ClassificationResult = {
  isBackfill: boolean;
  isLiveEvent: boolean;
  automationSuppressed: boolean;
  automationSuppressedReason: SuppressionReason | null;
  slaEligible: boolean;
  ticketAutoCreateEligible: boolean;
};

const BACKFILL_RESULT = (reason: SuppressionReason): ClassificationResult => ({
  isBackfill: true,
  isLiveEvent: false,
  automationSuppressed: true,
  automationSuppressedReason: reason,
  slaEligible: false,
  ticketAutoCreateEligible: false,
});

export function classifyMessage(
  input: ClassificationInput,
): ClassificationResult {
  // ── 1. Backfill / stale detection (highest precedence) ──
  // Order matters only for the reported reason; all paths suppress everything.
  if (input.explicitBackfill) return BACKFILL_RESULT("explicit_backfill");
  if (input.isHistorySync) return BACKFILL_RESULT("history_sync_event");

  if (
    input.mappingEffectiveAtMs !== null &&
    input.providerTimestampMs < input.mappingEffectiveAtMs
  ) {
    return BACKFILL_RESULT("historical_backfill");
  }

  if (input.isReconnectSync) {
    const ageSeconds = (input.nowMs - input.providerTimestampMs) / 1000;
    if (ageSeconds > input.staleSyncThresholdSeconds) {
      return BACKFILL_RESULT("stale_sync");
    }
  }

  // ── 2. The message is live. Decide operational eligibility ──
  const result: ClassificationResult = {
    isBackfill: false,
    isLiveEvent: true,
    automationSuppressed: false,
    automationSuppressedReason: null,
    slaEligible: false,
    ticketAutoCreateEligible: false,
  };

  // Reactions / system / deleted never drive operations (TDD §6.11 note).
  if (NON_OPERATIONAL_MESSAGE_TYPES.has(input.messageType)) {
    result.automationSuppressed = true;
    result.automationSuppressedReason = "non_operational_message_type";
    return result;
  }

  // Unmapped channels store messages but trigger nothing (FRS §10.4).
  if (input.mappingMode === "unmapped" || input.mappingEffectiveAtMs === null) {
    result.automationSuppressed = true;
    result.automationSuppressedReason = "unmapped_channel";
    return result;
  }

  // Restricted phone: keep ingesting, but no outbound automation may fire.
  if (input.phoneRestricted) {
    result.automationSuppressed = true;
    result.automationSuppressedReason = "phone_restricted";
  }

  // Only inbound, client-side, single-client messages start client SLA and are
  // ticket-auto-create eligible (FRS §20.2; TDD §14.3).
  const isClientInbound =
    input.direction === "inbound" && !input.senderIsInternal;

  if (input.senderIsInternal) {
    // Internal chatter doesn't start client SLA (FRS §14.6) but is otherwise live.
    result.automationSuppressed = result.automationSuppressed || true;
    result.automationSuppressedReason =
      result.automationSuppressedReason ?? "internal_sender";
  }

  if (input.mappingMode === "mixed") {
    // Mixed groups: automation + SLA off by default (FRS §P.5.1; TDD §11.4).
    result.automationSuppressed = true;
    result.automationSuppressedReason =
      result.automationSuppressedReason ?? "mixed_channel";
    return result;
  }

  if (input.mappingMode === "single_client" && isClientInbound) {
    result.slaEligible = !result.automationSuppressed;
    result.ticketAutoCreateEligible = !result.automationSuppressed;
  }

  return result;
}

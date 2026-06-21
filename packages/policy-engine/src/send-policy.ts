import type {
  ConnectionMode,
  MappingMode,
  PhoneStatus,
} from "@clariodesk/types";

/**
 * Outbound send gate (TDD §10.2; FRS §8.3.3). Evaluated for every outbox row
 * before dispatch. Pure and deterministic so the same inputs always produce the
 * same verdict and it can be exhaustively tested.
 */

export type SendPolicyInput = {
  phoneStatus: PhoneStatus;
  connectionMode: ConnectionMode;
  mappingMode: MappingMode;
  /** True if a per-group/per-thread cooldown is currently active. */
  cooldownActive: boolean;
  /** True if the workspace/client spend cap is already exceeded (official API). */
  costLimitExceeded: boolean;
  /** Recipient count for this send (1 for a normal reply). */
  recipientCount: number;
  /** Bulk thresholds (FRS §O.1.5). */
  mediumRiskThreshold: number; // default 10
  highRiskThreshold: number; // default 25
  /** Whether the actor is an admin (can approve high-risk). */
  actorIsAdmin: boolean;
};

export type SendPolicyVerdict = {
  status: "allowed" | "blocked" | "needs_approval";
  reason: string;
  riskLevel: "low" | "medium" | "high";
};

export function evaluateSendPolicy(input: SendPolicyInput): SendPolicyVerdict {
  // ── Hard blocks ──
  if (input.phoneStatus === "restricted" || input.phoneStatus === "archived") {
    return block(`phone is ${input.phoneStatus}`);
  }
  if (
    input.phoneStatus === "disconnected" ||
    input.phoneStatus === "qr_required"
  ) {
    return block(`phone not connected (${input.phoneStatus})`);
  }
  if (input.costLimitExceeded && input.connectionMode === "official_api") {
    return block("official API cost limit exceeded (FRS §35.6)");
  }
  if (input.cooldownActive) {
    return block("outbound cooldown active for this channel/thread");
  }

  // ── Bulk blast-radius control (FRS §O.1) ──
  const risk = riskLevel(
    input.recipientCount,
    input.mediumRiskThreshold,
    input.highRiskThreshold,
  );
  if (risk === "high" && !input.actorIsAdmin) {
    return {
      status: "needs_approval",
      reason: `bulk send to ${input.recipientCount} groups requires admin approval`,
      riskLevel: "high",
    };
  }
  if (risk === "medium") {
    return {
      status: "needs_approval",
      reason: `bulk send to ${input.recipientCount} groups requires confirmation`,
      riskLevel: "medium",
    };
  }

  return { status: "allowed", reason: "ok", riskLevel: risk };
}

function block(reason: string): SendPolicyVerdict {
  return { status: "blocked", reason, riskLevel: "low" };
}

function riskLevel(
  recipients: number,
  medium: number,
  high: number,
): "low" | "medium" | "high" {
  if (recipients >= high) return "high";
  if (recipients >= medium) return "medium";
  return "low";
}

/**
 * Randomized human-like delay between bulk linked-device sends (FRS §O.1.3) to
 * avoid spam-like bursts that get numbers banned. Injectable RNG for tests.
 */
export function bulkSendDelayMs(
  minMs = 12_000,
  maxMs = 28_000,
  rng: () => number = Math.random,
): number {
  const span = Math.max(0, maxMs - minMs);
  return Math.round(minMs + rng() * span);
}

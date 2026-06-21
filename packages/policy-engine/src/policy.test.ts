import { describe, expect, it } from "vitest";
import {
  bulkSendDelayMs,
  evaluateSendPolicy,
  type SendPolicyInput,
} from "./send-policy.js";
import { reconcileEcho } from "./echo.js";
import { resolveIsInternal } from "./internal-sender.js";
import { fingerprintKey, idempotencyKey } from "./idempotency.js";

function sendBase(o: Partial<SendPolicyInput> = {}): SendPolicyInput {
  return {
    phoneStatus: "connected",
    connectionMode: "linked_device",
    mappingMode: "single_client",
    cooldownActive: false,
    costLimitExceeded: false,
    recipientCount: 1,
    mediumRiskThreshold: 10,
    highRiskThreshold: 25,
    actorIsAdmin: false,
    ...o,
  };
}

describe("evaluateSendPolicy (P0 send gate)", () => {
  it("allows a normal single reply on a connected mapped phone", () => {
    expect(evaluateSendPolicy(sendBase()).status).toBe("allowed");
  });

  it("blocks when phone is restricted", () => {
    expect(
      evaluateSendPolicy(sendBase({ phoneStatus: "restricted" })).status,
    ).toBe("blocked");
  });

  it("blocks when phone is disconnected", () => {
    expect(
      evaluateSendPolicy(sendBase({ phoneStatus: "disconnected" })).status,
    ).toBe("blocked");
  });

  it("allows sends to unmapped channels", () => {
    expect(
      evaluateSendPolicy(sendBase({ mappingMode: "unmapped" })).status,
    ).toBe("allowed");
  });

  it("blocks official sends past the cost cap", () => {
    expect(
      evaluateSendPolicy(
        sendBase({ connectionMode: "official_api", costLimitExceeded: true }),
      ).status,
    ).toBe("blocked");
  });

  it("blocks while a cooldown is active", () => {
    expect(evaluateSendPolicy(sendBase({ cooldownActive: true })).status).toBe(
      "blocked",
    );
  });

  it("requires confirmation for medium bulk (>=10 groups)", () => {
    const v = evaluateSendPolicy(sendBase({ recipientCount: 12 }));
    expect(v.status).toBe("needs_approval");
    expect(v.riskLevel).toBe("medium");
  });

  it("requires admin approval for high bulk (>=25 groups)", () => {
    const v = evaluateSendPolicy(sendBase({ recipientCount: 40 }));
    expect(v.status).toBe("needs_approval");
    expect(v.riskLevel).toBe("high");
  });

  it("admin may proceed with high bulk", () => {
    const v = evaluateSendPolicy(
      sendBase({ recipientCount: 40, actorIsAdmin: true }),
    );
    expect(v.status).toBe("allowed");
  });
});

describe("bulkSendDelayMs jitter", () => {
  it("stays within the configured window", () => {
    expect(bulkSendDelayMs(12_000, 28_000, () => 0)).toBe(12_000);
    expect(bulkSendDelayMs(12_000, 28_000, () => 1)).toBe(28_000);
    expect(bulkSendDelayMs(12_000, 28_000, () => 0.5)).toBe(20_000);
  });
});

describe("reconcileEcho (no duplicate dashboard replies)", () => {
  it("merges an outbound echo into its outbox row", () => {
    expect(
      reconcileEcho({ direction: "outbound", matchingOutboxId: "ob-1" }),
    ).toEqual({ action: "merge_into_outbox", outboxId: "ob-1" });
  });

  it("treats an unmatched outbound as a ghost-agent (phone) reply", () => {
    expect(
      reconcileEcho({ direction: "outbound", matchingOutboxId: null }),
    ).toEqual({ action: "new_ghost_agent_message" });
  });

  it("treats inbound as a new message", () => {
    expect(
      reconcileEcho({ direction: "inbound", matchingOutboxId: null }),
    ).toEqual({ action: "new_inbound_message" });
  });
});

describe("resolveIsInternal precedence", () => {
  it("explicit membership override wins", () => {
    expect(
      resolveIsInternal({
        membershipInternalOverride: false,
        senderMatchesWorkspaceUser: true,
        senderIsPhoneOwner: true,
      }),
    ).toBe(false);
  });

  it("falls back to workspace-user identity", () => {
    expect(
      resolveIsInternal({
        membershipInternalOverride: null,
        senderMatchesWorkspaceUser: true,
        senderIsPhoneOwner: false,
      }),
    ).toBe(true);
  });

  it("unknown sender is external", () => {
    expect(
      resolveIsInternal({
        membershipInternalOverride: null,
        senderMatchesWorkspaceUser: false,
        senderIsPhoneOwner: false,
      }),
    ).toBe(false);
  });
});

describe("idempotency keys", () => {
  it("composes the primary key deterministically", () => {
    expect(idempotencyKey("ws", "ch", "m1")).toBe("ws:ch:m1");
  });

  it("fingerprint is stable for identical content and varies by body", () => {
    const a = fingerprintKey({
      providerChatId: "c",
      senderId: "s",
      providerTimestampMs: 1,
      messageType: "text",
      bodyOrMediaRef: "hello",
    });
    const b = fingerprintKey({
      providerChatId: "c",
      senderId: "s",
      providerTimestampMs: 1,
      messageType: "text",
      bodyOrMediaRef: "hello",
    });
    const c = fingerprintKey({
      providerChatId: "c",
      senderId: "s",
      providerTimestampMs: 1,
      messageType: "text",
      bodyOrMediaRef: "different",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

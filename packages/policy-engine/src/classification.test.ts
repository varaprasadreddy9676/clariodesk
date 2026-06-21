import { describe, expect, it } from "vitest";
import { classifyMessage, type ClassificationInput } from "./classification.js";

const NOW = 1_717_000_000_000;

/** A live, mapped, client-side inbound text — the "happy path" baseline. */
function base(
  overrides: Partial<ClassificationInput> = {},
): ClassificationInput {
  return {
    providerTimestampMs: NOW,
    nowMs: NOW,
    mappingEffectiveAtMs: NOW - 60_000, // mapped a minute ago
    mappingMode: "single_client",
    isHistorySync: false,
    isReconnectSync: false,
    staleSyncThresholdSeconds: 900,
    explicitBackfill: false,
    direction: "inbound",
    messageType: "text",
    senderIsInternal: false,
    phoneRestricted: false,
    ...overrides,
  };
}

describe("classifyMessage — backfill/stale suppression (P0)", () => {
  it("live client message is SLA + ticket eligible", () => {
    const r = classifyMessage(base());
    expect(r).toEqual({
      isBackfill: false,
      isLiveEvent: true,
      automationSuppressed: false,
      automationSuppressedReason: null,
      slaEligible: true,
      ticketAutoCreateEligible: true,
    });
  });

  it("message before mapping boundary is historical backfill", () => {
    const r = classifyMessage(
      base({ providerTimestampMs: base().mappingEffectiveAtMs! - 1 }),
    );
    expect(r.isBackfill).toBe(true);
    expect(r.isLiveEvent).toBe(false);
    expect(r.slaEligible).toBe(false);
    expect(r.ticketAutoCreateEligible).toBe(false);
    expect(r.automationSuppressed).toBe(true);
    expect(r.automationSuppressedReason).toBe("historical_backfill");
  });

  it("history-sync batch is suppressed regardless of timestamp", () => {
    const r = classifyMessage(base({ isHistorySync: true }));
    expect(r.automationSuppressedReason).toBe("history_sync_event");
    expect(r.slaEligible).toBe(false);
  });

  it("explicit backfill import is suppressed with highest precedence", () => {
    const r = classifyMessage(
      base({ explicitBackfill: true, isHistorySync: true }),
    );
    expect(r.automationSuppressedReason).toBe("explicit_backfill");
  });

  it("stale message during reconnect sync is suppressed", () => {
    const r = classifyMessage(
      base({
        // Channel mapped long ago, so the old message is AFTER the boundary
        // (not historical) but still stale relative to now on reconnect.
        mappingEffectiveAtMs: NOW - 30 * 24 * 3600 * 1000,
        isReconnectSync: true,
        providerTimestampMs: NOW - 1_000_000, // ~16 min old > 900s
      }),
    );
    expect(r.isBackfill).toBe(true);
    expect(r.automationSuppressedReason).toBe("stale_sync");
  });

  it("recent message during reconnect sync stays live", () => {
    const r = classifyMessage(
      base({ isReconnectSync: true, providerTimestampMs: NOW - 10_000 }),
    );
    expect(r.isLiveEvent).toBe(true);
    expect(r.slaEligible).toBe(true);
  });
});

describe("classifyMessage — live eligibility rules", () => {
  it("unmapped channel stores but triggers nothing", () => {
    const r = classifyMessage(
      base({ mappingMode: "unmapped", mappingEffectiveAtMs: null }),
    );
    expect(r.isLiveEvent).toBe(true);
    expect(r.automationSuppressed).toBe(true);
    expect(r.automationSuppressedReason).toBe("unmapped_channel");
    expect(r.slaEligible).toBe(false);
  });

  it("mixed channel disables automation + SLA by default", () => {
    const r = classifyMessage(base({ mappingMode: "mixed" }));
    expect(r.automationSuppressed).toBe(true);
    expect(r.automationSuppressedReason).toBe("mixed_channel");
    expect(r.slaEligible).toBe(false);
    expect(r.ticketAutoCreateEligible).toBe(false);
  });

  it("internal sender does not start client SLA", () => {
    const r = classifyMessage(base({ senderIsInternal: true }));
    expect(r.slaEligible).toBe(false);
    expect(r.automationSuppressedReason).toBe("internal_sender");
  });

  it("outbound message is never client-SLA eligible", () => {
    const r = classifyMessage(base({ direction: "outbound" }));
    expect(r.slaEligible).toBe(false);
    expect(r.ticketAutoCreateEligible).toBe(false);
  });

  it("reactions/system/deleted are non-operational", () => {
    for (const messageType of ["reaction", "system", "deleted"] as const) {
      const r = classifyMessage(base({ messageType }));
      expect(r.automationSuppressedReason).toBe("non_operational_message_type");
      expect(r.slaEligible).toBe(false);
    }
  });

  it("restricted phone suppresses outbound automation but keeps message live", () => {
    const r = classifyMessage(base({ phoneRestricted: true }));
    expect(r.isLiveEvent).toBe(true);
    expect(r.automationSuppressed).toBe(true);
    expect(r.slaEligible).toBe(false);
  });
});

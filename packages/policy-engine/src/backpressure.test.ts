import { describe, expect, it } from "vitest";
import { assessBatch } from "./backpressure.js";

describe("assessBatch (reconnect-storm backpressure)", () => {
  const base = { stormThreshold: 100, throttleMs: 25 };

  it("treats a small live batch as normal", () => {
    expect(
      assessBatch({ ...base, eventCount: 3, isReconnectSync: false }),
    ).toEqual({ isStorm: false, throttleMs: 0 });
  });

  it("flags a large batch as a storm and applies throttle", () => {
    expect(
      assessBatch({ ...base, eventCount: 250, isReconnectSync: false }),
    ).toEqual({ isStorm: true, throttleMs: 25 });
  });

  it("flags a reconnect-sync batch as a storm regardless of size", () => {
    const r = assessBatch({ ...base, eventCount: 2, isReconnectSync: true });
    expect(r.isStorm).toBe(true);
    expect(r.throttleMs).toBe(25);
  });

  it("never returns a negative throttle", () => {
    const r = assessBatch({
      eventCount: 500,
      isReconnectSync: true,
      stormThreshold: 100,
      throttleMs: -10,
    });
    expect(r.throttleMs).toBe(0);
  });
});

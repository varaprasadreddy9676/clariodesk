import { describe, expect, it } from "vitest";
import { mediaKey, rawEventKey } from "./keys.js";

const at = new Date("2026-06-12T09:05:00Z");

describe("storage key builders", () => {
  it("builds a date-partitioned raw-event key", () => {
    expect(rawEventKey("ws1", "evt9", at)).toBe(
      "raw-events/ws1/2026/06/12/evt9.json.gz",
    );
  });

  it("builds a media key with an opaque id, never the filename", () => {
    const key = mediaKey({
      workspaceId: "ws1",
      clientId: "cl1",
      channelId: "ch1",
      messageId: "m1",
      mediaId: "media-abc",
      at,
    });
    expect(key).toBe("media/ws1/cl1/ch1/2026/06/m1/media-abc");
    expect(key).not.toContain("Invoice");
  });

  it("uses an _unmapped segment when client is null", () => {
    const key = mediaKey({
      workspaceId: "ws1",
      clientId: null,
      channelId: "ch1",
      messageId: "m1",
      mediaId: "media-abc",
      at,
    });
    expect(key).toContain("/_unmapped/");
  });
});

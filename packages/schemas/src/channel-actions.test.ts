import { describe, expect, it } from "vitest";
import { channelActionSchema, updateReadStateSchema } from "./index.js";

describe("channelActionSchema", () => {
  it("accepts exact target-state channel actions", () => {
    expect(channelActionSchema.parse({ action: "pin", pinned: true })).toEqual({
      action: "pin",
      pinned: true,
    });
    expect(channelActionSchema.parse({ action: "mute", muted: false })).toEqual(
      { action: "mute", muted: false },
    );
    expect(
      channelActionSchema.parse({ action: "archive", archived: true }),
    ).toEqual({ action: "archive", archived: true });
    expect(
      channelActionSchema.parse({
        action: "mark_unread",
        markedUnread: true,
      }),
    ).toEqual({ action: "mark_unread", markedUnread: true });
  });

  it("rejects fields belonging to a different action", () => {
    expect(
      channelActionSchema.safeParse({ action: "pin", muted: true }).success,
    ).toBe(false);
  });
});

describe("updateReadStateSchema", () => {
  it("only accepts clearing the explicit unread marker", () => {
    expect(updateReadStateSchema.parse({ markedUnread: false })).toEqual({
      markedUnread: false,
    });
    expect(
      updateReadStateSchema.safeParse({ markedUnread: true }).success,
    ).toBe(false);
  });
});

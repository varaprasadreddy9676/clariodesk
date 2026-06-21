import { describe, expect, it } from "vitest";
import {
  normalizePhoneInput,
  parseParticipantPhones,
} from "./new-conversation-utils.js";

describe("new conversation form utilities", () => {
  it("normalizes common international-number spacing", () => {
    expect(normalizePhoneInput("+91 98765-43210")).toBe("+919876543210");
  });

  it("deduplicates comma and line separated participants", () => {
    expect(
      parseParticipantPhones("+91 98765 43210, +1 555 123 4567\n+919876543210"),
    ).toEqual(["+919876543210", "+15551234567"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  createDirectConversationSchema,
  createGroupConversationSchema,
} from "./index.js";

describe("conversation command schemas", () => {
  it("requires an E.164 recipient and an initial direct message", () => {
    expect(
      createDirectConversationSchema.safeParse({
        phoneInstanceId: crypto.randomUUID(),
        phoneNumber: "9876543210",
        initialMessage: "",
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("accepts a valid direct conversation command", () => {
    expect(
      createDirectConversationSchema.parse({
        phoneInstanceId: crypto.randomUUID(),
        phoneNumber: "+919876543210",
        initialMessage: "Hello",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toEqual(expect.objectContaining({ phoneNumber: "+919876543210" }));
  });

  it("requires at least one E.164 group participant", () => {
    expect(
      createGroupConversationSchema.safeParse({
        phoneInstanceId: crypto.randomUUID(),
        title: "Acme Support",
        participantPhoneNumbers: [],
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});

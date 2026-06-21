import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { WebhookSecretGuard } from "./webhook-secret.guard.js";

function makeContext(secret?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          "x-webhook-secret": secret,
        },
      }),
    }),
  } as never;
}

describe("WebhookSecretGuard", () => {
  it("rejects requests without the shared secret", () => {
    const guard = new WebhookSecretGuard({
      GATEWAY_WEBHOOK_SECRET: "expected-secret",
    } as never);

    expect(() => guard.canActivate(makeContext("wrong-secret"))).toThrow(
      UnauthorizedException,
    );
  });

  it("allows requests with the shared secret", () => {
    const guard = new WebhookSecretGuard({
      GATEWAY_WEBHOOK_SECRET: "expected-secret",
    } as never);

    expect(guard.canActivate(makeContext("expected-secret"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateKey } from "./index.js";

describe("crypto (AES-256-GCM)", () => {
  const key = generateKey();

  it("round-trips a secret", () => {
    const ct = encryptSecret("super-secret-api-key", key);
    expect(ct).not.toContain("super-secret");
    expect(decryptSecret(ct, key)).toBe("super-secret-api-key");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("fails to decrypt with the wrong key", () => {
    const ct = encryptSecret("x", key);
    expect(() => decryptSecret(ct, generateKey())).toThrow();
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const ct = encryptSecret("hello", key);
    const tampered = ct.slice(0, -4) + "AAAA";
    expect(() => decryptSecret(tampered, key)).toThrow();
  });

  it("rejects a malformed key length", () => {
    expect(() => encryptSecret("x", "dG9vc2hvcnQ=")).toThrow(/32 bytes/);
  });
});

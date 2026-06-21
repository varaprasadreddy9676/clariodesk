import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated symmetric encryption for secrets at rest (TDD §23.4) —
 * AES-256-GCM. The key is a 32-byte value provided base64-encoded via
 * ENCRYPTION_KEY. Ciphertext is self-describing: `v1.<iv>.<tag>.<data>` (all
 * base64), so the format can evolve without ambiguity.
 */
const VERSION = "v1";
const IV_BYTES = 12; // standard GCM nonce length
const KEY_BYTES = 32;

export function decodeKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        `Generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    data.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string, keyBase64: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid or unsupported ciphertext format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = decodeKey(keyBase64);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64!, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Generates a fresh base64 ENCRYPTION_KEY (helper for setup/tests). */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

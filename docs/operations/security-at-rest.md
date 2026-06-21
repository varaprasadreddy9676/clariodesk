# Security: encryption at rest & secret handling

How ClarioDesk protects secrets and data at rest in Core v1, and what operators
must configure for a production / sensitive-data pilot.

## 1. Application-managed secrets (implemented)

| Secret | Where | Protection |
|---|---|---|
| Per-phone gateway API key | `phone_instances.encrypted_api_key` | **AES-256-GCM** via `@clariodesk/crypto`, key from `ENCRYPTION_KEY` |
| User passwords | `users.password_hash` | bcrypt (cost 12) |
| JWT signing | n/a (in-memory) | `JWT_SECRET`, rejected if default/short in production |
| Gateway webhook auth | n/a | `GATEWAY_WEBHOOK_SECRET` shared secret |

`ENCRYPTION_KEY` is a base64-encoded 32-byte key. Generate one per environment:

```bash
openssl rand -base64 32
```

Config refuses to boot in `NODE_ENV=production` if `ENCRYPTION_KEY` or
`JWT_SECRET` are left at their dev defaults (`packages/config`). The ciphertext
format is self-describing (`v1.<iv>.<tag>.<data>`), so the scheme can be rotated
without ambiguity. Decryption failures (wrong key, tampered data) throw — see
`packages/crypto/src/index.test.ts`.

### Gateway session material

The `gateway_sessions` table (with an `encrypted_session` column) is **reserved**
for adapters that need to persist linked-device session state in the platform DB.
In Core v1 the first-party **Clario Gateway** runtime owns and stores its own
WhatsApp session material on the gateway host; ClarioDesk does not persist it.
If a future adapter writes session blobs here, they MUST be encrypted with the
same `encryptSecret`/`decryptSecret` helpers before insert.

## 2. Infrastructure-managed at-rest (operator responsibility)

The application encrypts the secrets above; the **datastore layer** must be
configured for at-rest encryption by the operator — required before any
PII/PHI-bearing pilot (HIMS/healthcare, education verticals):

- **PostgreSQL** — enable encryption at rest (managed: RDS/Cloud SQL/Neon
  encryption is on by default; self-hosted: encrypted volume / TDE). The DB holds
  message bodies, contacts, and ticket content.
- **Object storage (media + raw events)** — enable **server-side encryption
  (SSE)** on both buckets:
  - AWS S3: `SSE-S3` (AES-256) or `SSE-KMS` as bucket default encryption.
  - MinIO: enable SSE (KMS/auto-encryption) on `clariodesk-media` and
    `clariodesk-raw-events`.
  Object keys already avoid leaking filenames (opaque `media_id`), and download
  is always via short-lived signed URLs after a permission check.
- **Redis** — used for queues/transient state only; no long-lived secrets. Use
  network isolation + AUTH; enable TLS for managed Redis.
- **Backups** — ensure DB + object-storage backups inherit the same encryption.

## 3. Key management

- Store `ENCRYPTION_KEY` / `JWT_SECRET` in a secret manager (AWS Secrets Manager,
  Vault, Doppler) — never in the repo or image.
- Rotating `ENCRYPTION_KEY` invalidates existing `encrypted_api_key` values;
  re-enter per-phone keys after rotation (documented limitation for Core v1; a
  versioned re-encryption migration is post-v1).

## 4. In transit

- TLS terminates at the reverse proxy (nginx/caddy) in front of the API and
  realtime services; see `deploy/`.
- Gateway webhook calls are authenticated by `GATEWAY_WEBHOOK_SECRET`; restrict
  the webhook endpoint to the gateway host's network where possible.

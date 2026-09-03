# AGENTS.md

Guide for AI agents (and human contributors) working in this repo. Read this first.

ClarioDesk is an **open-source, self-hosted WhatsApp team inbox** — the alternative to Periskope/WATI/Respond.io. Modular monolith, npm workspaces, Node 20+, AGPL-3.0. See the [README](./README.md) for the product pitch.

---

## Repo layout

```
apps/        runnable services (one entry point each)
  api/         NestJS + Fastify REST API       (:4000)
  gateway/     whatsapp-web.js bridge          (:2786) — separate runtime
  realtime/    Socket.io relay over Redis      (:4001)
  worker/      BullMQ job processors
  scheduler/   retention + phone-health jobs
  web/         React 19 + Vite frontend        (:5173)
packages/    shared domain code (the stable core)
  db/          Drizzle ORM — 26 tables across 9 schema files
  policy-engine/  send-safety rules (the differentiator)
  gateway-adapters/  WhatsAppGatewayAdapter interface + live adapter
  crypto/      AES-256-GCM at rest
  storage/     S3/MinIO + signed URLs
  events/      Redis pub/sub realtime bus
  config/ logger/ types/ schemas/
docs/        architecture, ops, ADRs, frontend specs
deploy/      Dockerfile + docker-compose (dev + prod)
```

## The five core design rules

These are invariant — don't break them without an ADR. (From [Runtime Overview](./docs/architecture/runtime-overview.md).)

1. **The API never sends directly to the gateway.** All outbound replies flow through the outbox.
2. **Postgres is the source of truth; realtime is best-effort.** Realtime publishes are fire-and-forget and swallow errors — never let a push failure break a write.
3. **The core depends on the `WhatsAppGatewayAdapter` interface, never on whatsapp-web.js.** Chromium/Puppeteer stays isolated in `apps/gateway`. Don't import `whatsapp-web.js` from `apps/api`, `apps/worker`, or any `packages/*`.
4. **Historical backfill and live events are classified separately.** Reconnect-sync and backfill must not trigger SLA timers, auto-tickets, or notifications.
5. **Group mapping is the safety boundary** between imported history and live support operations. Unmapped channels store messages but trigger nothing.

For the *why* behind the big decisions, read the [ADRs](./docs/decisions/README.md):

- [ADR-001: Swappable gateway adapter](./docs/decisions/001-swappable-gateway-adapter.md)
- [ADR-002: Atomic outbox claim](./docs/decisions/002-atomic-outbox-claim.md)
- [ADR-003: Policy engine as isolated package](./docs/decisions/003-policy-engine-as-isolated-package.md)

## Where things live (deeper)

- **Message flow** (inbound + outbound, end-to-end): [docs/architecture/message-pipeline.md](./docs/architecture/message-pipeline.md)
- **Safety rules** (cooldown, bulk-risk, classification, echo): [docs/architecture/policy-engine.md](./docs/architecture/policy-engine.md)
- **Schema**: `packages/db/src/schema/` (9 files by domain: `core`, `transport`, `channel`, `identity`, `messages`, `tickets`, `access`, `audit` + `enums.ts`). Migrations in `packages/db/drizzle/` (currently `0000`–`0012`).
- **API endpoints**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) + Swagger at `/api/docs` when running.
- **Frontend**: [docs/frontend/](./docs/frontend/) (17 spec files — already thorough).

## Build, test, lint

```bash
npm install
npm run dev:infra          # Postgres + Redis + MinIO via Docker
npm run db:migrate         # apply Drizzle migrations

npm run dev                # api + worker + realtime + scheduler + web (tsx watch)
npm run dev -w @clariodesk/gateway   # WhatsApp bridge, separately

npm run typecheck          # tsc --build across the workspace
npx vitest run             # unit tests
npm run test:integration   # Docker-backed (testcontainers)
npm run test:e2e           # Playwright

npm run lint               # eslint (flat config: eslint.config.mjs)
npm run format             # prettier — NOTE: *.md is in .prettierignore, so markdown isn't reformatted
```

**TypeScript:** workspaces use project references (`tsc --build`). After touching `packages/*` source that `apps/*` depends on, run `npm run typecheck` — a stale `dist/` in one package can mask breakage in another.

**Tests:** the policy engine (`packages/policy-engine`) has the highest test density by design — pure functions, table-driven, no mocks. When changing safety logic, extend those tests first.

## Conventions

- **Node 20+** (enforced in `package.json` `engines`).
- **Package scope:** `@clariodesk/*`. Apps import packages by name (workspace links), never by relative path across the `apps/`↔`packages/` boundary.
- **ESM:** sources use `.js` extensions in relative imports (TypeScript's `NodeNext` resolution) — e.g. `import { x } from "./foo.js"`. Match this in new files.
- **Config via env:** all runtime config flows through `packages/config` (Zod schema, fail-fast in production on default/short secrets). Don't read `process.env` directly in domain code.
- **Encryption:** per-phone API keys are AES-256-GCM encrypted at rest via `@clariodesk/crypto`. Never store gateway credentials in plaintext. See [Security at rest](./docs/operations/security-at-rest.md).
- **Migrations:** after editing `packages/db/src/schema/`, run `npm run db:generate` (creates SQL) then `npm run db:migrate` (applies). Never hand-edit generated migration SQL.

## Ports (local dev)

| Service | Port |
|---|---|
| API | `4000` |
| Realtime (Socket.io) | `4001` |
| Gateway (WhatsApp bridge) | `2786` |
| Web (Vite) | `5173` |

## Environment

Copy `.env.example` → `.env` (defaults work for local dev). Production-required secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, `GATEWAY_WEBHOOK_SECRET`, `CLARIO_GATEWAY_API_KEY`) must be regenerated — `packages/config` refuses to boot in `NODE_ENV=production` if left at dev defaults. See the "Self-Hosting" section of [README](./README.md).

## License

**AGPL-3.0-only.** Keep derivative work open-source. Don't add dependencies with incompatible licenses without checking. See [LICENSE](./LICENSE) and [CONTRIBUTING.md](./CONTRIBUTING.md).

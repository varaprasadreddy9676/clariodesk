# Clariodesk

Open-source, self-hostable **WhatsApp group operations platform** — turns chaotic
WhatsApp group communication into a structured shared inbox, safe replies, and
lightweight ticketing.

> Status: **Core v1 backend foundation is verified; frontend is API-backed, realtime-enabled, and being hardened around the first-party Clario Gateway.** See
> [`PROGRESS.md`](./PROGRESS.md) for the live, full-product checklist (done /
> pending / deferred across all priorities). Functional + technical specs live in
> the two `whatsapp_group_operations_platform_*.md` documents.

## What works today

The safety-critical backend loop is built and tested:

- **First-party Clario Gateway path** for linked-device QR, status, group sync,
  recent message import, media download/send primitives, and text/reply send.
  OpenWA/Evolution experiments proved why Core v1 must not depend on external
  gateway behavior for message history.
- **Policy engine (P0 safety core):** backfill/stale-vs-live classification,
  idempotency + outbound-echo reconciliation, and the outbound send gate
  (route/cooldown/cost/bulk-risk).
- **Worker pipeline:** normalize → dedupe → classify → store → fan out media,
  plus live/backfill media download and policy-gated outbox send.
- **NestJS API server:** auth, clients/projects, phones, channel mapping,
  messages, outbox, notes, tickets, contacts, media, search, and ops summary.
- **Realtime server:** Socket.io with JWT handshake and permission-scoped rooms.
- **Scheduler:** retention purge and phone health degradation checks.
- **Full Drizzle schema** (24 tables, workspace-scoped) with a generated SQL
  migration.
- **Object storage** wrapper with opaque media keys (never leak filenames) and
  short-lived signed URLs.
- **Frontend foundation:** Vite React `apps/web` workbench with real auth, ops,
  phones, synced channels, timeline, composer, tickets, search, clients, team,
  reports, and settings API wiring.

Remaining Core v1 work is mainly production hardening, OpenAPI/operations docs,
and broader E2E/failure coverage.

## Architecture

A **modular monolith** (TDD §3): one codebase, multiple runtime entrypoints
(`api`, `worker`, `realtime`, `scheduler`) sharing the same domain packages.
Transport is replaceable; operations logic is stable.

```
packages/
  config         env parsing + fail-fast validation
  logger         pino structured logging
  types          canonical domain enums + NormalizedGatewayEvent
  schemas        zod request schemas
  db             Drizzle schema + client (24 tables)
  gateway-adapters  WhatsAppGatewayAdapter + Clario Gateway runtime adapter
  policy-engine  classification / idempotency / echo / send policy  (P0 safety)
  storage        S3/MinIO wrapper + key builders
apps/
  gateway        first-party linked-device QR/group/message bridge
  worker         BullMQ ingestion/media/outbox runtime
  api            NestJS + Fastify API
  realtime       Socket.io realtime relay
  scheduler      retention + phone health jobs
  web            Vite React frontend foundation
```

## Develop

Requires Node 20+, npm, Docker.

```bash
npm install
npm run dev:infra          # postgres + redis + minio

npm run build              # backend type build + web production build
npm run db:generate        # regenerate SQL migration from schema
npm run db:migrate         # apply migrations (needs infra up + .env)

npx tsc --build            # typecheck everything
npx vitest run             # run the unit test suite
npm run test:integration   # Testcontainers integration suite

# first-party linked-device gateway
CLARIO_GATEWAY_PORT=2786 CLARIO_GATEWAY_API_KEY=dev-clario-gateway-key \
  npm run -w @clariodesk/gateway start
```

Copy `.env.example` to `.env` and adjust before running migrations or apps.

## License

AGPL-3.0-only (self-hosted OSS core).

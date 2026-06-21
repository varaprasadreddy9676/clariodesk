# Runtime Overview

ClarioDesk is a modular monolith with five long-running runtimes plus the web app:

- `apps/api` - REST API, auth, channel mapping, tickets, notes, search, ops summary, OpenAPI
- `apps/worker` - webhook normalization, history sync, media download, outbound queue, policy gates
- `apps/realtime` - Socket.io relay over Redis pub/sub
- `apps/scheduler` - retention purge and phone health checks
- `apps/gateway` - first-party linked-device WhatsApp bridge used by Core v1
- `apps/web` - Vite React workbench for inbox, phones, clients, team, reports, and settings

## Product Flow

```text
WhatsApp group
→ apps/gateway linked-device session
→ API webhook ingest / history sync
→ worker normalization + policy checks
→ Postgres + object storage
→ realtime events over Redis
→ web inbox / ticket / note / reply UX
```

## Core Design Rules

1. The API never sends directly to the gateway.
2. All outbound replies flow through the outbox.
3. Historical backfill and live events are classified separately.
4. Group mapping is the safety boundary between imported history and live support operations.
5. Realtime delivery is best-effort; Postgres remains the source of truth.

## Runtime Boundaries

- `apps/api` owns user-facing writes and read models.
- `apps/worker` owns normalization and gateway-side side effects.
- `apps/realtime` relays permission-scoped events to the browser.
- `apps/scheduler` runs periodic retention and phone health jobs.
- `apps/gateway` owns the QR/session lifecycle and gateway-specific transport details.

## Local Ports

- API: `4000`
- Realtime: `4001`
- Gateway: `2786`
- Web: `5174`

## Operational Sequence

Recommended local start order:

1. Start Postgres, Redis, and MinIO with `npm run dev:infra`
2. Run migrations
3. Seed the demo workspace
4. Start gateway, worker, realtime, scheduler, then API and web

## Why This Shape

This layout keeps the support workflow deterministic:

- one source of truth for channel ownership
- one outbox for all outbound replies
- one realtime bus for browser updates
- one gateway runtime so Core v1 behavior stays under first-party control


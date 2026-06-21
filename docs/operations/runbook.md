# Operations Runbook

This runbook covers the current Core v1 developer / pilot setup.

## Required Services

- PostgreSQL
- Redis
- MinIO
- `apps/gateway`
- `apps/worker`
- `apps/realtime`
- `apps/scheduler`
- `apps/api`
- `apps/web`

## Bootstrap

1. Copy `.env.example` to `.env`
2. Start infra: `npm run dev:infra`
3. Apply migrations: `npm run db:migrate`
4. Seed demo data: `node apps/api/dist/seed.js`
5. Start runtimes:
   - `node apps/gateway/dist/index.js`
   - `node apps/worker/dist/index.js`
   - `node apps/realtime/dist/index.js`
   - `node apps/scheduler/dist/index.js`
   - `node apps/api/dist/main.js`
6. Start the web app: `npm run -w @clariodesk/web dev`

## Health Checks

- API: `GET /api/health`
- Swagger: `GET /api/docs`
- Gateway status: `GET /api/phones`
- Operations summary: `GET /api/ops/summary`

## Common Support Workflows

- Scan a QR code from the Phones page to connect a linked-device gateway
- Run group sync after the gateway is connected
- Map new groups before external replies are allowed
- Use the inbox timeline for replies, notes, and ticket creation

## Known Safety Rules

- Unmapped groups are read-only for external replies
- All outbound sends go through the outbox
- Internal notes never go to WhatsApp
- Historical sync is backfill, not live ingest

## Failure Triage

1. Check API logs first for auth / DB / queue errors.
2. Check worker logs for normalization, media, and outbox failures.
3. Check realtime logs if browser updates are missing.
4. Check gateway logs if QR or message import stops.
5. Check scheduler logs if retention or phone health drift appears.


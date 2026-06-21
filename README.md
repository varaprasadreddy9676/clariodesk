<div align="center">
  <h1>ClarioDesk</h1>
  <p><strong>The open-source WhatsApp team inbox.</strong><br/>
  Reply as a team, track conversations, and close tickets — directly from WhatsApp.</p>

  <a href="https://github.com/varaprasadreddy9676/clariodesk/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0 License" />
  </a>
  <a href="https://github.com/varaprasadreddy9676/clariodesk/actions/workflows/ci.yml">
    <img src="https://github.com/varaprasadreddy9676/clariodesk/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
  <img src="https://img.shields.io/badge/self--hosted-yes-green" alt="Self-hosted" />

  <br/><br/>

  <p>
    <a href="#-features">Features</a> ·
    <a href="#-quick-start">Quick Start</a> ·
    <a href="#-self-hosting">Self-Hosting</a> ·
    <a href="#-architecture">Architecture</a> ·
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## Why ClarioDesk?

Most teams managing WhatsApp at scale face the same problem: chats scattered across personal phones, no visibility into who's replying, no history, no accountability. Commercial tools like Periskope, WATI, or Respond.io solve this — but cost **$50–300/month per workspace** and keep your customer conversations on someone else's servers.

**ClarioDesk is the self-hosted alternative.** Run it on your own infrastructure, pay nothing per seat, and own every message.

| | ClarioDesk | Periskope | WATI | Respond.io |
|---|---|---|---|---|
| Price | **Free** | $50–200/mo | $49+/mo | $79+/mo |
| Self-hosted | **Yes** | No | No | No |
| Your data | **Your servers** | Their cloud | Their cloud | Their cloud |
| Open source | **AGPL-3.0** | Closed | Closed | Closed |
| WhatsApp groups | **Yes** | Limited | No | No |

---

## ✨ Features

**Team inbox**
- Shared inbox across all WhatsApp chats — groups and 1:1
- See who's typing, who's assigned, and what's been replied
- Real-time sync across all team members via WebSocket

**WhatsApp-native UI**
- Looks and feels like WhatsApp Web — familiar to your whole team
- Dark mode, mobile-responsive, long-press context menus on mobile
- Attachment preview, download, emoji reactions

**Collaboration**
- Assign chats to team members
- Internal notes (not sent to the customer)
- Private replies visible only to agents

**Ticketing**
- Convert any message into a ticket
- Track open/closed tickets per conversation
- Link chats to clients and projects

**Safety**
- Cooldown + bulk-send rate limiting so you never get banned
- Policy engine blocks duplicate sends and echo loops
- All API keys and phone session data encrypted at rest (AES-256-GCM)

**Self-hosting**
- Single `docker compose up` deployment
- PostgreSQL + Redis + MinIO — no managed cloud services required
- Bring your own WhatsApp linked device (no extra fees)

---

## 🚀 Quick Start

**Prerequisites:** Node 20+, Docker, a WhatsApp account to link.

```bash
git clone https://github.com/varaprasadreddy9676/clariodesk.git
cd clariodesk

# 1. Install dependencies
npm install

# 2. Start infrastructure (Postgres, Redis, MinIO)
npm run dev:infra

# 3. Configure environment — defaults work out of the box for local dev
cp .env.example .env

# 4. Run database migrations
npm run db:migrate

# 5. Start everything in one terminal
npm run dev
```

That's it. Open `http://localhost:5173` → Register your workspace → Add a phone → Scan QR → start chatting.

> **Note:** `npm run dev` starts the API (:4000), worker, realtime (:4001), scheduler, and frontend (:5173).
> The WhatsApp gateway runs separately since it needs Chromium and a phone to link:
> ```bash
> npm run dev -w @clariodesk/gateway   # starts the WhatsApp bridge on :2786
> ```

---

## 🐳 Self-Hosting

Production deployment uses a single Docker Compose file with all services, health checks, restart policies, and resource limits pre-configured.

```bash
# 1. Copy and fill in your secrets
cp deploy/.env.prod.example deploy/.env

# 2. Set required secrets in deploy/.env
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -base64 32)
GATEWAY_WEBHOOK_SECRET=$(openssl rand -base64 32)
CLARIO_GATEWAY_API_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=<strong password>
MINIO_USER=clariodesk
MINIO_PASSWORD=<strong password>
CORS_ORIGINS=https://your-domain.com

# 3. Deploy
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d

# 4. Run migrations (first deploy only)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
  run --rm migrate
```

Put an nginx/Caddy reverse proxy in front of ports `4000` (API) and `5173` (web).

**Minimum server specs:** 2 vCPU, 4 GB RAM (Puppeteer/Chromium for WhatsApp requires ~1.5 GB).

### Upgrade

```bash
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

Migrations run automatically on every deploy via the `migrate` init service.

---

## 🏗 Architecture

ClarioDesk is a **modular monolith** — one codebase, multiple runtime entrypoints sharing the same domain packages. The transport layer (WhatsApp gateway) is swappable; the operations logic is stable.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (apps/web — React + Vite)                              │
│  WhatsApp-style inbox UI, real-time updates, mobile-responsive  │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + WebSocket
┌───────────┐   ┌────────▼───────┐   ┌─────────────────────────┐
│  gateway  │──▶│  api (NestJS)  │──▶│  worker (BullMQ)        │
│ whatsapp- │   │  :4000         │   │  normalize / media /    │
│ web.js    │   │                │   │  outbox-send processors │
│ :2786     │◀──│  realtime      │   └─────────────────────────┘
└───────────┘   │  socket.io     │
                │  :4001         │   ┌─────────────────────────┐
                │                │──▶│  scheduler              │
                └────────────────┘   │  retention / health     │
                         │           └─────────────────────────┘
              ┌──────────▼──────────────────┐
              │  PostgreSQL │ Redis │ MinIO  │
              └─────────────────────────────┘

packages/
  config          env parsing + fail-fast production validation
  logger          structured pino logging
  types           canonical domain types + NormalizedGatewayEvent
  schemas         zod request schemas
  db              Drizzle ORM schema (24 tables, workspace-scoped)
  gateway-adapters  WhatsAppGatewayAdapter interface + runtime adapters
  policy-engine   send policy: cooldown / bulk-risk / idempotency
  crypto          AES-256-GCM field encryption
  storage         S3/MinIO object wrapper with signed URL generation
```

**Key design decisions:**
- **AGPL-3.0** — keeps derivatives open-source; commercial use requires a separate license
- **Workspace-scoped schema** — multi-tenant from day one; each org is a row, not a schema
- **Policy engine as a package** — safety rules are tested independently of the HTTP layer
- **Atomic outbox claim** — `UPDATE WHERE status IN ('pending') RETURNING *` prevents double-send even with multiple worker processes

---

## 🔒 Security

ClarioDesk is designed for production use by teams handling sensitive customer conversations.

- **Auth:** JWT (HS256, configurable expiry), bcrypt-12 password hashing
- **Encryption at rest:** AES-256-GCM for phone API keys and session secrets
- **Webhook auth:** timing-safe secret comparison (`timingSafeEqual`)
- **Rate limiting:** 10 requests/60s on auth endpoints
- **CORS:** explicit allowlist required in production
- **CSP:** `Content-Security-Policy` via `@fastify/helmet`
- **Media:** short-lived signed URLs (5 min TTL), never public

To report a security vulnerability, see [`SECURITY.md`](./SECURITY.md).

---

## 🛠 Development

```bash
npm install

# Type check everything
npx tsc --build --pretty

# Unit tests
npx vitest run

# Integration tests (requires Docker)
npm run test:integration

# Format
npm run format

# Lint
npm run lint
```

### Project structure

```
apps/
  api/         NestJS + Fastify REST API
  gateway/     WhatsApp linked-device bridge (whatsapp-web.js)
  realtime/    Socket.IO WebSocket relay
  worker/      BullMQ job processors
  scheduler/   Periodic health + retention jobs
  web/         React + Vite frontend
packages/
  config/      Zod env schema with production guards
  crypto/      AES-256-GCM encryption primitives
  db/          Drizzle ORM schema + migration runner
  events/      Typed Redis pub/sub event bus
  gateway-adapters/  WhatsApp adapter interface
  logger/      Pino logger factory
  policy-engine/   Send safety rules
  schemas/     Shared Zod request schemas
  storage/     S3/MinIO client
  types/       Shared TypeScript types
```

### Database migrations

```bash
# After editing packages/db/src/schema/
npm run db:generate   # create new migration SQL
npm run db:migrate    # apply to running Postgres
```

---

## 🤝 Contributing

We welcome contributions of all kinds — bug fixes, features, docs, and translations.

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the full guide.

**Quick flow:**
1. Fork the repo and create a branch from `main`
2. Make your changes with tests
3. Run `npx tsc --build` and `npx vitest run` — both must pass
4. Open a PR with a clear description

For large features, open an issue first so we can align on approach.

---

## Roadmap

ClarioDesk is built in public. Here's where we're headed — roughly in order.

### v0.2 — Outreach & Automation
- [ ] **Broadcast campaigns** — send to a list with opt-out tracking and send-rate throttling to protect your number
- [ ] **Scheduled messages** — queue a reply for the right time zone
- [ ] **Auto-reply rules** — keyword triggers, out-of-office, and first-response bots
- [ ] **Canned responses** — team-wide saved replies with `/ ` search

### v0.3 — WhatsApp Cloud API adapter
- [ ] **Official API support** — connect via Meta's Cloud API (no Puppeteer, no phone required)
- [ ] **Hybrid mode** — run Cloud API and linked-device side by side for teams that need both
- [ ] **Message templates** — send and manage approved template messages

### v0.4 — AI
- [ ] **Smart reply suggestions** — context-aware reply drafts powered by Claude / OpenAI
- [ ] **Conversation summaries** — catch up on a long thread in one click
- [ ] **Sentiment tagging** — auto-flag urgent or negative conversations
- [ ] **AI ticket classification** — auto-assign category and priority from message content

### v0.5 — CRM & Integrations
- [ ] **Contact profiles** — full history, tags, and custom fields per contact
- [ ] **Zapier / n8n / Make webhooks** — trigger flows on new message, ticket created, resolved
- [ ] **HubSpot / Pipedrive sync** — two-way contact and deal sync
- [ ] **Slack notifications** — get a Slack ping when a conversation needs attention

### v0.6 — Mobile
- [ ] **iOS + Android app** (React Native) — full inbox, reply, and ticket management from your phone
- [ ] **Push notifications** — native alerts for new messages and assignments
- [ ] **Offline queue** — compose replies offline, send when connected

### v1.0 — Enterprise-ready
- [ ] **SSO / SAML** — Okta, Google Workspace, Azure AD
- [ ] **Role-based access control** — custom roles, channel-level permissions
- [ ] **Audit log** — every action logged with actor, timestamp, and before/after state
- [ ] **Data retention policies** — configurable auto-purge per workspace
- [ ] **Multi-language UI** — Spanish, Portuguese, Arabic, Hindi (most common WhatsApp markets)
- [ ] **SLA timers & escalation** — alert when a conversation breaches first-response or resolution SLA

---

**Shape the roadmap** — upvote issues or open new ones. Features with the most community interest move up.

> We follow our users. If you're a team actively using ClarioDesk and need something sooner, open an issue and tell us your use case — that weight matters.

---

## License

**AGPL-3.0-only** — free to self-host and modify. Derivatives must remain open source.  
Commercial use (SaaS, white-label, embedding) requires a separate commercial license — open an issue to discuss.

Copyright © 2026 ClarioDesk contributors.

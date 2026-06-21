# Changelog

All notable changes to ClarioDesk will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- WhatsApp-native UI with dark context menus, skeleton loading states, and mobile-responsive layout
- First-party linked-device gateway with QR auth, group sync, and media send/receive
- Policy engine: send cooldown, bulk-risk scoring, idempotency, and outbound-echo reconciliation
- Multi-agent shared inbox with assignment, internal notes, and private replies
- Lightweight ticketing: create tickets from messages, link to clients/projects
- Real-time updates via Socket.IO with JWT handshake and permission-scoped rooms
- AES-256-GCM encryption at rest for all phone API keys and session secrets
- Rate limiting on auth endpoints (10 req / 60s per IP)
- `Content-Security-Policy` headers via `@fastify/helmet`
- Atomic outbox claim prevents double-send under concurrent workers
- Docker Compose production deployment with health checks and resource limits
- Database index `channels_ws_last_msg_idx` for fast channel list queries

### Security
- Upgraded to NestJS v11 — fixes 3 CRITICAL `@fastify/middie` auth bypass CVEs
- Upgraded `drizzle-orm` to 0.45.2 — fixes HIGH SQL injection CVE (GHSA-gpj5-g38j-94v9)
- Upgraded `vitest` to v4, `vite` to v8 — fixes CRITICAL Vitest UI file-read CVE
- Timing-safe webhook secret comparison via `timingSafeEqual`

---

## [0.1.0] - 2026-06-21

Initial public release — Core v1 backend foundation.

# ClarioDesk — Build Progress

Living checklist for the whole product, organized by the FRS/TDD priority scheme
(P0 = safety, P1 = Core v1 usable, P2 = v1.5, P3 = differentiators, P4 = enterprise).
Update this file as work lands so we can pause/resume cleanly.

## Product Goal And Priority Contract

ClarioDesk is an open-source customer support desk for WhatsApp chats.

The product exists because companies already run customer support, implementation,
and project coordination inside WhatsApp chats and groups, but WhatsApp does not provide
ownership, tickets, SLAs, handover, safe internal notes, searchable media, audit, or
analytics.

Primary mission:

```text
No customer issue should be lost inside a WhatsApp group again.
```

Core v1 priority is narrow:

```text
Existing customer WhatsApp chat
→ linked-device QR connection through one gateway
→ chat sync
→ map group where needed to customer/project
→ shared support inbox
→ safe external reply or internal note
→ create/link ticket
→ assign owner
→ track basic status
→ searchable/auditable history
```

Everything else is phased after this support loop works:

- P0: prevent client leaks, spam, duplicate/lost messages, unsafe replies, and false backfill operations.
- P1: group sync, mapping, inbox, safe replies, internal notes, tickets, owner/status, basic search/audit.
- P2: daily support maturity: handover, SLA basics, Web Push/PWA notifications, quick replies, coverage, dashboards.
- P3: differentiators: AI assist, voice transcription, semantic search, incident/storm flows, advanced asset safety.
- P4/P5: platform expansion: Official WhatsApp Management module, Meta Cloud API,
  Embedded Signup, WABA/phone management, templates, Flows, opt-outs, delivery
  analytics, SSO, advanced RBAC, plugins, local/BYOK AI maturity.

**Last updated:** 2026-06-20
**Current phase:** Core backend workflows exist and the frontend is API-backed, but the product is
not pilot-complete. The current frontend is a functional engineering workbench, not the final
WhatsApp-quality shared inbox. Socket.io infrastructure exists, but end-to-end live sync was
blocked by gateway webhook configuration/identifier mismatches and by listening only for inbound
messages. Those defects are patched; a real-phone end-to-end verification after a full stack
restart is still required before live sync can be marked complete. Reconnect recovery, durable
history sync, delivery/read state, and production UX remain active work.
**Baseline:** ✅ `npm run build` clean · `npm test` = **82/82 unit**. Integration tests require an
available Docker runtime; the current managed environment cannot access the Docker socket.
Migrations: `0000` (24 tables) + `0001` (FTS GIN indexes) + `0004` (`clario_gateway` adapter enum).
**All five runtimes** build: api, worker, realtime, scheduler, gateway.
**Live E2E proof (this session):** infra → migrate → seed → booted all 4 runtimes, then verified:
auth/JWT + guards (401s); webhook→raw event→enqueue→worker normalize→store; mapping boundary
(unmapped suppressed / history-sync backfill / live SLA-eligible); idempotency dedup; outbound
echo merge; ghost-agent attribution; ticket create/close + list/get; outbox send-delay+cancel;
admin endpoints (clients/projects/phones/team/contacts); **permission scoping** (agent sees only
assigned client, not others); **FTS search**; **realtime bus** (worker publishes `message.received`);
scheduler retention runs clean; full audit trail. Integration tests caught + fixed a latent
`Date`-in-raw-`sql` bug in `touchChannelLastMessage` and `purgeMessages`.
**How to resume:** `npm run dev:infra`, `npm run build`, `npm run db:migrate`,
`node apps/api/dist/seed.js`, then boot the 4 runtimes (`node apps/{api,worker,realtime,scheduler}/dist/...`).
Seed login: `admin@demo.test` / `demo-password`.
**Gateway decision (2026-06-13):** Core v1 is **Clario Gateway only** at product/runtime level.
Evolution/OpenWA experiments proved useful as references, but they are not exposed in the Phase 1
phone setup path because external gateway behavior blocked reliable message-history import.
ClarioDesk now has a first-party `apps/gateway` runtime and `clario_gateway` adapter with
QR/status/group sync/recent message import/text send/reply/media send/media download contracts.
Legacy Evolution/OpenWA code may remain as local reference tests, but API creation, UI setup,
worker runtime, README, env, and dev compose are now Clario Gateway oriented.
**Next up:** prove real-phone bidirectional live sync, make gateway/session recovery durable, then
rebuild the inbox interaction layer to the frontend specification before adding more breadth.

Legend: `[x]` done · `[~]` in progress · `[ ]` not started · `[-]` deferred (post-v1)

---

## Immediate pilot blockers (ordered)

### Live WhatsApp synchronization

- [~] End-to-end live event chain: gateway `message_create` → authenticated webhook → queue →
  worker → Redis event → Socket.io → inbox/timeline refresh. Identifier/secret/event-listener
  defects are fixed; real-phone verification after restart is pending.
- [ ] Automatically restore and start persisted linked-device sessions after gateway restart.
- [ ] Durable history/reconnect sync jobs with progress, checkpoints, bounded concurrency, and
  resumability. Current all-chat history sync is API-process background work.
- [ ] Reconnect gap recovery: import messages since the last acknowledged provider timestamp before
  declaring the phone fully synchronized.
- [ ] Expose gateway/webhook/queue/socket health and last-event timestamps in the UI; never show
  “Connected” when only one layer is alive.
- [x] Add polling fallback when Socket.io is unavailable and automatically reconcile after socket
  reconnection, browser focus, or wake from sleep.
- [ ] Synchronize delivery/read receipts, edits, revokes, reactions, typing/presence, chat metadata,
  archive/mute/pin state where the linked-device library exposes them.
- [ ] Add real-phone automated contract tests for inbound text, outbound phone reply, dashboard
  reply, media, reconnect, duplicate delivery, and offline recovery.

### Inbox UI/UX productization

- [ ] Establish real routes and URL state (`/inbox`, `/tickets`, `/phones`, selected chat/filter).
- [ ] Replace whole-screen refetch state with a server-state cache and targeted optimistic updates.
- [ ] WhatsApp-quality chat rows: avatar, sender/preview, accurate timestamp, unread count, draft,
  typing/sending/error state, pin/mute/archive markers, and stable ordering without layout shifts.
- [ ] Production timeline: virtualized history, anchored pagination, correct initial scroll,
  unread divider, date separators, reply previews, reactions, delivery state, media gallery, and
  no whole-page scrolling.
- [ ] Production composer: attachment upload, paste/drop, voice note, emoji, mentions, quoted reply,
  edit/delete where supported, send progress, retry, and clear separation of Reply vs Private Note.
- [ ] Responsive interaction model: collapsible/resizable desktop panes and predictable mobile
  list → conversation → context navigation.
- [ ] Shared design system tokens and primitives for typography, spacing, controls, menus, dialogs,
  skeletons, empty/error/offline states, toasts, and accessibility.
- [ ] Keyboard navigation, focus management, screen-reader labels, reduced motion, and contrast QA.
- [ ] Visual regression and interaction tests at 320, 768, 1024, and 1440 px using realistic long
  names, large timelines, media, errors, and reconnect states.

---

## 00. Documentation / planning

- [x] Backend progress reconciled against FRS/TDD
- [x] Full-product frontend UX documentation added under `docs/frontend/`
- [x] AI-native/BYOK planning added to functional, technical, frontend, and AI architecture docs
- [x] Realtime/Web Push/PWA notification planning added to functional, technical, and frontend docs
- [x] Product goal/priorities reframed around WhatsApp group customer support operations
- [x] Full-platform Official WhatsApp Management vision documented as a separate long-term module
- [x] README refresh to match implemented backend status

---

## 0. Foundation / tooling

- [x] Monorepo (npm workspaces) — `package.json`, `tsconfig.base.json`, root `tsconfig`
- [x] Vitest config
- [x] `.gitignore`, `.env.example`
- [x] Docker Compose dev infra (postgres, redis, minio, minio-init)
- [x] First-party `apps/gateway` runtime scaffold for linked-device QR/group/message bridge
- [x] `README.md` (run/dev instructions)
- [ ] CI workflow (lint + typecheck + test on PR) — post-backend
- [~] ESLint config in place; Prettier still pending

## 1. Shared packages

- [x] `@clariodesk/config` — env parsing + fail-fast validation (zod)
- [x] `@clariodesk/logger` — pino structured logging + secret redaction
- [x] `@clariodesk/types` — canonical domain enums + NormalizedGatewayEvent
- [x] `@clariodesk/schemas` — zod request schemas for API boundaries

## 2. Database (`@clariodesk/db`, Drizzle) — P0/P1

- [x] Enums mirrored from `@clariodesk/types`
- [x] core: workspaces, users, workspace_users, clients, projects
- [x] transport: phone_instances, gateway_sessions schema (ciphertext column present; crypto/key management tracked in §12)
- [x] channel: channels, channel_mappings (one-active partial unique), group_metadata_events
- [x] identity: contacts, contact_identities, channel_memberships, workspace_user_identities
- [x] messages: raw_event_refs, messages (P0 safety flags), message_media, outbox_messages
- [x] tickets: tickets, ticket_messages, internal_notes
- [x] access: client_assignments, channel_assignments, user_channel_read_state
- [x] audit: audit_logs
- [x] DB client singleton + drizzle.config
- [x] Generated SQL migration (`0000` 24 tables + `0001` FTS GIN indexes)
- [x] Seed script (`apps/api/src/seed.ts` — demo workspace/admin/client/project/phone)

## 3. Gateway adapters (`@clariodesk/gateway-adapters`) — P1

- [x] `WhatsAppGatewayAdapter` interface + capability matrix
- [x] First-party `clario_gateway` adapter: status, QR/session connect, group sync, recent message fetch, text send/reply, media send/download; unit-tested
- [-] Evolution adapter/reference code — retained only as non-product reference, not exposed in Core v1 runtime/UI
- [-] OpenWA adapter/reference code — retained only as non-product reference, not exposed in Core v1 runtime/UI
- [x] Unit tests for Clario Gateway text/history/media and reference adapter normalization
- [x] Group list/sync contract + Clario Gateway implementation — covered by integration test
- [x] Gateway message-history contract (`fetchMessages`) added for capable adapters
- [x] Group metadata/delete event normalization where Evolution supports it — rename review and delete-for-everyone handling implemented and integration-tested
- [-] WAHA adapter (P2)
- [-] Meta Cloud API adapter (P3/P4, official management module remains P4/P5)
- [ ] Gateway contract tests harness for Clario Gateway runtime

## 4. Policy engine (`@clariodesk/policy-engine`) — P0 (safety heart)

- [x] `classifyMessage` — backfill/stale/live + suppression reasons
- [x] Idempotency key + fallback fingerprint
- [x] Echo reconciliation decision (outbox ↔ inbound echo)
- [x] Send policy (route active / phone restricted / cooldown / cost / bulk risk)
- [x] Internal-sender inference helper
- [x] Unit tests: classification matrix, idempotency, echo, send policy (38 tests)
- [x] `index.ts` barrel export

## 5. API server (`apps/api`, NestJS + Fastify) — P0/P1

- [x] App bootstrap (Fastify adapter, config, global prefix, shutdown hooks)
- [x] CoreModule (global): config/db/storage/queues/adapters/logger providers
- [x] Auth module (email/password, bcrypt, JWT) + register-workspace bootstrap
- [x] JWT guard + `@CurrentUser` + permission-scoped `AccessService`
- [x] Webhook ingestion `POST /gateway-webhooks/:adapterType/:phoneInstanceId`
      (secret guard → store raw_event_ref + payload → enqueue → fast 200) — **verified live**
- [x] Channels: list (permission-scoped), map (optional client attribution + supersede)
- [x] Messages: cursor-paginated timeline (permission-scoped)
- [x] Messages: manual recent-history sync endpoint (`POST /channels/:channelId/sync-messages`) queues gateway history through the worker pipeline
- [x] Outbox: create send (send-delay), cancel within window — **verified live**
- [x] Internal notes: create (never sent to WhatsApp)
- [x] Tickets: create from message (client inherit/mixed), assign, status — **verified live**
- [x] Audit log writes on sensitive actions — **verified live**
- [x] Clients/Projects admin endpoints (list/create/archive) — **verified live**
- [x] Phones admin endpoints (create/connect/QR/status/sync-groups/disconnect) — **verified live**; sync now discovers all chats, not just groups
- [x] Team endpoints (create user, list members, assign client/channel) — **verified live**
- [x] Contacts endpoints (workspace contacts + channel members)
- [x] Tickets list/get (permission-scoped) — **verified live**
- [x] Media: signed download URL endpoint with permission check
- [x] Search: Postgres FTS (GIN), permission-scoped — **verified live**
- [x] dotenv loading in entrypoints
- [x] Channel/chat sync endpoint (`POST /phones/:id/sync-groups`) — creates unmapped groups, keeps direct chats active, refreshes existing metadata, preserves active mappings; integration-tested
- [x] Basic first-response timer — eligible inbound starts channel clock; dashboard/phone-user reply clears it; tickets inherit answered source-message state
- [x] Channel Registry review flow for group rename/metadata drift — Evolution group metadata normalization, review queue API, review resolution, integration-tested
- [x] Delete-for-everyone status handling — Evolution REVOKE normalization, target status update, realtime update, integration-tested
- [x] Simple operational dashboard/read model (`GET /ops/summary`: phone health, unmapped/waiting channels, ticket/outbox counts, queue counts, recent failures) — integration-tested
- [x] OpenAPI/Swagger surface — exposed at `/api/docs` + `/api/docs/json`

## 6. Worker (`apps/worker`, BullMQ) — P0/P1

- [x] Queue names + connection setup, priorities
- [x] Normalization pipeline (port-based, unit-tested with fake store, 7 tests)
- [x] `message-normalization` processor (dedup → classify → resolve context → store → fan out media)
- [x] Outbound echo reconciliation into outbox row (Drizzle store + pipeline)
- [x] Drizzle implementation of the store port
- [x] `media-download-live` / `media-download-backfill` processor → MinIO
- [x] `outbox-send` processor (policy gate, store provider id for echo merge)
- [x] Worker bootstrap + graceful shutdown
- [x] Raw-event payload upload handled inline by the API webhook (returns fast)
- [x] Integration tests with Testcontainers (normalization store, group sync, ticket first-response inheritance) — **caught real bugs**
- [x] First-response timer update on eligible inbound/outbound messages
- [x] Group metadata/delete event processors (rename review events, delete-for-everyone status)
- [ ] Backpressure / reconnect-storm rate limiting on the queue — P2 hardening, but important for pilot safety
- [x] `audit-retention` / purge moved to the scheduler runtime (§9)

## 7. Object storage (`@clariodesk/storage`) — P0

- [x] S3/MinIO client wrapper (putMedia/putRawEvent/signed-url/delete)
- [x] Raw event key builder + gzip
- [x] Media key builder (opaque media_id, never filename) + tests (3)
- [x] Bucket bootstrap check (`ensureBuckets()` on api + worker boot)
- [ ] Default encryption-at-rest/SSE story for media + raw-event buckets and production Postgres — required by TDD §23.3 before real sensitive pilots
- [x] Gateway/session secret encryption implementation + key-management config — schema column exists, and the crypto flow is wired through the shared adapter factory

## 8. Realtime (`apps/realtime`, Socket.io) — P1 in progress

- [x] `@clariodesk/events` bus (Redis pub/sub publisher + subscriber)
- [x] Socket.io server with JWT handshake auth
- [x] Permission-scoped rooms (workspace/channel/user + admin room)
- [x] Event publishing from API (outbox/ticket/note) + worker (`message.received`)
- [~] Real linked-device message delivery through the complete chain; gateway defects patched,
  real-phone restart/reconnect verification pending
- [x] UI-level Socket.io reconnect reconciliation and disconnected polling fallback
- [ ] Runtime health/readiness covering gateway → webhook → worker → Redis → Socket.io
- [ ] Socket.io Redis adapter for multi-instance scale — P2 (single instance works now)
- [ ] In-app notification center/read model — P1/P2
- [ ] Web Push subscriptions/service worker/notification delivery pipeline — P2
- [ ] Notification preferences, quiet hours, preview privacy, and action tokens — P2

## 9. Scheduler (`apps/scheduler`) — P1 runtime complete, reporting hardening pending

- [x] Raw-event / media / message retention purge (soft-purge ticket-linked) — **verified live**
- [x] Phone health checks (degrade stale/stuck-syncing phones)
- [x] Interval-based runner with per-job isolation + graceful shutdown
- [ ] Retention/reporting visibility for admins (storage health, purge summaries) — post-backend/pilot hardening

## 10. Frontend (`apps/web`, Vite React) — functional foundation, productization in progress

- [~] App shell foundation (nav, ops bar, inbox grid) — API-backed, but desktop/mobile pane behavior
  and visual hierarchy still require redesign
- [x] Auth screen: login/register against real API; local session storage
- [x] Phone setup page: create phone route, connect, status refresh, chat sync, disconnect actions
- [x] Timeline sync action: queues recent gateway message import for the selected channel
- [x] Phone setup page is Clario Gateway only; legacy OpenWA/Evolution rows are hidden from Core v1 runtime
- [x] Message/note context menu with right-click actions (reply, private note, create ticket, copy/copy-id, refresh; future actions disabled)
- [x] Channel row context menu with right-click actions (open chat, map group, sync messages, copy title/copy ID)
- [x] Sidebar/inbox channel list — loads permission-scoped API channels; search and view filters work
- [x] Shared inbox timeline — loads cursor API timeline for active channel
- [x] External reply composer + internal note composer — calls outbox/note APIs; replies work without forcing mapping
- [x] Ticket side panel tabs — context tabs are stateful; ticket rows use API data
- [x] Tickets page — list + status update
- [x] Search page — calls search API
- [x] Clients/projects page — create client/project via API
- [x] Team page — list/create users via API
- [x] Reports/settings pages — ops summary/session controls
- [~] Realtime UI subscriptions + notification center; socket events trigger broad refetches, but
  reconnect reconciliation, optimistic cache updates, and offline behavior are missing
- [x] ClarioDesk Gateway live QR scan + group/message-history validation with real phone
- [x] Mapping UI for synced unmapped groups — optional admin metadata, not required for chat replies
- [x] Phase-1 Playwright suite — phones, mapping, search, ticket, private note, and delayed reply flows all pass
- [x] Core Playwright E2E coverage for active Phase-1 UI actions
- [x] Search UI
- [x] E2E tests (Playwright)
- [ ] Final design system/component library and visual regression suite
- [ ] WhatsApp-quality chat list, timeline, composer, media, and responsive interaction pass

## 11. Deployment / docs — P1

- [x] Production Dockerfile (multi-stage) + docker-compose (api/worker/realtime/scheduler/migrate + infra)
- [x] `.env.example` documents all variables
- [x] AGPL LICENSE file (SPDX + notice)
- [x] README status refresh — matches current backend/frontend state
- [x] Architecture + operations docs under `/docs`
- [x] Observability baseline implemented via `/api/ops/metrics`; dashboard/alerting still pending
- [x] Failure/integration coverage expanded: webhook auth+ingest, outbox rejection/access denial, gateway sync failure, media download processor failure paths

---

## 12. Spec-reconciliation gaps before calling Core v1 backend complete

These are gaps found by rereading the TDD + FRS against the current code. Some are backend-only;
some are productization requirements that need frontend too, but the backend/API support is still
missing or incomplete.

- [x] Group sync from connected phone, not only channel discovery from inbound webhooks
- [x] Basic first-response timer end-to-end (eligible inbound start, agent/phone-user reply stop, API exposure)
- [x] Channel Registry review workflow for group metadata drift/renames
- [x] Delete-for-everyone event handling
- [x] Pilot operational dashboard backend/read model
- [ ] Queue backpressure and reconnect-storm controls beyond stale/live classification
- [ ] Production encryption-at-rest/SSE and gateway-session secret encryption flow
- [x] OpenAPI/Swagger + architecture/operations docs
- [~] CI workflow + broader integration/failure tests; lint exists, format config still pending

---

## Deferred / roadmap after Core v1

### P2 — Operational v1.5 / v2

- [-] External gateway adapters (WAHA/Evolution/OpenWA) — deferred/reference only
- [-] Full SLA + reverse SLA engine — P2
- [-] Automation rule builder + cooldowns — P2/P3
- [-] Handover notes + pinned context
- [-] Coverage windows / temporary read-only access
- [-] Basic analytics and operational reporting
- [-] Better search filters and contact review
- [-] Simple import/migration wizard and richer backfill modes
- [-] Phone pool support basics
- [-] Task management / lightweight follow-ups
- [-] Quick replies and template variables (non-official transport)

### P3 — Advanced differentiators

- [-] AI runtime (BYOK settings, audit, summaries, transcription, triage, sensitive-data scan) — P2/P3 runtime, P1 planning done
- [-] Virtual threading — P3
- [-] Shared draft collaboration / approvals — P3
- [-] Incident mode + war room — P3
- [-] Inbound storm detection + bundles — P3
- [-] Cross-client asset contamination blocking + asset vault governance — P3
- [-] Bulk / jittered broadcast queue — P3
- [-] External linked-device adapter portability work, only after first-party Clario Gateway is robust
- [-] Group offboarding workflow
- [-] Dynamic persona aliasing
- [-] Outbound voice-note transcript verification

### P4 — Enterprise / long-term

- [-] Official WhatsApp Management module — P4/P5
- [-] Meta Cloud API adapter, official 1:1 conversations, template registry — P3/P4
- [-] Embedded Signup, WABA/phone management, WhatsApp Flows, opt-outs, delivery analytics — P4/P5
- [-] SSO/SAML, advanced RBAC, break-glass access — P4
- [-] Plugin system, industry templates, managed cloud, mobile app — P4
- [-] Advanced compliance reports, data residency controls, BYO/local AI controls
- [-] Full cost/risk routing dashboard and official template management
- [-] Multi-gateway resilience/control plane

---

## Known decisions (from doc review)

- Multi-phone in schema from day one; UI exposes one in Core v1.
- Live media download mandatory; backfill media best-effort.
- Mixed groups admin-only, automation/SLA off by default.
- Clario Gateway is the first and only Core v1 production gateway.
- Official Meta Cloud API is v2, not a parallel track.
- `messages.client_id/project_id` immutable after ingest (remap does not rewrite history).
- Media object keys use opaque media_id, never the filename.

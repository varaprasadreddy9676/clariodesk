# Technical Design Document (TDD)
# Open-Source Customer Support Desk For WhatsApp Groups

**Document Version:** v1.0  
**Document Type:** Comprehensive Technical Architecture / Engineering Design  
**Primary Audience:** Engineering, Architecture, DevOps, Security, Product Engineering  
**Related Document:** Functional Requirements Specification v4 - Priority Tagged  
**Status:** Draft for engineering review  

---

## 0. Executive Summary

This document defines the technical architecture for ClarioDesk: an open-source
customer support desk for WhatsApp chats. It is designed for organizations that
already manage customer support, implementation, service delivery, account
management, vendor coordination, or project operations through WhatsApp groups
and 1:1 chats.

The product is not a generic chatbot, not a marketing sender, and not a simple
WhatsApp API wrapper. It is a support operations layer that transforms chaotic
customer WhatsApp group communication into structured work:

```text
Customer WhatsApp group message
→ normalized event
→ client/project/channel context
→ shared inbox
→ safe reply / internal note
→ ticket / owner / status / basic SLA
→ audit / search / reporting
```

The platform must support existing WhatsApp chats through a linked-device gateway while also being architected to support the official Meta WhatsApp Business Platform for compliant 1:1 messaging in later phases.

The architecture intentionally avoids premature overengineering. It uses a modular monolith design with clean internal boundaries, PostgreSQL as the source of truth, Redis/BullMQ for background processing, S3/MinIO for media and raw payload storage, and a gateway adapter layer for WhatsApp transport providers.

The key technical principle is:

```text
Transport must be replaceable.
Operations logic must remain stable.
```

The product priority is:

```text
First solve customer WhatsApp group support operations.
Then add operational maturity, AI assist, official API routes, and enterprise controls.
```

WhatsApp gateways may break, change, disconnect, or become unsuitable for specific customers. The core platform must not be tightly coupled to any one gateway implementation.

---

## 1. Core Engineering Goals

### 1.1 Primary Goals

The system must be:

1. **Robust** — survives gateway disconnects, duplicate webhooks, stale syncs, media expiry, partial failures, and user mistakes.
2. **Scalable enough without overengineering** — handles many workspaces, groups, agents, messages, tickets, and phone instances using PostgreSQL, Redis, workers, and object storage before requiring Kafka or microservices.
3. **Self-hostable** — deployable through Docker Compose initially, with Kubernetes/Helm later only as an advanced deployment option.
4. **Gateway-owned with adapter boundaries** — Core v1 product runtime uses the first-party ClarioDesk Gateway for linked-device WhatsApp groups. The adapter interface remains clean so future WAHA/Evolution/OpenWA/Meta support can be added later without changing support-workflow logic.
5. **Client-isolated** — prevents cross-client data leakage in sidebar, search, tickets, files, AI, and reports.
6. **Support-operations-first** — prioritizes the customer chat inbox, safe replies, internal notes, ticket creation, ownership, status tracking, and audit before AI or complex automation.
7. **Safe by default** — no automation on backfilled/stale messages, no unchecked bulk sends, no misleading undo-send behavior, and no cross-client asset sharing.

### 1.2 Non-Goals for Initial Release

The first usable release must not attempt to build:

- Full AI triage engine.
- Full automation builder.
- Official API hybrid routing.
- Advanced incident war room.
- Plugin marketplace.
- Complex enterprise RBAC.
- Advanced asset governance.
- Multi-gateway active-active failover.
- Kafka/NATS/Temporal architecture.
- Full mobile native app.

These are valid long-term capabilities, but not needed for the first useful version.

---

## 2. Recommended Technology Stack

### 2.1 Frontend

| Layer | Recommendation |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix primitives |
| Server state | TanStack Query |
| Local UI state | Zustand |
| Realtime client | Socket.io client |
| Forms | React Hook Form + Zod |
| Tables/lists | TanStack Table / virtualized lists |
| Testing | Playwright + Vitest |

### 2.2 Backend

| Layer | Recommendation |
|---|---|
| Framework | NestJS |
| HTTP Engine | Fastify adapter |
| Language | TypeScript |
| ORM | Drizzle ORM preferred; Prisma acceptable if team chooses productivity over SQL control |
| Validation | Zod or class-validator; prefer Zod for shared schemas |
| Auth | Session/JWT based auth; later SSO/SAML |
| Logging | Pino |
| API Docs | OpenAPI/Swagger |
| Testing | Vitest/Jest + Testcontainers |

### 2.3 Data and Infrastructure

| Layer | Recommendation |
|---|---|
| Primary DB | PostgreSQL |
| Queue/Cache | Redis |
| Job Queue | BullMQ |
| Object Storage | S3-compatible storage; MinIO for self-hosted |
| Realtime | Socket.io + Redis adapter |
| Search v1 | PostgreSQL full-text search |
| Search later | Meilisearch |
| Monitoring | OpenTelemetry + Prometheus/Grafana later |
| Deployment v1 | Docker Compose |
| Deployment later | Helm/Kubernetes optional |

### 2.4 WhatsApp Transport

| Phase | Transport |
|---|---|
| v1 | First-party ClarioDesk Gateway as the only product-supported linked-device path. External gateways are reference code only. |
| v1.5 | Optional second linked-device adapter only after Clario Gateway is robust and production-proven |
| v2 | Official Meta Cloud API adapter for 1:1 compliant messaging |
| v2+ | Official WhatsApp Management module for WABA, templates, Flows, opt-outs, analytics |
| Optional | Self-hosters may still use external linked-device gateways, but Core v1 completion must not depend on them |

### 2.5 Tools to Avoid Initially

Do not use the following in the first architecture:

- Kafka.
- Kubernetes as default deployment.
- Elasticsearch/OpenSearch.
- Temporal.
- Microservices.
- GraphQL.
- Redux.
- MongoDB as primary DB.
- Raw JSON/media in PostgreSQL.
- Four gateway integrations at once.
- AI in the core synchronous message path.

---

## 3. Architecture Style

### 3.1 Modular Monolith

The platform should be built as a modular monolith, not a microservice architecture.

A modular monolith provides:

- One deployable codebase.
- Clear module boundaries.
- Shared database transactions.
- Lower operational overhead.
- Easier self-hosting.
- Easier open-source contribution.

Runtime processes can be separated while sharing the same codebase:

```text
api-server
worker
realtime-server
scheduler
```

Each runtime executes a different entry point but uses the same domain modules.

### 3.2 High-Level System Diagram

```text
                     ┌──────────────────────┐
                     │      Web App          │
                     │ Next.js / React       │
                     └──────────┬───────────┘
                                │ HTTP + WS
                     ┌──────────▼───────────┐
                     │      API Server       │
                     │ NestJS + Fastify      │
                     └───────┬───────┬──────┘
                             │       │
             ┌───────────────▼──┐   ┌▼────────────────┐
             │   PostgreSQL      │   │ Redis / BullMQ   │
             │ Source of Truth   │   │ Jobs / Cache     │
             └───────────────┬──┘   └┬────────────────┘
                             │        │
                   ┌─────────▼────────▼───────┐
                   │       Worker Runtime      │
                   │ Normalize / Media / Send  │
                   └─────────┬────────────────┘
                             │
                ┌────────────▼────────────┐
                │      Object Storage      │
                │ S3 / MinIO               │
                └────────────┬────────────┘
                             │
       ┌─────────────────────▼──────────────────────┐
       │            Gateway Adapter Layer            │
       │ Evolution / WAHA / OpenWA / Meta Cloud API  │
       └─────────────────────┬──────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │     WhatsApp      │
                    │ Groups / 1:1      │
                    └──────────────────┘
```

### 3.3 Architectural Boundaries

The system must separate:

1. **Transport Layer** — gateway-specific WhatsApp connectivity.
2. **Normalization Layer** — converts gateway payloads into internal events.
3. **Operations Layer** — inbox, tickets, notes, assignments, audit, SLA.
4. **Policy Layer** — permission checks, send rules, automation suppression, route selection.
5. **Storage Layer** — relational data, raw payload blobs, media objects.
6. **Realtime Layer** — user-visible state updates.

---

## 4. Repository Structure

Recommended monorepo layout:

```text
/apps
  /web
    Next.js frontend
  /api
    NestJS API server
  /worker
    BullMQ workers
  /realtime
    Socket.io realtime server
  /scheduler
    recurring jobs and maintenance tasks

/packages
  /db
    Drizzle schema, migrations, DB helpers
  /types
    shared TypeScript types
  /schemas
    Zod schemas
  /gateway-adapters
    adapter interfaces and implementations
  /policy-engine
    send policy, access policy, automation suppression
  /ui
    shared UI components
  /config
    environment parsing and config
  /logger
    logging helpers
  /storage
    S3/MinIO client utilities
  /auth
    auth helpers

/deploy
  docker-compose.yml
  docker-compose.dev.yml
  nginx/caddy configs
  helm/ later

/docs
  architecture
  api
  operations
  deployment
```

---

## 5. Runtime Processes

### 5.1 API Server

Responsible for:

- Auth and sessions.
- Workspace/client/channel/ticket APIs.
- Gateway webhook ingestion endpoint.
- Outbox request creation.
- Admin actions.
- File upload/download authorization.
- Search APIs.
- REST/OpenAPI surface.

The API server must not perform expensive tasks synchronously.

### 5.2 Worker Runtime

Responsible for:

- Message normalization.
- Media download.
- Raw payload upload.
- Backfill processing.
- Outbox send jobs.
- Retry handling.
- Search indexing.
- Retention cleanup.
- Notification delivery.
- Web Push fanout.

### 5.3 Realtime Runtime

Responsible for:

- Socket.io connections.
- Workspace/channel/ticket rooms.
- Permission-scoped event emission.
- Typing/presence state.
- Outbox status updates.
- In-app notification events for active sessions.

### 5.3.1 Web Push Runtime Responsibility

Web Push does not replace realtime. It covers inactive/backgrounded/closed browser
sessions through service workers and push subscriptions. Delivery can run from the
worker runtime initially, with a dedicated notification worker later if volume
requires it.

Responsibilities:

- Resolve eligible recipients.
- Apply notification preferences, quiet hours, and permission scope.
- Generate privacy-safe payloads.
- Send Web Push messages through browser push services.
- Track delivery attempts and failures.
- Revoke expired/invalid subscriptions.
- Audit notification actions.

### 5.4 Scheduler Runtime

Responsible for:

- Retention jobs.
- Stale sync checks.
- Phone health checks.
- SLA checks later.
- Queue cleanup.
- Object storage lifecycle reconciliation.

---

## 6. Core Domain Model

### 6.1 Core Entities

The first version should contain the following domain entities:

```text
workspaces
users
workspace_users
clients
projects
phone_instances
gateway_sessions
channels
channel_mappings
contacts
contact_identities
channel_memberships
messages
message_media
raw_event_refs
outbox_messages
tickets
ticket_messages
internal_notes
audit_logs
```

Long-term entities:

```text
automation_rules
sla_policies
ai_runs
ai_suggestions
knowledge_bases
exports
webhooks
api_keys
asset_vault_items
coverage_assignments
```

### 6.2 Workspace

A workspace represents one customer/company using the platform.

Key fields:

```text
id
name
slug
status
plan_type
default_timezone
created_at
updated_at
```

All major tables must include `workspace_id`.

### 6.3 Users and Workspace Users

`users` represent global login identities.

`workspace_users` represent a user inside a workspace.

Fields:

```text
workspace_users
---------------
id
workspace_id
user_id
role: admin | agent | viewer
status: active | inactive | invited
created_at
updated_at
```

### 6.4 Clients and Projects

Clients represent external accounts/customers/business entities.

Projects represent sub-containers under clients.

Examples:

```text
Client: ACME Corp
Project: ERP Implementation
Project: Production Support
```

### 6.5 Phone Instances

A phone instance represents a connected WhatsApp number.

Fields:

```text
id
workspace_id
adapter_type: evolution | waha | openwa | meta_cloud
phone_number
display_name
connection_mode: linked_device | official_api
status: connected | syncing | disconnected | qr_required | degraded | restricted | archived
gateway_node_id
last_seen_at
last_sync_at
risk_level
created_at
updated_at
```

### 6.6 Channels

A channel represents a WhatsApp group or 1:1 conversation.

Fields:

```text
id
workspace_id
phone_instance_id
provider_chat_id
channel_type: group | direct | official_direct
title
subject
avatar_url
status: active | archived | muted | unmapped
last_message_at
created_at
updated_at
```

### 6.7 Channel Mappings

A channel mapping assigns a channel to a client/project.

Mapping modes:

```text
single_client
mixed
unmapped
archived
```

Fields:

```text
id
workspace_id
channel_id
client_id
project_id
mapping_mode
mapping_effective_at
mapped_by_user_id
status
notes
created_at
updated_at
```

Important rule:

```text
For single_client mapping, all live messages after mapping_effective_at inherit client/project context.
For mixed mapping, each ticket must manually select client/project.
```

### 6.8 Contacts

Contacts are workspace-scoped global identities.

Fields:

```text
id
workspace_id
primary_phone
canonical_name
avatar_url
email
is_internal_global
created_at
updated_at
```

Unique constraint:

```text
workspace_id + primary_phone
```

Never make phone numbers globally unique across all workspaces.

### 6.9 Contact Identities

Contact identities represent provider-specific identifiers.

Fields:

```text
id
workspace_id
contact_id
provider
provider_user_id
phone
source
confidence_score
created_at
updated_at
```

### 6.10 Channel Memberships

Stores how a contact appears in a channel.

Fields:

```text
id
workspace_id
channel_id
contact_id
client_id
project_id
display_name_in_channel
role_in_channel
is_internal_override
is_client_side_override
is_verified
source
last_seen_at
created_at
updated_at
```

Internal/external classification should be inferred from:

1. Global workspace user/contact mapping.
2. Explicit membership override.
3. Phone instance owner.
4. Unknown fallback.

### 6.11 Messages

Fields:

```text
id
workspace_id
channel_id
client_id
project_id
phone_instance_id
provider_message_id
provider_chat_id
provider_sender_id
sender_contact_id
message_type: text | image | video | audio | document | sticker | reaction | system | deleted | unknown
direction: inbound | outbound
sent_by_type: client_user | dashboard_agent | phone_user | automation | ai | system | unknown
sent_by_user_id
body
quoted_provider_message_id
quoted_message_id
provider_timestamp
ingested_at
is_backfill
is_live_event
automation_suppressed
automation_suppressed_reason
sla_eligible
ticket_auto_create_eligible
raw_event_ref_id
status: received | sent | delivered | read | failed | deleted_on_whatsapp | purged
created_at
updated_at
```

Unique constraint:

```text
workspace_id + channel_id + provider_message_id
```

> **NOTE (review — data modeling):**
> - **Reactions/deletes should not be plain message rows.** `reaction`, `system`, and `deleted` mutate or annotate another message rather than being timeline entries. If kept in this table, they MUST be explicitly excluded from first-response/SLA, unread counts, and the virtualized timeline. Preferably move reactions to a separate `message_reactions` table keyed by target `message_id`.
> - **`client_id` / `project_id` are immutable after ingest.** They are set once at normalization time from the mapping that was effective then. A later remap (see §O.4 context drift) does **not** rewrite historical message rows — otherwise analytics-by-mapping-validity-period (§O.4.7) double-counts. The denormalized column is the ingest-time owner; mapping-period lookup is only for re-attribution reports.

### 6.12 Message Media

Fields:

```text
id
workspace_id
message_id
client_id
channel_id
storage_key
file_name
mime_type
size_bytes
sha256_hash
media_type
storage_status: pending | downloaded | failed | expired | purged
source: live | backfill | upload
retention_until
created_at
updated_at
```

### 6.13 Raw Event References

Raw payloads must not be stored as large JSON blobs in PostgreSQL.

Fields:

```text
id
workspace_id
phone_instance_id
adapter_type
provider_event_id
event_type
received_at
provider_timestamp
object_key
compressed_size_bytes
sha256_hash
retention_until
created_at
```

Actual payload lives in S3/MinIO:

```text
raw-events/{workspace_id}/{yyyy}/{mm}/{dd}/{event_id}.json.gz
```

### 6.14 Outbox Messages

All outbound messages must go through the outbox pipeline.

Fields:

```text
id
workspace_id
channel_id
client_id
phone_instance_id
created_by_user_id
message_type
body
media_id
quoted_message_id
send_mode: immediate | delayed | scheduled | bulk
send_after
status: pending | waiting_delay | sending | sent | failed | cancelled
policy_status: allowed | blocked | needs_approval
failure_reason
provider_message_id
created_at
updated_at
```

### 6.15 Tickets

Fields:

```text
id
workspace_id
client_id
project_id
channel_id
source_message_id
title
description
status: open | pending | closed
priority: low | normal | high | urgent
assigned_user_id
created_by_user_id
first_response_at
closed_at
created_at
updated_at
```

Keep v1 ticketing simple. Expand statuses later.

---

## 7. Gateway Adapter Architecture

### 7.1 Adapter Interface

All gateways must implement a common internal interface.

```ts
export interface WhatsAppGatewayAdapter {
  getAdapterType(): GatewayAdapterType;

  connect(input: ConnectInput): Promise<ConnectResult>;
  disconnect(input: DisconnectInput): Promise<void>;
  getConnectionStatus(input: StatusInput): Promise<ConnectionStatus>;
  getQrCode(input: QrInput): Promise<QrResult>;

  fetchChats(input: FetchChatsInput): Promise<GatewayChat[]>;
  fetchGroups(input: FetchGroupsInput): Promise<GatewayGroup[]>;
  fetchContacts(input: FetchContactsInput): Promise<GatewayContact[]>;

  sendText(input: SendTextInput): Promise<GatewaySendResult>;
  sendMedia(input: SendMediaInput): Promise<GatewaySendResult>;
  sendQuotedReply(input: SendQuotedReplyInput): Promise<GatewaySendResult>;

  downloadMedia(input: DownloadMediaInput): Promise<GatewayMediaStream>;

  normalizeWebhook(input: RawGatewayWebhook): Promise<NormalizedGatewayEvent[]>;
}
```

### 7.2 Capability Detection

Gateways do not support identical features. The adapter must expose capabilities.

```text
supportsGroups
supportsQuotedReply
supportsReactions
supportsTypingEvents
supportsReadReceipts
supportsParticipantEvents
supportsHistorySync
supportsMediaDownload
supportsMessageDeleteEvents
supportsOfficialTemplates
```

The UI and policy engine must read these capabilities before enabling features.

### 7.3 Linked-Device Adapter: ClarioDesk Gateway

Core v1 ships the first-party ClarioDesk Gateway as the only product-supported
linked-device adapter. The code keeps an adapter boundary so future transports can
be added without changing inbox, ticketing, policy, audit, or UI workflows, but
external gateways are not part of the Phase 1 completion criteria.

The adapter should support:

- QR connection.
- Phone status.
- Group sync.
- Recent message history fetch for normal groups.
- Message receive.
- Text send.
- Media receive/download.
- Quoted reply where supported.
- Participant update where supported.
- History sync events where supported.

Core v1 exposes chat sync through `POST /phones/:id/sync-groups` (admin-only).
The API prefers `fetchChats` and falls back to `fetchGroups`, upserts channels by
`(workspace_id, phone_instance_id, provider_chat_id)`, creates new groups as
`unmapped`, creates new direct chats as `active`, refreshes title/subject for
existing channels, and never resets an existing mapping during sync.

Core v1 exposes recent history sync through
`POST /channels/:channelId/sync-messages`. The API calls the selected adapter's
`fetchMessages` capability and enqueues the result through the existing worker
normalization pipeline as history/reconnect sync, never as live automation input.

#### 7.3.1 External Gateway Risk And Product Decision

External linked-device gateways are useful accelerators, but they are not product
ownership. They can change endpoints, break QR generation, lag behind WhatsApp Web
changes, or expose behavior the ClarioDesk team cannot patch quickly.

Observed local proof on 2026-06-13:

- Evolution API v2.1.1 ran with Postgres/Redis after config fixes, but fresh QR
  generation returned `{"count":0}` even after WhatsApp Web version pinning.
- Existing OpenWA was already linked to a real WhatsApp number and returned 93
  groups through its API, but its public HTTP surface did not expose regular
  group chat history in the shape ClarioDesk needs.
- ClarioDesk created an OpenWA phone route, reported `connected`, and synced those
  93 groups through the same `/phones/:id/sync-groups` backend contract.

Therefore the Phase 1 engineering rule is:

```text
Use third-party gateways only as references.
Own the ClarioDesk Gateway, adapter contract, queueing, safety policy, audit, and UI.
Do not call Core v1 complete until the first-party gateway proves QR, group sync,
recent message history, media receive/download, live webhooks, and reply/send against a real phone.
```

### 7.4 First-Party ClarioDesk Gateway

A first-party gateway should not be a broad WhatsApp platform clone. It should
implement only the ClarioDesk linked-device support surface:

- Create/list sessions.
- QR generation and refresh.
- Connection status.
- Group list and group metadata.
- Recent chat message history via WhatsApp Web `fetchMessages`.
- Incoming message events.
- Text send, media send, media download, and quoted reply.
- Media download/upload for support attachments.
- Logout/disconnect.
- Reconnect/backfill boundary markers.

It must implement the same `WhatsAppGatewayAdapter` contract as external adapters.
It must not own customer, ticket, SLA, assignment, audit, AI, search, or
notification logic. Those remain in ClarioDesk core; the gateway is browser
automation plus a narrow HTTP bridge only.

### 7.5 Official Meta Cloud API Adapter

The official adapter is a v2 feature.

It must support:

- Webhook verification.
- 1:1 message receive.
- Template send.
- Session message send.
- Media send.
- Delivery/read status.
- Cost/category metadata.

It should not be treated as equivalent to linked-device group operations.

### 7.6 Official WhatsApp Management Module

The full platform should include a separate official-channel module after the core
customer WhatsApp group support loop is proven.

Detailed product planning lives in `docs/official-whatsapp/official-whatsapp-management.md`.

This module should manage:

```text
Meta Cloud API connections
Embedded Signup / customer-owned Meta onboarding
WABA accounts
Phone numbers
Official 1:1 conversations
Templates
WhatsApp Flows
Opt-outs
Bot workflows
Delivery/read/failure analytics
Cost/category/tier/quality visibility
Industry packs
```

It shares platform foundations with the support desk:

```text
workspaces
clients/projects
contacts
users/RBAC
audit
webhooks
queues
notifications
AI/BYOK
reports
public API
```

It should remain a separate module/navigation surface so group-support agents are
not forced through WABA, template, Flow, or tier-limit concepts while answering
customer group messages.

---

## 8. Message Ingestion Pipeline

### 8.1 Goals

The ingestion pipeline must:

- Return quickly to gateway webhooks.
- Store raw payload safely outside PostgreSQL.
- Deduplicate events.
- Normalize provider-specific data.
- Identify backfill/stale/live status.
- Download live media quickly.
- Emit realtime events.
- Avoid automation on stale/backfilled messages.

### 8.2 Pipeline

```text
Gateway webhook
↓
API receives payload
↓
Authenticate gateway source
↓
Create raw_event_ref metadata row
↓
Upload compressed raw payload to object storage
↓
Enqueue normalize_message job
↓
Return HTTP 200 quickly
↓
Worker normalizes message
↓
Deduplicate provider_message_id
↓
Resolve phone/channel/contact/client context
↓
Classify live vs backfill/stale
↓
Store normalized message
↓
If media: enqueue media_download job
↓
Emit permission-scoped realtime event
```

### 8.3 Raw Payload Storage

Do not store raw JSON blobs in PostgreSQL.

Store:

- Metadata in PostgreSQL.
- Compressed `.json.gz` payload in object storage.

This avoids PostgreSQL TOAST bloat and keeps backup/retention manageable.

### 8.4 Deduplication

Deduplicate by:

```text
workspace_id + channel_id + provider_message_id
```

If provider IDs are unreliable for a gateway, fallback fingerprint:

```text
provider_chat_id + sender_id + provider_timestamp + message_type + sha256(body/media_ref)
```

> **NOTE (review — outbound echo dedup):** Linked-device gateways (Baileys-based: Evolution/WAHA) re-emit every dashboard-sent message back as an inbound webhook *echo*. To avoid a duplicate row for every reply, the `sendText`/`sendMedia` adapter result MUST return the `provider_message_id`, which is stored on the `outbox_messages` row; when the echo arrives, match it by `workspace_id + channel_id + provider_message_id` and **merge into the existing outbound message** rather than inserting a new one. This is the concrete mechanism behind §10.2's "create/merge outbound message record."

### 8.5 Live vs Backfill Classification

A message must be classified as backfill if:

- Provider timestamp is before mapping effective timestamp.
- Gateway marks it as history sync.
- Message is older than configured stale threshold during reconnect.
- Backfill job explicitly imported it.

Backfilled/stale messages must have:

```text
is_backfill = true
is_live_event = false
automation_suppressed = true
sla_eligible = false
ticket_auto_create_eligible = false
```

### 8.6 Sync Storm Handling

When a phone reconnects after a long outage, the gateway may emit many missed messages.

Rules:

- Detect sync phase.
- Rate-limit normalization jobs.
- Suppress automation for old messages.
- Mark messages as stale/manual review when appropriate.
- Do not auto-send acknowledgements for old messages.
- Do not start SLA timers for old messages.

---

## 9. Media Pipeline

### 9.1 Live Media

Live media must be downloaded aggressively.

```text
Message received with media
↓
High-priority media download job
↓
Download stream from gateway
↓
Upload to S3/MinIO
↓
Store metadata and hash
↓
Update message media status
↓
Notify UI
```

Reason: WhatsApp media URLs/tokens may expire.

### 9.2 Backfill Media

Backfilled media should be best-effort.

Rules:

- Low-priority queue.
- Limited retries.
- Mark expired/unavailable clearly.
- Do not block backfill completion.

### 9.3 Media Object Keys

Suggested key structure:

```text
media/{workspace_id}/{client_id}/{channel_id}/{yyyy}/{mm}/{message_id}/{media_id}
```

> **NOTE (review — key vs filename):** The object key uses an opaque `{media_id}`, not `{file_name}`. WhatsApp filenames are frequently sensitive (e.g. `Invoice_ACME_unpaid.pdf`) and §23.3 forbids exposing sensitive names in keys. The original `file_name` lives only as DB metadata on `message_media` and is restored at download time via the signed-URL response, never embedded in the storage path.

### 9.4 Media Security

v1 requirements:

- Authenticated download URLs.
- Short-lived signed URLs.
- Workspace/client permission check before issuing URL.
- Store SHA-256 hash.
- Store MIME type and size.

Post-v1:

- Virus scanning.
- Sensitive data detection.
- Cross-client asset token isolation.
- Watermarked exports.

---

## 10. Outbox and Send Pipeline

### 10.1 Principle

Never send directly from UI to gateway.

All outbound sends must go through an outbox record and worker.

### 10.2 Flow

```text
Agent clicks Send
↓
API validates permissions
↓
Create outbox_message row
↓
Apply send delay if enabled
↓
Policy engine validates route and risk
↓
BullMQ outbox job sends via gateway adapter
↓
Update outbox status
↓
Store provider message id
↓
Create/merge outbound message record
↓
Emit realtime status
```

### 10.3 Send Delay

Use the term **send delay**, not undo send.

The system can hold a message for 3 seconds before dispatching. During this window, the user may cancel.

Once dispatched to WhatsApp, true undo is not guaranteed.

### 10.4 Bulk Send and Jitter

Bulk group sends must be serialized and jittered.

Rules:

- No concurrent sends for bulk linked-device group announcements.
- Random delay between each destination.
- Optional typing simulation if gateway supports it.
- Per-phone hourly/daily send caps.
- Abort if failure/risk threshold crosses limit.

### 10.5 Outbox Statuses

```text
pending
waiting_delay
policy_blocked
queued
sending
sent
failed
retrying
cancelled
```

### 10.6 Ghost Agent Outbound Echo

If someone replies directly from the physical phone, the platform should ingest the outbound echo.

Classify as:

```text
direction = outbound
sent_by_type = phone_user
```

This must:

- Update timeline.
- Count as team response for basic first-response timer.
- Avoid duplicate auto-ack.
- Show as “Sent from connected phone / external device.”

---

## 11. Channel Mapping and Backfill

### 11.1 Mapping Modes

Channels can be:

```text
unmapped
single_client
mixed
archived
```

### 11.2 Mapping Effective Boundary

Every mapping must set:

```text
mapping_effective_at = current timestamp
```

Messages before this timestamp are historical context.

Messages after this timestamp are live operations.

### 11.3 Backfill Policy

Default policy:

```text
Import history as read-only context.
No automation.
No SLA.
No auto-ticketing.
No notifications.
```

Backfill modes:

```text
none
read_only
manual_review
advanced
```

### 11.4 Mixed Groups

Mixed groups must be supported pragmatically.

Rules:

- UI must show high-risk warning.
- Messages do not auto-inherit client/project.
- Ticket creation requires manual client/project selection.
- Automation disabled by default.
- SLA disabled by default.
- Search results must respect ticket/client scoping where possible.

### 11.5 Group Metadata Drift

If gateway reports group subject/description change:

- Update channel metadata.
- Create review task/log.
- Ask admin whether mapping should change.
- Do not automatically remap client/project.

---

## 12. Access Control

### 12.1 v1 Roles

Keep roles simple:

```text
Admin
Agent
Viewer
```

### 12.2 Visibility Rule

Agents must only see assigned clients/channels.

This applies to:

- Sidebar.
- Inbox list.
- Search.
- Tickets.
- Media.
- Realtime events.
- API responses.

### 12.3 Permission Enforcement

Do not rely only on frontend hiding.

All server queries must filter by workspace and allowed channel/client IDs.

### 12.4 Suggested Permission Tables

```text
workspace_users
client_assignments
channel_assignments
```

Example:

```text
client_assignments
------------------
id
workspace_id
client_id
workspace_user_id
access_level: agent | viewer
created_at
```

Post-v1:

- Coverage access.
- Break-glass access.
- Temporary read-only access.
- Auditor role.

---

## 13. Realtime Design

### 13.1 Technology

Use Socket.io with Redis adapter.

### 13.2 Rooms

```text
workspace:{workspaceId}
channel:{channelId}
ticket:{ticketId}
user:{userId}
phone_instance:{phoneInstanceId}
```

### 13.3 Events

```text
message.received
message.updated
message.media_updated
outbox.status_changed
ticket.created
ticket.updated
note.created
channel.updated
phone.status_changed
typing.update
presence.update
```

### 13.4 Permission-Scoped Emission

Before emitting channel events, verify user access.

Implementation options:

1. Join users only to allowed channel rooms.
2. On assignment changes, update room memberships.
3. Never broadcast sensitive channel events to workspace room unless admin-only.

### 13.5 Inbox State

Unread counts should be derived from:

```text
user_channel_read_state
-----------------------
workspace_user_id
channel_id
last_read_message_id
last_read_at
```

Do not update unread counters purely in frontend memory.

---

## 14. Ticketing v1

### 14.1 Scope

v1 ticketing should be deliberately simple.

Features:

- Create ticket from message.
- Assign owner.
- Status: Open, Pending, Closed.
- Priority: Low, Normal, High, Urgent.
- Link ticket to channel/message.
- Add internal note.
- Basic first-response timestamp.

### 14.2 Ticket Creation Flow

```text
Agent selects message
↓
Click Create Ticket
↓
System pre-fills client/project/channel/source message
↓
Agent enters title/description/priority
↓
Assign owner
↓
Ticket created
↓
Ticket link visible in message timeline
```

### 14.3 Basic First Response Timer

For v1, only track first response.

Start condition:

- Client-side live inbound message.
- Not backfill.
- Not internal.
- Channel mapped.

Stop condition:

- Dashboard agent reply.
- Physical phone reply classified as phone_user.

Do not build full SLA engine in v1.

> **NOTE (review — which clock):** The first-response timer is **channel-level**, because the triggering client message arrives before any ticket exists. The clock starts on the first eligible client-side live inbound message in a mapped channel with no pending agent response, and stops on the first agent/phone_user reply. A ticket created later **inherits** the channel's `first_response_at` if one already occurred within its source-message window; otherwise the ticket starts its own. Define this explicitly so `tickets.first_response_at` and the channel timer don't diverge.

---

## 15. Internal Notes and Safe Composer

### 15.1 External Reply Composer

External reply composer must be visually distinct.

Requirements:

- Clear label: “Reply to WhatsApp group.”
- Client/channel name visible.
- Optional 3-second send delay.
- Permissions enforced.

### 15.2 Internal Notes Composer

Internal notes must look clearly different from external reply.

Requirements:

- Clear label: “Internal note — not sent to WhatsApp.”
- Different background/color treatment.
- Notes visible only to authorized workspace users.

### 15.3 Preventing Accidental Leaks

v1:

- Visual separation.
- Send delay.
- Clear destination label.

Post-v1:

- Sensitive/internal language scanner.
- Approval workflow.
- Shared drafts.

---

## 16. Search

### 16.1 v1 Search

Use PostgreSQL full-text search.

Search entities:

- Messages.
- Tickets.
- Contacts.
- Clients.

Scope search by permissions.

### 16.2 Search Indexes

Suggested indexes:

```sql
CREATE INDEX idx_messages_workspace_channel_time
ON messages (workspace_id, channel_id, provider_timestamp DESC);

CREATE INDEX idx_messages_workspace_client_time
ON messages (workspace_id, client_id, provider_timestamp DESC);

CREATE INDEX idx_tickets_workspace_client_status
ON tickets (workspace_id, client_id, status);
```

For full text:

```text
tsvector column or generated search vector for message body and ticket text
```

### 16.3 Search Later

Add Meilisearch when:

- Fuzzy search becomes required.
- Message volume makes PostgreSQL FTS insufficient.
- Cross-entity search needs better ranking.

---

## 17. Retention and Purge

### 17.1 Raw Events

Default retention:

```text
7–14 days
```

Raw event payloads should be hard-purged from object storage after retention.

Metadata row can be retained longer or purged with payload.

### 17.2 Messages

Default retention:

```text
90–180 days configurable
```

### 17.3 Ticket-Linked Messages

If a message is linked to a ticket, do not destructively remove all metadata.

Soft purge approach:

- Preserve sender, timestamp, direction, channel, ticket link.
- Remove body/media/raw refs if policy requires.
- Replace body with:

```text
[Message contents purged by workspace retention policy]
```

### 17.4 Media

Media retention can be independent of message retention.

Default:

- Live media: configurable.
- Ticket-linked media: retain with ticket policy.
- Unlinked media: purge after configured window.

---

## 18. Delete-for-Everyone Events

If WhatsApp reports message deletion:

- Mark message as deleted on WhatsApp.
- Update UI status.
- Do not automatically delete internal copy if linked to ticket/audit.
- Respect workspace retention/privacy policy.

UI text:

```text
This message was deleted by the sender on WhatsApp.
```

Internal audit may still retain captured data subject to policy.

---

## 19. Queue Design

### 19.1 Queues

Use BullMQ queues:

```text
raw-event-upload
message-normalization
media-download-live
media-download-backfill
outbox-send
backfill
search-index
notification
web-push
audit-retention
```

### 19.2 Priorities

Highest:

- Live message normalization.
- Live media download.
- Outbox send.

Lower:

- Backfill.
- Search indexing.
- Summaries/analytics later.

### 19.3 Backpressure

If queue length exceeds threshold:

- Pause backfill jobs.
- Slow non-critical media downloads.
- Continue accepting live webhooks.
- Show degraded status to admins if needed.

---

## 20. Database Scaling

### 20.1 Initial Scaling

PostgreSQL on a well-sized single server can handle the first meaningful scale.

Use:

- Proper indexes.
- Object storage for blobs.
- Queue workers for async work.
- Pagination/cursors for message timelines.
- Avoid large JSON columns.

### 20.2 Message Partitioning

Once message volume grows, partition messages by month or quarter.

Recommended partition key:

```text
provider_timestamp month
```

Queries must always filter by:

```text
workspace_id
channel_id or client_id
provider_timestamp range
```

### 20.3 Cursor Pagination

Use cursor pagination for timelines:

```text
before_provider_timestamp
before_message_id
limit
```

Avoid offset pagination on large message tables.

---

## 21. Deployment Architecture

### 21.1 Local Development

Docker Compose:

```text
postgres
redis
minio
gateway
api
worker
web
```

### 21.2 Self-Hosted Production

Recommended minimum:

```text
1 API container
1 worker container
1 realtime container
1 scheduler container
1 PostgreSQL
1 Redis
1 MinIO or external S3
1 Evolution API
```

### 21.3 Managed Production

Scale horizontally:

```text
2+ API containers
2+ worker containers
2 realtime containers with Redis adapter
Managed PostgreSQL
Managed Redis
S3/R2/Wasabi
Gateway nodes per phone/session capacity
```

### 21.4 Gateway Isolation

Gateway nodes should be isolated from core app.

If a gateway crashes, core inbox/ticket system should remain available.

---

## 22. Observability

### 22.1 Logs

Use structured JSON logs via Pino.

Every log should include:

```text
workspace_id
phone_instance_id
channel_id when applicable
request_id
job_id
adapter_type
```

### 22.2 Metrics

Track:

- Webhook received count.
- Message normalization success/failure.
- Media download success/failure.
- Outbox send success/failure.
- Queue depth.
- Gateway status changes.
- Reconnect events.
- Duplicate event count.
- Stale sync suppressed count.

### 22.3 Tracing

Use OpenTelemetry later for:

```text
webhook → raw upload → normalize job → DB insert → realtime emit
```

---

## 23. Security

### 23.1 Auth

v1:

- Email/password or magic link.
- Session/JWT auth.
- Workspace membership enforcement.

Later:

- SSO/SAML.
- SCIM.
- MFA.

### 23.2 Tenant Isolation

Every table must include workspace_id unless truly global.

All APIs must enforce workspace membership.

All queries must filter by workspace_id and permission scope.

### 23.3 Object Storage Security

- Private buckets.
- Short-lived signed URLs.
- No public media links.
- Object keys should not expose sensitive names if possible.
- **Encryption at rest** (review gap): the verticals named in the FRS include HIMS/healthcare and education, which carry patient/student PII. v1 must enable server-side encryption (SSE) on the media + raw-event buckets and encryption-at-rest on PostgreSQL. A per-workspace key (envelope encryption) is a P2/P3 enhancement but the default-on SSE + DB-at-rest baseline is P1, not optional.

### 23.4 Gateway Secret Security

- Store gateway API keys encrypted.
- Do not expose gateway admin endpoints publicly.
- Proxy gateway actions through backend.
- Restrict gateway callback IPs/secrets where supported.

### 23.5 Audit Logs

v1 audit:

- Login.
- Phone connected/disconnected.
- Message sent.
- Internal note created.
- Ticket created/updated.
- Channel mapped/unmapped.
- Media downloaded by user where feasible.

---

## 24. Testing Strategy

### 24.1 Unit Tests

Focus on:

- Message classification.
- Backfill/stale detection.
- Permission filters.
- Policy engine.
- Adapter normalization.
- Deduplication.

### 24.2 Integration Tests

Use Testcontainers for:

- PostgreSQL.
- Redis.
- MinIO.

Test flows:

- Webhook ingestion.
- Media pipeline.
- Outbox send.
- Ticket creation.
- Access control.

### 24.3 Gateway Contract Tests

For each adapter:

- Normalize sample payloads.
- Send text contract.
- Send media contract.
- Download media contract.
- Group metadata event contract.

### 24.4 End-to-End Tests

Use Playwright for:

- Login.
- View group.
- Send delayed reply.
- Add internal note.
- Create ticket.
- Verify permission-scoped visibility.

### 24.5 Failure Tests

Must test:

- Duplicate webhook.
- Reconnect storm.
- Expired media.
- Backfill old message.
- Outbox failure and retry.
- Gateway disconnected.
- Agent without permission attempts access.

---

## 25. API Design

### 25.1 Style

Use REST APIs with OpenAPI docs.

GraphQL is not recommended for v1.

### 25.2 API Groups

```text
/auth
/workspaces
/users
/clients
/projects
/phones
/channels
/messages
/media
/tickets
/notes
/search
/admin
/gateway-webhooks
```

### 25.3 Webhook Endpoint

```text
POST /gateway-webhooks/:adapterType/:phoneInstanceId
```

Must:

- Authenticate gateway secret.
- Store raw event ref.
- Enqueue processing.
- Return quickly.

---

## 26. Frontend UX Architecture

The frontend is an operator console for customer WhatsApp group support. It should borrow proven CRM
interface patterns (activity tabs, side panels, saved views, notifications, responsive drawers)
without inheriting a generic sales CRM data model.

### 26.1 Main Layout

```text
Left Sidebar:
  Clients
  Channels
  Unmapped Groups
  Saved/Pinned Views
  Phone Health

Center:
  Message Timeline
  Backfill/Remap Markers
  Realtime Status
  Safe Composer

Right Panel:
  Ticket Context
  Channel Mapping
  Client/Project Context
  Participants/Contacts
  Internal Notes
  Audit/Event Snippets

Bottom:
  External Reply Composer
  Internal Note Composer
```

Desktop should use a resizable right panel. Mobile should use drawers or tabs so agents can move
between timeline, context, and composer without horizontal squeeze.

### 26.2 Timeline Rendering

Requirements:

- Virtualized list.
- Cursor pagination.
- Message grouping by date.
- Sender display based on channel membership.
- Media preview.
- Safe WhatsApp-style text formatting.
- Quoted reply preview and jump-to-original behavior.
- Reactions where gateway supports them.
- Ticket link badges.
- Backfill/history marker.
- Mapping/remapping marker.
- Deleted message marker.
- Ghost-agent / external-device attribution.
- Delivery status badges for outgoing messages.
- Failed-send badge with retry/cancel affordance where safe.
- System rows for ticket, mapping, assignment, phone, and audit events.

Message content is untrusted. Do not render raw gateway HTML. Use structured rendering or a
sanitizer after WhatsApp-style formatting is parsed.

### 26.3 Composer Safety

- External composer clearly labeled.
- Internal note clearly labeled.
- Client/channel name shown before send.
- Send delay state visible.
- Cancel send within delay.
- Reply/quote preview visible before send.
- Attachment type picker with clear media kind.
- Capability-gated send controls based on adapter + phone state.
- Route-unavailable explanation shown inline.
- Enter-to-send behavior must be discoverable and support Shift+Enter for newline if enabled.
- Internal-note mode must not share the same visual treatment as external reply mode.

The send button should dispatch to the API outbox only. It must not call gateway APIs directly.

### 26.4 Phone Health UI

Show:

```text
Connected
Syncing
Disconnected
QR required
Last seen
Last sync
Gateway type
Risk mode: Linked Device / Official API
```

When unhealthy, the UI should show an actionable diagnostic banner near the inbox, not only in
settings. Examples: gateway unreachable, QR required, syncing/backfill in progress, queue backlog,
media downloads failing, webhook secret mismatch, route unavailable.

### 26.5 Frontend Module Boundaries

Recommended modules:

```text
app shell
auth/session
clients/projects
channels/sidebar
channels/mapping
timeline/messages
timeline/media
composer/outbox
notes
tickets
contacts/participants
phone health
search
notifications/realtime
settings/admin
```

Each module should expose typed API clients and local UI components. Timeline/message rendering
should stay independent from ticket forms and channel mapping forms so it can be tested in isolation.

### 26.6 State and Realtime Data Flow

Use server state for authoritative data and lightweight client state for view preferences:

```text
REST fetch -> typed client -> query/cache layer -> components
Redis event bus -> Socket.io -> targeted invalidation/update
local storage -> collapsed sidebar, last active tab, view preference
```

Socket.io is the default realtime transport for bidirectional UI updates and
interactive surfaces such as inbox changes, ticket updates, notification toasts,
and presence/status changes. Use SSE only for simple one-way streaming needs
where a full websocket channel is unnecessary, such as progress feeds or
lightweight live logs.

Realtime events should include enough identifiers to update only the affected surface:

```text
workspace_id
channel_id
ticket_id when applicable
message_id/outbox_id when applicable
event_type
```

Do not reload the whole workspace when one channel receives a message.

### 26.6.1 Notifications And Web Push Architecture

Notification delivery should be modeled separately from generic realtime events.

```text
domain event
  -> notification_event
  -> recipient resolution
  -> permission/preference/quiet-hours policy
  -> notification_delivery rows
  -> in-app realtime fanout
  -> Web Push fanout where subscribed
```

Foreground path:

```text
Redis event bus -> Socket.io room -> UI notification center/query invalidation
```

Background path:

```text
notification worker -> Web Push service -> browser service worker -> notification
```

Recommended entities:

```text
notification_events
notification_deliveries
notification_preferences
notification_subscriptions
notification_action_tokens
notification_digests
```

Subscription data should be treated as sensitive device data:

```text
workspace_id
user_id
endpoint_hash
encrypted_endpoint
encrypted_p256dh
encrypted_auth
device_name
user_agent
platform
permission_state
last_seen_at
revoked_at
```

Push payloads should be privacy-minimized by default. Full message previews require
admin policy and user preference.

### 26.6.2 Notification Actions

Persistent web notifications may expose action buttons, but browser/platform support
varies. All actions must have a click-to-open fallback.

Safe default actions:

```text
reply -> open/focus channel and external composer
add_note -> open/focus channel and internal note composer
open_ticket -> open/focus ticket panel
mark_read -> mark notification read
mute_1h -> update user/channel notification preference
assign_to_me -> execute only with short-lived action token and permission check
```

External WhatsApp replies must not be sent directly from a web notification action
by default. They must pass through the normal composer, route checks, send delay,
sensitive-data checks, and audit path.

Notification action tokens must be short-lived, single-use, scoped to user/device/
event/action, and revalidated server-side.

### 26.7 Views and Filters

Core v1 can ship fixed views. Later releases should add saved/pinned views.

Suggested view evolution:

```text
P1: fixed channel/ticket filters
P2: saved views, pinned views, quick filters, configurable columns
P3: group-by/SLA/storm/asset-risk queues
P4: compliance, auditor, and portfolio dashboards
```

Kanban can be added for ticket operations later, but the primary inbox remains message/channel-first.

### 26.8 Reference Product Constraints

From Evo CRM/Frappe CRM, borrow:

```text
activity tabs
resizable detail panels
message media components
reply previews
notifications panel
saved/pinned views
empty states
onboarding checklist
capability-gated actions
```

Do not copy into Core v1:

```text
sales leads/deals/opportunities
campaign management
generic visual automation builder
field-layout builder
plugin marketplace
pipeline-first UX
```

Those may inform P2/P3/P4 roadmap items only after the core customer WhatsApp group
support loop is stable.

---

## 27. Official API Future Design

The core data model should allow official API conversations later.

Add fields:

```text
connection_mode: linked_device | official_api
message_pricing_category
template_name
official_conversation_id
cost_estimate
```

But do not force v1 to implement official API.

Official API is for:

- 1:1 compliant messaging.
- Templates.
- WhatsApp Flows.
- OTP/auth.
- Formal notifications.
- Opt-out compliant outbound messages.
- Delivery/cost/quality analytics.

Linked-device is for:

- Existing group operations.
- Community/self-hosted use.
- Low-volume support where customer accepts risk.

### 27.1 Official Management Data Model

Reserve model boundaries for:

```text
official_business_accounts
official_phone_numbers
official_templates
official_template_versions
official_flows
official_flow_versions
official_flow_submissions
official_opt_outs
official_conversations
official_message_statuses
official_usage_events
official_bot_workflows
official_industry_packs
```

Secrets and tokens must use the same encrypted-secret discipline as gateway sessions
and AI BYOK provider keys.

### 27.2 Official Management API Surface

Planned endpoints:

```text
GET    /api/official/wabas
POST   /api/official/embedded-signup/exchange
GET    /api/official/phone-numbers
GET    /api/official/templates
POST   /api/official/templates
PATCH  /api/official/templates/:id
POST   /api/official/messages
GET    /api/official/conversations
GET    /api/official/opt-outs
POST   /api/official/opt-outs
GET    /api/official/flows
POST   /api/official/flows
POST   /api/official/flows/data-exchange
GET    /api/official/usage
```

Official management endpoints should be resource-oriented and permission-scoped.
They should not leak Meta tokens, WABA credentials, webhook secrets, or Flow
encryption material to normal users.

### 27.3 Official Module Runtime Responsibilities

Runtime responsibilities:

- Meta webhook verification and event normalization.
- WABA/phone/template/Flow sync jobs.
- Template send validation.
- Opt-out detection and send blocking.
- Delivery/read/failure status persistence.
- Cost/category/usage aggregation where pricing is configured.
- Flow data-exchange handling with encryption/decryption.
- Bot workflow state transitions.
- Human handoff into ClarioDesk tickets/inbox when required.

---

## 28. AI Future Design

AI must be async, optional, BYOK-first, and designed as a native assistive layer
across the product.

Do not run AI in the core message path.

See `docs/ai/ai-native-byok-architecture.md` for the full product/backend AI
planning document and `docs/frontend/16-ai-native-ux.md` for frontend interaction
patterns.

Core message ingest, timeline fetch, ticket update, and outbound send must work
when AI is disabled, budget is exhausted, or the model provider is down.

### 28.1 AI Pipeline

```text
domain event
  -> ai_task queued
  -> policy/budget/provider check
  -> scoped context builder
  -> redaction
  -> provider adapter call
  -> schema validation
  -> store ai_suggestion
  -> audit event
  -> notify UI
```

AI must have:

- Workspace cost caps.
- Client isolation.
- Human approval default.
- Fallback to rules when disabled.

### 28.2 AI Modules

Recommended backend modules:

```text
ai-providers
ai-connections
ai-policies
ai-context
ai-jobs
ai-suggestions
ai-audit
ai-budget
ai-redaction
ai-embeddings
```

Core v1 does not need to implement these modules fully, but naming, RBAC, audit, and
database evolution should leave a clear path for them.

### 28.3 BYOK Provider Connections

AI provider keys are workspace-owned secrets.

Storage requirements:

- Encrypted at rest.
- Never returned by API.
- Never logged.
- Rotatable without changing feature policy.
- Deletable with clear disabled-feature consequences.
- Permission-gated separately from normal settings.

Provider connection fields:

```text
id
workspace_id
provider
display_name
encrypted_secret_ref
masked_fingerprint
base_url optional
status
last_tested_at
last_error_code
created_by
updated_by
created_at
updated_at
```

### 28.4 Provider Adapter Contract

The application should call providers through a normalized interface:

```text
generateText(request) -> AiProviderResult
classify(request) -> AiProviderResult
summarize(request) -> AiProviderResult
transcribe(request) -> AiProviderResult
embed(request) -> AiProviderResult
healthCheck(connection) -> ProviderHealth
```

Requests must include feature key, workspace id, context references, redaction
profile, timeout, and max token/cost guardrails. Provider responses are untrusted and
must be validated before storage or display.

### 28.5 AI Job Schema

```text
ai_tasks
  id
  workspace_id
  client_id nullable
  project_id nullable
  channel_id nullable
  ticket_id nullable
  message_id nullable
  feature_key
  provider_connection_id
  model
  status
  input_refs jsonb
  redaction_profile
  prompt_version
  created_by nullable
  triggered_by_event_id nullable
  tokens_input
  tokens_output
  estimated_cost
  latency_ms
  error_code
  created_at
  completed_at

ai_suggestions
  id
  workspace_id
  ai_task_id
  suggestion_type
  payload jsonb
  explanation text nullable
  confidence numeric nullable
  review_status
  reviewed_by nullable
  reviewed_at nullable
  applied_entity_type nullable
  applied_entity_id nullable
  created_at
```

### 28.6 Context Isolation

AI context builders must enforce:

- Workspace scope.
- Client/project scope.
- Channel/ticket scope.
- User permission scope.
- Retention policy.
- Data residency policy when available.

Embeddings and semantic search must store scope metadata and filter before ranking.
Post-filtering vector results is not sufficient for cross-client isolation.

### 28.7 Prompt-Injection Controls

WhatsApp messages and attachments are untrusted data.

Controls:

- Server-owned prompt templates.
- Prompt versioning.
- Structured-output schemas.
- Output validation before persistence.
- No provider-side ability to call outbound send APIs.
- Explicit human approval for external replies by default.
- Redaction of secrets and high-risk data before model calls where configured.

### 28.8 AI API Surface

Planned endpoints should be additive and resource-oriented:

```text
GET    /api/ai/provider-connections
POST   /api/ai/provider-connections
PATCH  /api/ai/provider-connections/:id
DELETE /api/ai/provider-connections/:id
POST   /api/ai/provider-connections/:id/test

GET    /api/ai/policies
PATCH  /api/ai/policies/:featureKey

POST   /api/ai/tasks
GET    /api/ai/tasks/:id
GET    /api/ai/suggestions
PATCH  /api/ai/suggestions/:id/review
GET    /api/ai/audit
```

Provider key fields must be write-only. API responses may include masked fingerprint
and health status, never raw secrets.

---

## 29. MVP Technical Scope

### 29.1 Engineering v1 Scope

Must build:

- Evolution API adapter.
- Phone connection/status.
- Group sync.
- Shared inbox.
- Send text reply with send delay.
- Internal notes.
- Client/project mapping.
- Backfill boundary.
- Basic media download/storage.
- Ticket creation/assignment/status.
- Basic first-response timer.
- Admin/Agent/Viewer roles.
- Permission-scoped sidebar/search/API.
- Raw event object storage.
- Audit basics.

### 29.2 Explicitly Out of Scope for v1

- AI.
- Full automation engine.
- Official Meta API.
- Advanced RBAC.
- Virtual threading.
- Shared draft collaboration.
- Incident mode.
- Advanced asset governance.
- Multi-gateway support.
- Plugin system.
- Advanced analytics.

---

## 30. Recommended Build Sequence

### Week 1–2: Foundation

- Monorepo setup.
- Docker Compose.
- PostgreSQL/Redis/MinIO.
- Auth.
- Workspace/users.
- Clario Gateway production hardening.

### Week 3–4: Ingestion

- Gateway webhook endpoint.
- Raw event object storage.
- Message normalization.
- Channel/group sync.
- Basic message timeline.

### Week 5–6: Inbox

- Realtime events.
- Send text reply through outbox.
- Send delay.
- Internal notes.
- Phone health UI.

### Week 7–8: Mapping and Permissions

- Client/project creation.
- Channel mapping.
- Unmapped groups.
- Backfill boundary.
- Admin/Agent/Viewer permissions.

### Week 9–10: Tickets

- Create ticket from message.
- Assign owner.
- Open/Pending/Closed.
- Ticket side panel.
- Basic first-response timer.

### Week 11–12: Reliability and Polish

- Media storage.
- Deduplication hardening.
- Reconnect/stale sync handling.
- Audit logs.
- Search.
- E2E testing.
- Demo deployment.

---

## 31. Major Risks and Mitigations

### 31.1 Linked-Device Risk

Risk:

- Gateway disconnects.
- Number restrictions.
- Protocol changes.

Mitigation:

- Clear UI risk labeling.
- Gateway health monitoring.
- Exportable data.
- Adapter abstraction.
- Official API adapter later.

> **NOTE (review — ToS, not just uptime):** Linked-device gateways (whatsapp-web.js / Baileys, used by Evolution/WAHA/OpenWA) are unofficial and technically violate WhatsApp's Terms of Service — the risk is *account termination by policy*, not only disconnects or rate-limits. For an open-source/self-hosted project this must be stated honestly in docs and in the phone-connection UI so self-hosters understand the legal nature of the risk and choose linked-device vs official API knowingly.

### 31.2 Scope Creep

Risk:

- Building the full vision before shipping.

Mitigation:

- v1 scope freeze.
- AI/automation/advanced features explicitly out of scope.
- Ship core loop first.

### 31.3 Data Leakage

Risk:

- Agent sees/sends wrong client data.

Mitigation:

- Permission-scoped backend queries.
- Strong composer labels.
- Assigned-channel visibility only.
- Audit logs.

### 31.4 Storage Growth

Risk:

- DB grows rapidly due to raw payload/media.

Mitigation:

- Object storage for blobs.
- Retention policies.
- Message pagination.
- Partitioning later.

### 31.5 Gateway Differences

Risk:

- Adapter abstraction leaks.

Mitigation:

- Capability detection.
- Adapter contract tests.
- Start with one gateway.
- Add adapters only after core stabilizes.

---

## 32. Final Technical Recommendation

Build the platform as:

```text
A self-hostable modular monolith with:
- Next.js frontend
- NestJS/Fastify backend
- PostgreSQL source of truth
- Redis/BullMQ async jobs
- S3/MinIO object storage
- Socket.io realtime
- Evolution API first gateway adapter
```

Do not overengineer with Kafka, microservices, Kubernetes-first deployment, or AI-first flows.

The first useful release should prove one core workflow:

```text
Connect WhatsApp number
→ sync groups
→ map group to client/project
→ view messages in shared inbox
→ safely reply or add internal note
→ create ticket from message
→ assign owner
→ track basic response
```

This architecture is robust enough to scale, simple enough to self-host, and flexible enough to evolve into the full long-term product.

---

## Appendix A: Priority Legend

Priority definitions are owned by the FRS (overlay table + Appendix P). This TDD uses that **single canonical 5-level scheme** — do not reintroduce a separate 4-level scheme here:

```text
P0 - Non-negotiable safety / data integrity (before any pilot)
P1 - Core v1 usable product
P2 - Operational v1.5 / v2
P3 - Advanced product differentiators
P4 - Enterprise / long-term vision
```

The appendices below (B–E) group technical requirements into **delivery waves**, not priority letters. The mapping is:

```text
Wave 1 (First Usable Release) = FRS P0 + P1
Wave 2 (v1.5)                 = FRS P2
Wave 3 (Differentiators)      = FRS P3
Wave 4 (Enterprise)           = FRS P4
```

---

## Appendix B: Wave 1 Technical Requirements (First Usable Release — FRS P0 + P1)

Wave 1 must include:

```text
PostgreSQL schema
Redis/BullMQ queues
MinIO/S3 storage
Evolution adapter
Webhook ingestion
Raw event refs
Message normalization
Deduplication
Group/channel sync
Client mapping
Shared inbox
External reply
Internal note
Outbox send delay
Basic media storage
Ticket from message
Basic assignment/status
Admin/Agent/Viewer
Permission-scoped APIs
Audit basics
Docker Compose deployment
```

---

## Appendix C: Wave 2 Technical Requirements (v1.5 — FRS P2)

Wave 2 should include:

```text
WAHA adapter
Better media vault UI
Basic SLA policies
Handover notes
Pinned context
Simple auto-ack with cooldown
Better search
Coverage access
Retention jobs
```

---

## Appendix D: Wave 3 Technical Requirements (Differentiators — FRS P3)

Wave 3 should include:

```text
Official Meta Cloud API adapter
Route policy engine
Cost tracking
AI async suggestions
Voice transcription
Virtual threading
Incident mode
Advanced analytics
Cross-client asset guardrails
```

---

## Appendix E: Wave 4 Technical Requirements (Enterprise — FRS P4)

Wave 4 should include:

```text
Plugin SDK
SSO/SAML
Advanced RBAC
Break-glass access
Enterprise compliance reports
Official WhatsApp Management module
Embedded Signup / WABA onboarding
Template lifecycle governance
WhatsApp Flows management
Opt-out compliance engine
Official cost/delivery/tier dashboards
Multi-gateway resilience
Industry templates
Managed cloud control plane
Mobile app
```

---

## Appendix F: Glossary

| Term | Meaning |
|---|---|
| Workspace | Company/customer using the platform |
| Client | External customer/account managed by workspace |
| Project | Sub-unit under client |
| Channel | WhatsApp group or direct chat |
| Phone Instance | Connected WhatsApp number/session |
| Gateway Adapter | Integration layer for Evolution/WAHA/OpenWA/Meta |
| Backfill | Historical import of old WhatsApp messages |
| Live Event | Message eligible for operations/SLA/notifications |
| Outbox | Internal outbound message queue before gateway send |
| Ghost Agent | Human replying directly from phone outside dashboard |
| Send Delay | Holding message briefly before dispatch so user can cancel |

---

## Appendix G: Open Questions

1. Should v1 support only one phone per workspace or multiple phones from day one?
2. Should media download be mandatory for all workspaces or configurable?
3. Should mixed groups be enabled by default or admin-only?
4. Should self-hosted OSS include all P0 features free under AGPL?
5. Should managed cloud be offered early or only after v1 stabilizes?
6. Which gateway should be first production target: Evolution API or WAHA?
7. Should official Meta Cloud API be v2 or parallel enterprise track?

> **NOTE (review — recommended resolutions):**
> 1. **Schema multi-phone from day one; UI exposes one in Core v1.** `phone_instances` already supports many; retrofitting a single-phone assumption later is painful, exposing one keeps v1 simple.
> 2. **Live media download is mandatory** (URLs expire — data-integrity P0). Only *backfill* media download is configurable/best-effort (matches §9.2).
> 3. **Mixed groups admin-only**, automation + SLA off by default (matches FRS §P.5.1).
> 6. **Evolution API first** (broadest event support per §7.3); WAHA second, as the adapter that proves the abstraction.
> 7. **Official Meta Cloud API is v2, not a parallel track** — a parallel enterprise track splits focus before the core group-inbox loop is proven.
>
> Items 4 and 5 are licensing/go-to-market decisions outside this TDD's scope and are left for product/business sign-off.

---

## Appendix H: Reference Product Technical Backlog

This appendix captures technical ideas from Evo CRM Community and Frappe CRM. These are references,
not dependencies. ClarioDesk should adopt the patterns only where they improve customer WhatsApp
group support operations, safety, or operator efficiency.

### H.1 Frontend Shell and Navigation

Borrow across the roadmap:

```text
collapsible app sidebar
responsive mobile shell
global notifications panel
settings drawer/pages
saved and pinned views
last active tab/view persistence
onboarding checklist
empty states for setup gaps
```

Technical notes:

- Persist per-user UI preferences separately from core operational data.
- Keep route names stable for deep links to channels, tickets, media, and audit events.
- Use permission-scoped navigation; do not render links to inaccessible clients/channels.

### H.2 Message and Activity Components

Build message rendering as a component family:

```text
MessageText
MessageImage
MessageVideo
MessageAudio
MessageDocument
MessageReaction
MessageLocation
MessageSystem
MessageDeleted
MessageReplyPreview
MessageStatus
TimelineMarker
```

Technical notes:

- Message components consume normalized ClarioDesk message shapes, never raw gateway payloads.
- Media components request signed URLs only after permission checks.
- WhatsApp-style formatting must be parsed/sanitized through a dedicated utility.
- System/timeline rows should come from first-class domain events where possible.

### H.3 Composer and Outbox Components

Composer modules should be explicit:

```text
ExternalReplyComposer
InternalNoteComposer
ReplyPreview
AttachmentPicker
SendDelayCountdown
RouteStatusBanner
TemplatePicker
QuickReplyPicker
```

Technical notes:

- External reply and internal note composers must use separate state machines.
- The external composer writes only to `/outbox`; the note composer writes only to `/notes`.
- Quoted replies must validate message access server-side.
- Adapter capabilities should control visible composer actions.

### H.4 Activity and Context Panel Evolution

The right panel can evolve by phase:

```text
P1:
  channel mapping
  client/project context
  basic ticket create/update
  participants
  internal notes

P2:
  handover notes
  pinned context
  SLA/reverse-SLA state
  saved views and quick filters
  storage/media health

P3:
  virtual threads
  draft approvals
  AI summaries
  storm bundles
  asset-risk warnings

P4:
  compliance review
  break-glass/auditor context
  official-template governance
  enterprise policy packs
```

Technical notes:

- Keep each panel section independently fetchable and independently testable.
- Avoid one large "context" API response that grows without boundaries.
- Use stable event identifiers so notifications can deep-link into the correct panel/tab.

### H.5 Views, Lists, and Kanban

Borrow list infrastructure, not sales semantics:

```text
list view
quick filters
column chooser
bulk selection
saved views
pinned views
group-by view
kanban for tickets only
```

Technical notes:

- Core v1 can hard-code operational views.
- P2 can add saved views backed by a `user_views` or `workspace_views` table.
- P3/P4 can add dashboards and compliance views.
- Bulk actions must pass through policy checks; never bulk-send directly from the UI.

### H.6 Admin and Diagnostics

Reference CRMs often hide integration health in settings. ClarioDesk should show diagnostics in both
settings and the active work surface.

Diagnostics should cover:

```text
phone disconnected
QR required
syncing/backfill active
webhook failing
queue backlog
media download failures
gateway route unavailable
adapter capability missing
official template not approved
storage health warnings
```

Technical notes:

- Expose a small health/read-model API for UI diagnostics.
- Emit realtime events when phone/gateway status changes.
- Track queue depth and recent job failures once BullMQ metrics are added.

### H.7 Customization and Extension Roadmap

Do not build a generic CRM builder in Core v1. Layer customization deliberately:

```text
P2:
  saved views
  quick replies
  workspace defaults
  simple client/project custom fields

P3:
  configurable ticket fields
  configurable context panel sections
  industry templates
  dashboard widgets

P4:
  plugin SDK
  marketplace
  advanced layout builder
  enterprise policy packs
  managed-cloud control plane
```

Technical notes:

- Keep custom fields out of the hot message-ingestion path.
- Plugin/customization APIs must never bypass workspace isolation, audit, send policy, or media permissions.
- Industry templates should configure defaults; they should not fork the data model.

---

End of document.

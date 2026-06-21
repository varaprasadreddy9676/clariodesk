# Clariodesk API Reference (Core v1)

REST API for the Clariodesk backend. All examples below were captured from a live
run of the stack (see the "Live walkthrough" responses in each section).

- **Base URL:** `http://localhost:4000/api` (global prefix `/api`)
- **Content type:** `application/json`
- **Realtime:** Socket.io on `:4001` (see [Realtime](#realtime))

---

## Authentication & authorization

Two independent auth mechanisms:

| Caller | Mechanism | Header |
|---|---|---|
| Users (agents/admins) | JWT bearer | `Authorization: Bearer <token>` |
| WhatsApp gateway | Shared secret | `x-webhook-secret: <GATEWAY_WEBHOOK_SECRET>` |

Get a token from `POST /auth/login` or `POST /auth/register`. The JWT encodes
`{ userId, workspaceId, role }`; every request is scoped to that workspace.

**Roles:** `admin`, `agent`, `viewer`.
- **admin** — full workspace access; only role that can create clients/projects/phones/users and map channels.
- **agent** — read/write only within **assigned** clients/channels.
- **viewer** — read-only within assigned clients/channels (cannot send replies, create/modify tickets).

### Permission scoping (enforced server-side)

> **No assignment = no visibility.** A non-admin only sees channels belonging to
> clients they are assigned to (`/team/assign-client`) plus directly assigned
> channels (`/team/assign-channel`). This is enforced at query time in every
> list/get/search/timeline endpoint — never just hidden in the UI. Unauthorized
> resources return `403`, and never appear in lists or search results.

---

## Conventions

### Errors

```jsonc
// 401 — invalid credentials
{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }

// 400 — Zod validation failure (body/query)
{
  "message": "Validation failed",
  "issues": [
    { "path": "email", "message": "Invalid email" },
    { "path": "password", "message": "Required" }
  ]
}
```

Common statuses: `400` validation, `401` unauthenticated / bad credentials,
`403` authenticated but not permitted, `404` not found, `409` conflict
(duplicate email), `500` upstream/gateway error.

### Cursor pagination

Timeline endpoints return `{ items, nextCursor }`. Pass the cursor back to page:

```
GET /channels/:id/messages?limit=50&beforeProviderTimestampMs=1781239900000
```

`nextCursor` is `null` when there are no more rows.

---

## Auth

### `POST /auth/register`
Bootstrap a brand-new workspace and its first admin. Public (no auth).

```jsonc
// request
{
  "workspaceName": "Walkthrough Co",
  "workspaceSlug": "walkthrough",        // [a-z0-9-]{2,60}
  "email": "owner@walkthrough.test",
  "password": "ownerpass1",               // min 8
  "displayName": "Owner"
}
// 201
{
  "token": "eyJhbGciOi...",
  "userId": "eaff586b-...",
  "workspaceId": "496e38f8-...",
  "role": "admin"
}
```

### `POST /auth/login`
Public. Returns a token for the user's active workspace membership.

```jsonc
// request
{ "email": "admin@demo.test", "password": "demo-password" }
// 200
{ "token": "eyJhbGciOi...", "userId": "263a42f2-...", "workspaceId": "5f5be38c-...", "role": "admin" }
```

> Note: the password field is validated (`min 8`) before credentials are checked,
> so a too-short password returns `400`, while a wrong-but-valid-length password
> returns `401 Invalid credentials`.

---

## Health

### `GET /health`
Public liveness probe.

```jsonc
{ "status": "ok", "ts": "2026-06-12T14:50:09.965Z" }
```

### `GET /ops/summary`  (admin)
Compact operational read model for pilot dashboards and admin triage.

```jsonc
{
  "generatedAt": "2026-06-13T08:10:00.000Z",
  "phones": {
    "byStatus": { "connected": 1, "degraded": 1 },
    "items": [ { "id": "...", "displayName": "Support Phone", "status": "connected", "riskLevel": "normal" } ]
  },
  "channels": { "unmapped": 3, "awaitingResponse": 5 },
  "tickets": { "byStatus": { "open": 8, "pending": 4 }, "open": 8, "pending": 4 },
  "outbox": {
    "byStatus": { "waiting_delay": 2, "failed": 1 },
    "recentFailures": [ { "id": "...", "channelId": "...", "failureReason": "Gateway unavailable" } ]
  },
  "registry": { "pendingMetadataEvents": 2 },
  "queues": {
    "messageNormalization": { "waiting": 0, "delayed": 0, "active": 0, "failed": 0, "paused": 0 },
    "mediaDownloadLive": { "waiting": 0, "delayed": 0, "active": 0, "failed": 0, "paused": 0 },
    "mediaDownloadBackfill": { "waiting": 0, "delayed": 0, "active": 0, "failed": 0, "paused": 0 },
    "outboxSend": { "waiting": 0, "delayed": 0, "active": 0, "failed": 0, "paused": 0 }
  }
}
```

---

## Clients & Projects

### `GET /clients`  (auth)
Lists clients visible to the caller (permission-scoped).

```jsonc
[ { "id": "11b991c3-...", "name": "Acme Hospital", "status": "active" } ]
```

### `POST /clients`  (admin)
```jsonc
// request
{ "name": "Globex Ltd" }
// 201
{ "id": "9c0e2815-...", "name": "Globex Ltd" }
```

### `DELETE /clients/:id`  (admin)
Archives the client. → `{ "ok": true }`

### `GET /clients/:id/projects`  (auth, client-scoped)
```jsonc
[ { "id": "b5d1fa5d-...", "name": "Onboarding", "status": "active" } ]
```

### `POST /projects`  (admin)
```jsonc
// request
{ "clientId": "9c0e2815-...", "name": "Onboarding" }
// 201
{ "id": "b5d1fa5d-...", "name": "Onboarding" }
```

---

## Phones (WhatsApp connections)

### `GET /phones`  (auth)
```jsonc
[ {
  "id": "315d4f29-...",
  "displayName": "Support Line",
  "adapterType": "clario_gateway",
  "connectionMode": "linked_device",
  "status": "qr_required",            // connected|syncing|disconnected|qr_required|degraded|restricted|archived
  "riskLevel": "normal",
  "lastSeenAt": null,
  "lastSyncAt": null
} ]
```

### `POST /phones`  (admin)
```jsonc
// request
{
  "adapterType": "clario_gateway",
  "displayName": "Support Line",
  "providerInstanceId": "clario-support",
  "gatewayBaseUrl": "http://localhost:2786",
  "phoneNumber": "+15551234567" // optional
}
// 201
{ "id": "eb3c1b40-..." }
```

### `POST /phones/:id/connect`  (admin)
Proxies to the gateway and returns a QR to scan in WhatsApp. Requires a running
Clario Gateway; returns `500` if the gateway is unreachable.

```jsonc
{ "qr": "data:image/png;base64,iVBORw0KG..." }   // or { "qr": null }
```

### `GET /phones/:id/status`  (auth)
Refreshes + persists live connection status from the gateway. → `{ "status": "connected" }`

### `POST /phones/:id/sync-groups`  (admin)
Fetches groups from the connected linked-device gateway and upserts them into
the Channel Registry. New groups are created as `unmapped`; existing groups keep
their current mapping/status while title/subject metadata is refreshed.

```jsonc
// 200
{ "total": 42, "created": 3, "updated": 39 }
```

### `POST /phones/:id/disconnect`  (admin)
Logs the linked device out. → `{ "ok": true }`

---

## Gateway webhooks (ingestion)

### `POST /gateway-webhooks/:adapterType/:phoneInstanceId`
Called by the WhatsApp gateway, **not** by users. Auth via `x-webhook-secret`.
Persists the raw payload, enqueues normalization, and returns fast. `adapterType`
is `clario_gateway` for Core v1.

```jsonc
// headers: x-webhook-secret: <GATEWAY_WEBHOOK_SECRET>
// body (Clario Gateway message.received)
{
  "event": "message.received",
  "sessionId": "clario-support",
  "message": {
    "id": "WT-100",
    "chatId": "100@g.us",
    "senderId": "919800000001@c.us",
    "body": "Our dashboard is showing a 500 error",
    "type": "chat",
    "timestamp": 1781239858,
    "fromMe": false,
    "hasMedia": false
  }
}
// 201
{ "accepted": 1 }     // number of normalized events enqueued
```

Wrong/missing secret → `401`. The worker then normalizes the event, applying the
backfill/live safety rules, and (for live messages) emits a `message.received`
realtime event.

---

## Channels

### `GET /channels`  (auth)
Permission-scoped list. Channels are auto-created (status `unmapped`) the first
time a message arrives for them.

```jsonc
[ {
  "id": "36f4ab1d-...",
  "title": null,
  "channelType": "group",            // group|direct|official_direct
  "status": "unmapped",              // unmapped|active|archived|muted
  "lastMessageAt": "2026-06-12T14:50:58.000Z",
  "awaitingResponseSince": null,      // first-response clock start, if waiting
  "lastAgentReplyAt": null            // latest dashboard/phone-user response
} ]
```

### `POST /channels/map`  (admin)
Maps a channel to a client/project and sets the **mapping boundary**. Messages
before `mappingEffectiveAt` are historical context; after are live operations.
Supersedes any existing active mapping (safe for repurposed groups).

```jsonc
// request
{ "channelId": "36f4ab1d-...", "clientId": "11b991c3-...", "projectId": null, "mappingMode": "single_client" }
//   mappingMode: single_client | mixed | unmapped | archived
//   single_client REQUIRES clientId; mixed groups require per-ticket client selection
// 200
{ "ok": true, "mappingEffectiveAt": "2026-06-12T14:51:00.694Z" }
```

### `GET /channels/metadata-events?status=pending`  (admin)
Channel Registry review queue for group renames, description changes, and
participant changes detected from the gateway.

```jsonc
[ {
  "id": "d9df2f7e-...",
  "channelId": "36f4ab1d-...",
  "eventType": "subject_changed",
  "oldValue": "Old Support",
  "newValue": "Production Escalations",
  "providerTimestamp": "2026-06-12T14:51:31.000Z",
  "reviewStatus": "pending"
} ]
```

### `POST /channels/metadata-events/:id/review`  (admin)
Mark a Channel Registry metadata event as reviewed or ignored.

```jsonc
// request
{ "resolution": "reviewed" }   // reviewed|ignored
// 200
{ "ok": true }
```

### `GET /channels/:channelId/messages`  (auth, channel-scoped)
Cursor-paginated timeline, newest first.

```jsonc
{
  "messages": [
    {
      "id": "2282fc75-...",
      "body": "Still down, this is urgent please",
      "messageType": "text",
      "direction": "inbound",            // inbound|outbound
      "sentByType": "client_user",       // client_user|dashboard_agent|phone_user|automation|ai|system|unknown
      "providerTimestamp": "2026-06-12T14:51:31.000Z",
      "isBackfill": false,
      "status": "received"             // received|sent|delivered|read|failed|deleted_on_whatsapp|purged
    }
  ],
  "nextCursor": null
}
```

### `GET /channels/:channelId/members`  (auth, channel-scoped)
Channel membership with per-channel display alias + role.

```jsonc
[ {
  "contactId": "...", "canonicalName": "Meera",
  "displayNameInChannel": "Meera (Acme)", "roleInChannel": "client",
  "isVerified": true, "isInternalOverride": null, "lastSeenAt": "..."
} ]
```

---

## Messages / Notes

### `POST /notes`  (agent/admin, channel-scoped)
Internal note — **never sent to WhatsApp**. Optionally linked to a ticket.

```jsonc
// request
{ "channelId": "36f4ab1d-...", "ticketId": "12ce8fed-...", "body": "DB pool exhausted. Escalating to infra." }
// 201
{ "id": "0aaf4490-..." }
```

---

## Tickets

### `GET /tickets`  (auth)
Permission-scoped list, newest first.

```jsonc
[ {
  "id": "12ce8fed-...", "title": "Dashboard 500 error",
  "status": "open",            // open|pending|closed
  "priority": "high",          // low|normal|high|urgent
  "channelId": "36f4ab1d-...", "clientId": "11b991c3-...",
  "assignedUserId": null,
  "firstResponseAt": null,
  "createdAt": "2026-06-12T14:51:24.164Z"
} ]
```

### `GET /tickets/:id`  (auth, channel-scoped)
Full ticket record (includes description, sourceMessageId, createdBy,
firstResponseAt, closedAt, timestamps).

### `POST /tickets`  (agent/admin, channel-scoped)
Create from a message. For `single_client` channels the client/project are
inherited from the mapping; for `mixed` channels `clientId` is required.
If the source message was already answered at channel level, the ticket inherits
`firstResponseAt`.

```jsonc
// request
{
  "channelId": "36f4ab1d-...",
  "sourceMessageId": "2282fc75-...",
  "title": "Dashboard 500 error",
  "description": "Client reports dashboard down since morning",
  "priority": "high",
  "assignedUserId": null            // optional
}
// 201
{ "id": "12ce8fed-..." }
```

### `PATCH /tickets/:id`  (agent/admin, channel-scoped)
Partial update — any of `status`, `priority`, `assignedUserId`, `title`,
`description`. Setting `status: "closed"` stamps `closedAt`.

```jsonc
// request
{ "status": "pending", "priority": "urgent" }
// 200
{ "ok": true }
```

---

## Outbox (sending replies)

### `POST /outbox`  (agent/admin, channel-scoped)
Queues an outbound reply through the outbox. With `useSendDelay`, the message is
held for `SEND_DELAY_MS` (default 3s) before dispatch so it can be cancelled —
this is a **send delay, not a true undo**. Blocked on unmapped channels.

```jsonc
// request
{ "channelId": "36f4ab1d-...", "body": "We are on it, will update shortly.", "useSendDelay": true }
// 201
{ "outboxId": "735d5843-...", "sendAfter": "2026-06-12T14:51:27.244Z", "cancellableForMs": 3000 }
```

### `POST /outbox/:id/cancel`  (agent/admin, channel-scoped)
Cancels while still within the send-delay window (status `pending`/`waiting_delay`).

```jsonc
{ "ok": true }
```

Viewers receive `403`. Unmapped channel → `400`.

---

## Contacts

### `GET /contacts`  (admin)
All workspace contacts.

```jsonc
[ { "id": "...", "primaryPhone": "919800000001", "canonicalName": "Meera", "isInternalGlobal": false } ]
```

---

## Media

### `GET /media/:id/url`  (auth, channel-scoped)
Issues a short-lived (300s) signed download URL **after** verifying channel
access. Media must be downloaded (`storageStatus = downloaded`).

```jsonc
// 200
{ "url": "http://minio:9000/clariodesk-media/...?X-Amz-...", "fileName": "error.png", "mimeType": "image/png", "expiresInSeconds": 300 }
// 400 if not yet available
{ "statusCode": 400, "message": "Media is not available (status: pending)" }
```

---

## Search

### `GET /search?q=<query>`  (auth)
Permission-scoped Postgres full-text search across messages + tickets. Results
from channels the caller cannot access never appear.

```jsonc
// GET /search?q=dashboard
{
  "messages": [
    { "id": "3176b23f-...", "channelId": "36f4ab1d-...", "body": "Our dashboard is showing a 500 error", "providerTimestamp": "2026-06-12T14:50:58.000Z" }
  ],
  "tickets": [
    { "id": "12ce8fed-...", "channelId": "36f4ab1d-...", "title": "Dashboard 500 error", "status": "pending" }
  ]
}
```

---

## Team & access control

### `GET /team/members`  (admin)
```jsonc
[ { "userId": "263a42f2-...", "email": "admin@demo.test", "displayName": "Demo Admin", "role": "admin", "status": "active" } ]
```

### `POST /team/users`  (admin)
Create a user and add them to the workspace with a role.
```jsonc
// request
{ "email": "sara@demo.test", "password": "sarapass1", "displayName": "Sara Agent", "role": "agent" }
// 201
{ "userId": "b758cc5d-..." }
```

### `POST /team/assign-client`  (admin)
Grant a user access to a client (and all its channels). Idempotent (upsert).
```jsonc
// request
{ "userId": "b758cc5d-...", "clientId": "9c0e2815-...", "accessLevel": "agent" }   // accessLevel: agent|viewer
// 200
{ "ok": true }
```

### `POST /team/assign-channel`  (admin)
Grant a user access to a single channel.
```jsonc
// request
{ "userId": "b758cc5d-...", "channelId": "36f4ab1d-...", "accessLevel": "agent" }
// 200
{ "ok": true }
```

---

## Realtime

Connect to the Socket.io server on `:4001` using the same JWT:

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:4001", { auth: { token: "<jwt>" } });

socket.on("message.received", (e) => { /* { type, workspaceId, channelId, payload } */ });
socket.on("ticket.created", (e) => {});
socket.on("ticket.updated", (e) => {});
socket.on("note.created", (e) => {});
socket.on("outbox.status_changed", (e) => {});
```

On connect, the socket is joined only to rooms it is permitted to see
(`channel:{id}` for assigned channels, or an `admin:{ws}` room for admins).
**Events are relayed only to permitted rooms** — a socket never receives events
for channels it cannot access.

Example event payload (emitted when a live message is stored):

```jsonc
{
  "type": "message.received",
  "workspaceId": "5f5be38c-...",
  "channelId": "36f4ab1d-...",
  "payload": { "messageId": "5c3c1dda-...", "isBackfill": false }
}
```

---

## Audit trail

Every sensitive action is written to an append-only `audit_logs` table. There is
no list endpoint in Core v1; query the table directly. Captured actions include:

```
client.created · phone.created · channel.mapped · ticket.created · ticket.updated
note.created · message.queued · message.cancelled · media.downloaded
user.created · access.client_assigned · access.channel_assigned
```

---

## Endpoint summary

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | public | liveness |
| GET | `/ops/summary` | admin | operational summary |
| POST | `/auth/register` | public | create workspace + admin |
| POST | `/auth/login` | public | get JWT |
| GET | `/clients` | auth | list (scoped) |
| POST | `/clients` | admin | create |
| DELETE | `/clients/:id` | admin | archive |
| GET | `/clients/:id/projects` | auth | list projects |
| POST | `/projects` | admin | create project |
| GET | `/phones` | auth | list |
| POST | `/phones` | admin | create |
| POST | `/phones/:id/connect` | admin | QR connect |
| GET | `/phones/:id/status` | auth | refresh status |
| POST | `/phones/:id/sync-groups` | admin | fetch/upsert WhatsApp groups |
| POST | `/phones/:id/disconnect` | admin | logout |
| POST | `/gateway-webhooks/:adapter/:phoneId` | secret | ingest |
| GET | `/channels` | auth | list (scoped) |
| POST | `/channels/map` | admin | map + boundary |
| GET | `/channels/metadata-events` | admin | registry review queue |
| POST | `/channels/metadata-events/:id/review` | admin | resolve metadata review |
| GET | `/channels/:id/messages` | auth | timeline |
| GET | `/channels/:id/members` | auth | members |
| POST | `/notes` | agent+ | internal note |
| GET | `/tickets` | auth | list (scoped) |
| GET | `/tickets/:id` | auth | get |
| POST | `/tickets` | agent+ | create from message |
| PATCH | `/tickets/:id` | agent+ | update |
| POST | `/outbox` | agent+ | send reply (delay) |
| POST | `/outbox/:id/cancel` | agent+ | cancel in window |
| GET | `/contacts` | admin | list contacts |
| GET | `/media/:id/url` | auth | signed download URL |
| GET | `/search?q=` | auth | FTS (scoped) |
| GET | `/team/members` | admin | list members |
| POST | `/team/users` | admin | create user |
| POST | `/team/assign-client` | admin | grant client access |
| POST | `/team/assign-channel` | admin | grant channel access |

---

## Known Core-v1 gaps (not bugs)

- Full group-member sync is not implemented yet. Inbound message senders create
  contacts/memberships, but silent group participants are not discovered until
  they message or a dedicated member-sync flow is added.
- No OpenAPI/Swagger surface yet (planned).
- Audit log has no read endpoint (query the table).
- `/phones/:id/connect`, `/status`, `/sync-groups`, and `/channels/:id/sync-messages`
  require a running Clario Gateway.

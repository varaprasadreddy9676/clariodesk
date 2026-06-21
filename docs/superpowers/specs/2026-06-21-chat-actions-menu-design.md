# Chat Actions Menu Design

## Objective

Expand the chat-row context menu with a compact set of fully functional operational actions. Provider-visible actions synchronize through Clario Gateway so ClarioDesk and the linked WhatsApp account do not silently drift.

## Menu Structure

The menu contains only working actions, ordered by frequency and risk:

1. **Open chat**
2. **Refresh**
3. **Mark as unread**
4. **Pin chat** or **Unpin chat**
5. **Mute chat** or **Unmute chat**
6. separator
7. **Archive chat** or **Unarchive chat**
8. separator
9. **Copy title**
10. **Copy WhatsApp ID**
11. **Copy ClarioDesk ID**

The menu uses the existing compact context-menu visual language, Lucide icons, keyboard navigation, Escape/outside-click dismissal, and viewport-safe positioning. It contains no disabled future actions. Open chat is intentionally retained even though normal row click already opens the conversation; right-click users expect the command and can use it without first changing selection.

## Behavior

### Refresh

Refresh calls `POST /api/channels/:channelId/refresh`. The API verifies channel access, fetches current provider metadata and the latest 50 messages for only that provider chat, imports them through the existing normalization path, and returns `{ acceptedMessages, metadataChanged }`. It does not trigger a full-phone sync or replace the entire inbox with a loading state. Admins, agents, and viewers with channel access may refresh.

### Mark as unread

Mark as unread updates the linked WhatsApp chat when the provider supports it and stores `isMarkedUnread = true` in the existing `user_channel_read_state` row for the requesting workspace user and channel. The selected chat shows an unread badge and appears under the existing Unread filter.

The local marker is cleared through `PATCH /api/channels/:channelId/read-state` with `{ markedUnread: false }` only after the selected channel timeline loads successfully. Merely focusing, prefetching, or rendering a chat row does not clear it. The API publishes a user-scoped `channel.read_state_changed` event so multiple tabs for the same user converge. Normal inbound unread counting remains a separate broader read-state feature.

### Pin and unpin

Pin/unpin synchronizes with WhatsApp and persists the confirmed provider state locally. Pinned chats sort before unpinned chats; within each partition, WhatsApp activity ordering remains unchanged. Provider pin-limit failures leave local state unchanged and show the provider error.

### Mute and unmute

Mute/unmute synchronizes notification state with WhatsApp and persists it independently from channel lifecycle. Muting never disables replies, changes mapping, or archives the conversation. Chat rows show a restrained mute icon.

The current overloaded use of `channel.status = muted` is removed from reply blocking. This is an intentional breaking behavior correction: muted chats remain replyable. Existing muted rows are backfilled to `isMuted = true` and `status = active` for direct chats or `status = unmapped` for unmapped groups. The Postgres `channel_status` enum retains the legacy `muted` value because removing an enum member requires a disruptive type recreation; application code stops writing or interpreting that value after the backfill.

### Archive and unarchive

Archive/unarchive synchronizes with WhatsApp and updates the channel lifecycle only after provider confirmation. Archived chats disappear from All, Groups, Direct, and Unread views and remain accessible through a dedicated Archived filter backed by `GET /api/channels?view=archived`. The default `GET /api/channels` continues to exclude archived rows. Opening an archived chat does not implicitly unarchive it.

## Data Model

Channels gain provider-confirmed state fields:

- `isPinned boolean not null default false`
- `isMuted boolean not null default false`

The existing `user_channel_read_state` table gains:

- `isMarkedUnread boolean not null default false`

Archive continues to use `channels.status = archived`. Mute is no longer represented through channel status. A migration adds the boolean columns, backfills legacy muted rows, and updates those rows' operational status before application code switches to the new fields.

Channel list responses include `providerChatId`, `isPinned`, `isMuted`, `isMarkedUnread`, and the existing status. The UI model carries the same values without deriving one state from another.

## Gateway and API Contracts

The gateway adapter exposes optional capabilities for:

- fetch one chat's current metadata/state;
- mark chat unread;
- pin or unpin chat;
- mute or unmute chat;
- archive or unarchive chat.

Clario Gateway implements these with whatsapp-web.js chat methods. `GET /sessions/:id/chats/:chatId` returns current metadata including pinned, muted, and archived state. Target-state operations use `POST /sessions/:id/chats/:chatId/actions` with the same discriminated target-state commands used by the API. Gateway HTTP routes are authenticated by the existing gateway API key and return the confirmed resulting state.

ClarioDesk exposes the following contracts:

```text
POST /api/channels/:channelId/actions
PATCH /api/channels/:channelId/read-state
POST /api/channels/:channelId/refresh
```

The actions endpoint accepts a Zod discriminated union:

```json
{ "action": "mark_unread", "markedUnread": true }
{ "action": "pin", "pinned": true }
{ "action": "mute", "muted": true }
{ "action": "archive", "archived": true }
```

It returns the confirmed target state:

```json
{
  "channelId": "uuid",
  "status": "active",
  "isPinned": true,
  "isMuted": false,
  "isMarkedUnread": true
}
```

Admins and agents may call the state-changing actions endpoint. Viewers are denied every action in that endpoint. Admins, agents, and viewers with channel access may call the separate refresh endpoint and may clear their own local read-state marker. The API verifies workspace access and role, loads the channel and phone route, invokes the provider operation when required, then updates local state, writes an audit event, and publishes the appropriate realtime event. The browser never calls Clario Gateway directly.

Provider-dependent actions use provider-first ordering: if WhatsApp rejects or times out, local state is not changed. Local per-user unread state is written only after a successful provider call. Requests include idempotency-safe target state rather than toggle commands, for example `pinned: true` instead of `toggle-pin`.

Each gateway state operation has a 20-second confirmation timeout. The browser uses a 25-second request timeout and always leaves the menu/loading state recoverable. A timeout is reported as "WhatsApp did not confirm this change" and schedules a scoped refresh because whatsapp-web.js operations are not cancellable and may complete after the HTTP timeout. The refresh reconciles any late provider state rather than assuming rollback.

## Realtime and Sorting

Successful state changes publish `channel.updated` with the changed fields. The web app refreshes the channel query and retains the active conversation when it remains visible. If an active chat is archived while viewing a non-Archived filter, the next visible chat becomes active.

`GET /api/channels` owns the authoritative sort order:

1. pinned before unpinned;
2. latest activity descending within each partition;
3. stable channel ID tie-breaker.

The client uses the same comparator after query refresh as a defensive measure. `channel.updated` causes a scoped channel-list refresh and re-sort, rather than mutating array position ad hoc.

Copy title copies the displayed chat title. Copy WhatsApp ID copies the provider chat identifier such as `120363...@g.us` or `919...@c.us`. Copy ClarioDesk ID retains the existing internal channel UUID action so current support/debug workflows do not regress.

## Failure Handling

- Disconnected or degraded phone routes reject provider actions with a reconnect instruction.
- Unsupported provider capabilities are omitted from the menu rather than disabled.
- Provider pin limits and other provider errors appear as concise toasts.
- Provider calls that exceed 20 seconds enter the reconciliation flow described above; no infinite spinner is possible.
- Failed actions leave both local state and current filtering unchanged.
- Repeated target-state requests are idempotent.

## Deferred Actions

Assign-to, labels, tasks, snooze, close-chat workflows, AI controls, delete, and open-in-new-window are excluded. Assignment requires a real ownership model distinct from permission grants. Labels, tasks, and snooze require dedicated schemas and views. Delete is destructive. Open-in-new-window depends on stable URL routing, which is not implemented yet.

## Verification

Automated gateway tests cover each whatsapp-web.js chat method, missing chats, provider failures, and confirmed result normalization.

API integration tests cover the exact endpoint contracts, workspace isolation, viewer denial for every state-changing action, viewer access to refresh and own read state, provider-first persistence, timeout reconciliation, per-user unread state, audit events, and realtime publication.

Frontend tests cover dynamic labels, action dispatch, filtering, pin sorting, mute indicators, keyboard behavior, and error preservation.

Browser verification covers desktop and mobile menu positioning, every visible action, the existing Unread filter, the new Archived filter, the deliberate breaking correction that muted chats remain replyable, and a clean console. Live provider verification uses an approved test chat and restores its original pin, mute, unread, and archive state afterward.

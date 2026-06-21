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
9. **Copy chat ID**

The menu uses the existing compact context-menu visual language, Lucide icons, keyboard navigation, Escape/outside-click dismissal, and viewport-safe positioning. It contains no disabled future actions.

## Behavior

### Refresh

Refresh fetches current chat metadata and recent messages for only the selected chat. It does not trigger a full-phone sync or replace the entire inbox with a loading state.

### Mark as unread

Mark as unread updates the linked WhatsApp chat when the provider supports it and stores a per-user ClarioDesk unread marker. The selected chat shows an unread badge and appears under the Unread filter. Opening the chat clears the local marker; normal inbound unread counting remains a separate broader read-state feature.

### Pin and unpin

Pin/unpin synchronizes with WhatsApp and persists the confirmed provider state locally. Pinned chats sort before unpinned chats; within each partition, WhatsApp activity ordering remains unchanged. Provider pin-limit failures leave local state unchanged and show the provider error.

### Mute and unmute

Mute/unmute synchronizes notification state with WhatsApp and persists it independently from channel lifecycle. Muting never disables replies, changes mapping, or archives the conversation. Chat rows show a restrained mute icon.

The current overloaded use of `channel.status = muted` is removed from reply blocking. Existing muted rows are migrated to `isMuted = true` and a non-muted operational status appropriate to their channel type.

### Archive and unarchive

Archive/unarchive synchronizes with WhatsApp and updates the channel lifecycle only after provider confirmation. Archived chats disappear from All, Groups, Direct, and Unread views and remain accessible through a dedicated Archived filter. Opening an archived chat does not implicitly unarchive it.

## Data Model

Channels gain provider-confirmed state fields:

- `isPinned boolean not null default false`
- `isMuted boolean not null default false`

Per-user read state gains:

- `isMarkedUnread boolean not null default false`

Archive continues to use `channels.status = archived`. Mute is no longer represented through channel status.

Channel list responses include `isPinned`, `isMuted`, `isMarkedUnread`, and the existing status. The UI model carries the same values without deriving one state from another.

## Gateway and API Contracts

The gateway adapter exposes optional capabilities for:

- mark chat unread;
- pin or unpin chat;
- mute or unmute chat;
- archive or unarchive chat.

Clario Gateway implements these with whatsapp-web.js chat methods. Gateway HTTP routes are authenticated by the existing gateway API key and return the confirmed resulting state.

ClarioDesk exposes one authenticated channel-action endpoint. Admins and agents may change provider state; viewers may only open, refresh, and copy. The API verifies workspace access and role, loads the channel and phone route, invokes the provider operation, then updates local state, writes an audit event, and publishes `channel.updated`. The browser never calls Clario Gateway directly.

Provider-dependent actions use provider-first ordering: if WhatsApp rejects or times out, local state is not changed. Local per-user unread state is written only after a successful provider call. Requests include idempotency-safe target state rather than toggle commands, for example `pinned: true` instead of `toggle-pin`.

## Realtime and Sorting

Successful state changes publish `channel.updated` with the changed fields. The web app refreshes the channel query and retains the active conversation when it remains visible. If an active chat is archived while viewing a non-Archived filter, the next visible chat becomes active.

Sort order is:

1. pinned before unpinned;
2. latest activity descending within each partition;
3. stable channel ID tie-breaker.

## Failure Handling

- Disconnected or degraded phone routes reject provider actions with a reconnect instruction.
- Unsupported provider capabilities are omitted from the menu rather than disabled.
- Provider pin limits and other provider errors appear as concise toasts.
- Failed actions leave both local state and current filtering unchanged.
- Repeated target-state requests are idempotent.

## Deferred Actions

Assign-to, labels, tasks, snooze, close-chat workflows, AI controls, delete, and open-in-new-window are excluded. Assignment requires a real ownership model distinct from permission grants. Labels, tasks, and snooze require dedicated schemas and views. Delete is destructive. Open-in-new-window depends on stable URL routing, which is not implemented yet.

## Verification

Automated gateway tests cover each whatsapp-web.js chat method, missing chats, provider failures, and confirmed result normalization.

API integration tests cover workspace isolation, viewer denial for every state-changing action, provider-first persistence, per-user unread state, audit events, and realtime publication.

Frontend tests cover dynamic labels, action dispatch, filtering, pin sorting, mute indicators, keyboard behavior, and error preservation.

Browser verification covers desktop and mobile menu positioning, every visible action, Archived and Unread filters, no reply blocking while muted, and a clean console. Live provider verification uses an approved test chat and restores its original pin, mute, unread, and archive state afterward.

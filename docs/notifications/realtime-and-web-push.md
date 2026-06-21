# Realtime And Web Push Notifications

Notifications are a core product surface for ClarioDesk, not a later mobile-app
feature. Until native mobile ships, the web app must behave like a serious operations
client: live updates while open, Web Push while backgrounded or closed, actionable
deep links, and strict permission-aware delivery.

## Product Goal

```text
The right operator gets the right alert at the right urgency, can jump directly to
the correct work surface, and never receives content they are not allowed to see.
```

## Delivery Lanes

Use two complementary lanes:

- Foreground realtime: Socket.io for active browser sessions.
- Background push: Web Push through service worker and Push API for inactive or
  closed browser sessions.

SSE can be used later for specific one-way streams, but the current architecture
already has Socket.io and should keep it for rooms, targeted invalidation, typing,
presence, and bidirectional health.

## Browser Capability Notes

Planning constraints:

- Web Push uses Push API, Notifications API, and service workers.
- Notification action buttons are supported on persistent service-worker notifications,
  but support and presentation vary by browser and operating system.
- iOS/iPadOS Web Push requires a Home Screen web app.
- True inline text reply is not a dependable cross-browser web capability. Web
  notification reply should open/focus the app with the correct composer ready.

Therefore, ClarioDesk should design action buttons as accelerators, not as the only
way to complete work.

## Notification Event Types

P1/P2 events:

- New message in assigned channel.
- Mention in internal note.
- Assigned ticket.
- Ticket status changed.
- Failed outbound send.
- Phone disconnected.
- QR required.
- Sync/backfill completed.
- Mapping review needed.
- SLA at risk or breached.
- Queue/gateway degraded.

P3/P4 events:

- Incident suggested or opened.
- Storm detected.
- AI summary ready.
- Sensitive-data warning.
- Asset-risk warning.
- Approval requested.
- Compliance export ready.

## Delivery Policy

Every notification must pass:

```text
event created
  -> recipient resolution
  -> permission check
  -> user preferences
  -> quiet hours/focus rules
  -> dedupe/rate limit
  -> channel fanout
  -> delivery/audit record
```

Recipient resolution must be based on assignment, coverage, team role, client/project
access, and explicit subscriptions. No global push fanout for private client content.

## Privacy Model

Push payloads can appear on lock screens and shared desktops. Default payloads should
minimize sensitive content.

Recommended preview levels:

- Private: app name + generic alert + deep link only.
- Standard: client/channel name + event type.
- Full preview: sender/message excerpt, only if admin and user preference allow it.

The server should treat push endpoints and subscription keys as sensitive device
data. Store them securely, revoke them on logout/device removal, and never expose one
user's subscriptions to another user.

## Action Buttons

Suggested notification actions:

- Reply: opens/focuses app at the channel with external composer active.
- Add note: opens/focuses app with internal note composer active.
- Assign to me: allowed only when policy permits; uses a short-lived action token.
- Mark read: allowed only for the recipient and device.
- Mute 1h: updates notification preference for that channel/user.
- Open ticket: opens/focuses exact ticket/context panel.
- View summary: opens/focuses summary panel when available.

External WhatsApp replies must not be sent directly from a web push notification by
default. They need the normal composer, route checks, send delay, attachment checks,
sensitive-data warnings, and audit.

## Action Token Safety

Background notification actions that mutate state should use short-lived,
single-purpose action tokens.

Token requirements:

- Bound to user, workspace, device subscription, notification, and action.
- Short TTL.
- Single use.
- Permission rechecked at execution time.
- Idempotency key included.
- Audit event recorded.

If token validation fails, the action should open the app instead of silently failing.

## Data Model

Recommended entities:

```text
notification_events
notification_deliveries
notification_preferences
notification_subscriptions
notification_action_tokens
notification_digests
```

Subscription fields:

```text
id
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
created_at
updated_at
```

Delivery fields:

```text
id
event_id
workspace_id
user_id
subscription_id nullable
channel
status
attempt_count
last_error_code
delivered_at
clicked_at
action_taken
created_at
```

## API Surface

```text
GET    /api/notifications
PATCH  /api/notifications/:id/read
POST   /api/notifications/preferences
PATCH  /api/notifications/preferences

POST   /api/push/subscriptions
GET    /api/push/subscriptions
DELETE /api/push/subscriptions/:id
POST   /api/push/actions
```

The service worker should not know broad product APIs. It should receive push
payloads, display notifications, handle clicks/actions, and call narrow action
endpoints.

## PWA UX

The app should guide users through:

- Browser support check.
- PWA install prompt where helpful.
- Notification permission request only after user intent.
- Device naming.
- Test notification.
- Quiet hours and preview preference.
- Troubleshooting when permission is blocked.

For iOS/iPadOS, explain that Web Push requires adding the app to the Home Screen.

## Badging

Use app badging where supported:

- Unread assigned messages.
- Mentions.
- Failed sends.
- P1/SLA alerts.

Badges should reflect urgent actionable work, not total message volume.

## Failure And Fallbacks

If Web Push is unavailable:

- Keep in-app notifications.
- Use email/Slack/Teams where configured.
- Show setup guidance.
- Keep browser tab title/unread badges for active tabs.

If realtime disconnects:

- Keep cached data visible.
- Show reconnecting state.
- Continue Web Push subscriptions.
- Reconcile missed events on reconnect.

## Phase Plan

P1:

- Socket.io foreground notifications.
- In-app notification center.
- Permission-scoped event model.
- Deep links to channel/ticket/message.
- Tab title and unread badges.

P2:

- Web Push subscriptions.
- Service worker notification display/click handling.
- PWA install guidance.
- Quiet hours, preview privacy, per-client/channel preferences.
- Mark read, mute, assign-to-me action buttons where supported.

P3:

- Digest notifications.
- AI summary ready notifications.
- Incident/storm/approval notifications.
- Advanced notification routing.
- App badging.

P4:

- Native mobile push.
- Native inline reply where platform permits.
- Enterprise notification policies.
- Multi-region push delivery controls.

# Notifications And PWA UX

The web app must carry much of the mobile-app value until native mobile ships.
Notifications should feel operationally serious: timely, scoped, actionable, and
quiet by default.

## UX Principles

- Ask for notification permission only after the user understands the value.
- Route every notification to the exact work surface.
- Make notification privacy configurable.
- Keep action buttons useful but safe.
- Never rely on push as the only source of truth.
- Always reconcile from the server when the app opens.

## Setup Flow

Recommended onboarding:

```text
Notification settings
  -> browser support check
  -> explain value and privacy
  -> request permission after button click
  -> save push subscription
  -> name device
  -> send test notification
  -> choose preview level and quiet hours
```

For iOS/iPadOS, show Home Screen install guidance before asking for push permission.

## Notification Center

In-app notification center should include:

- Mentions.
- Assigned tickets.
- Assigned-channel messages.
- Failed sends.
- SLA risk.
- Phone/gateway health.
- Mapping reviews.
- Approval requests.
- Incident/storm alerts.

Each row should show:

- Event type.
- Client/channel/ticket.
- Created time.
- Read/unread state.
- Primary action.
- Secondary action menu.

## Web Push Notification Shape

Default notification:

```text
Title: Acme Support
Body: New message needs reply
Actions: Reply, Mute 1h
Deep link: /inbox/channels/:channelId?message=:messageId
```

Privacy modes:

- Private: no client/message preview.
- Standard: client/channel and event type.
- Full preview: sender/message excerpt when policy allows.

## Action Buttons

Preferred actions:

- Reply: opens channel and focuses external composer.
- Add note: opens channel and focuses internal note composer.
- Open ticket: opens ticket panel.
- Assign to me: executes only with short-lived action token and permission check.
- Mark read: marks notification read, not the whole channel unless explicitly designed.
- Mute 1h: suppresses notification delivery for that user/channel.

External replies should not be sent directly from web notification action buttons.
The composer must open so users can verify destination, mapping, route, send delay,
and sensitive-data warnings.

## Realtime And Push States

Shared UI states:

- Realtime connected.
- Realtime reconnecting.
- Realtime disconnected.
- Push unsupported.
- Push permission not requested.
- Push permission denied.
- Push enabled.
- Push subscription expired.
- Push delivery failing.

Components:

```text
RealtimeStatusBadge
NotificationBell
NotificationPanel
NotificationPreferenceForm
PushSetupPanel
DeviceSubscriptionList
TestNotificationButton
NotificationPrivacySelector
QuietHoursEditor
```

## Desktop UX

Desktop should support:

- Notification bell in app shell.
- Unread count in browser tab title.
- Browser notifications for urgent events.
- Deep-link focus to exact channel/message/ticket.
- Keyboard shortcut to open notification center.

## Mobile Web UX

Mobile web should support:

- PWA install guidance.
- Permission state troubleshooting.
- Compact notification center.
- Bottom-sheet notification details.
- Push deep links into one-pane mobile routes.

Do not hide action requirements behind hover interactions.

## Admin Controls

Admins should configure:

- Workspace default notification policy.
- Allowed preview level.
- Events eligible for push.
- Events that must always notify.
- Quiet-hours defaults.
- Digest defaults.
- Retention for notification events.

Admins should not be able to force users into noisy non-critical push notifications
without a clear operational reason.

## Accessibility

- Notification center must be keyboard navigable.
- New in-app notifications should not steal focus.
- Use ARIA live regions only for critical in-app alerts.
- Do not rely on sound.
- Respect reduced motion.

## Roadmap

P1:

- In-app notification center.
- Realtime event badges.
- Deep links.
- Browser tab unread count.

P2:

- Web Push subscriptions.
- PWA setup guidance.
- Notification privacy and quiet hours.
- Safe action buttons.
- Device subscription management.

P3:

- Notification digests.
- AI summary notifications.
- Incident/storm/approval notification UX.
- App badge count.

P4:

- Native mobile push alignment.
- Native inline reply where supported.
- Enterprise notification governance.

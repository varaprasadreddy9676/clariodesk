# States: Loading, Empty, Error, Offline

Designed states are part of product quality. No screen should fail into blank space.

## Loading States

Use skeletons for content:

- Channel list skeleton.
- Timeline message skeletons.
- Context panel skeleton.
- Ticket list skeleton.
- Search result skeleton.

Use small spinners only for inline actions:

- Send button pending.
- Refresh status.
- Save setting.
- Upload file.

Skeletons should approximate final layout to prevent layout shift.

## Empty States

Empty states should answer:

- What happened?
- Why is this empty?
- What can I do next?

Examples:

```text
No phone connected
Connect a WhatsApp number to start syncing groups.
[Connect phone]
```

```text
No assigned groups
You do not have access to any groups yet.
Ask an admin to assign you to a client or channel.
```

```text
No mapped groups
Groups are synced, but none are mapped to a client/project.
[Review unmapped groups]
```

## Error States

Errors should be specific:

- Could not load messages.
- Gateway is unreachable.
- You do not have access to this channel.
- Media is not available.
- Message cannot be cancelled because it was already sent.
- Route is blocked by policy.

Every recoverable error needs a retry or next action.

## Offline And Reconnecting

Show realtime connection state:

- Connected.
- Reconnecting.
- Disconnected.

If realtime is disconnected:

- Keep read-only cached data visible where possible.
- Disable assumptions about live state.
- Offer refresh.

## Push Notification States

Show Web Push state in settings and relevant onboarding:

- Unsupported browser/platform.
- PWA install required.
- Permission not requested.
- Permission denied.
- Permission granted but subscription missing.
- Push enabled.
- Subscription expired.
- Delivery failing.

Each blocked state needs a concrete next action, for example open browser settings,
install the PWA, retry subscription, or send a test notification.

## Permission States

Permission states must be safe:

- Do not leak content.
- Explain next action when safe.
- Avoid implying the object does not exist if the user may simply lack access.

## Syncing And Backfill States

Backfill and reconnect sync must be visible:

- Historical messages may appear.
- Automation/SLA suppressed.
- Live messages still prioritized.

Timeline markers should distinguish historical context from live operations.

## Diagnostics States

Operational diagnostics should use banners:

- Warning for degraded states.
- Error for blocked states.
- Info for ongoing sync.
- Success only for completed setup or resolved issue.

Use icon + title + short detail + action.

## Toasts

Use toasts for transient confirmation:

- Note saved.
- Ticket assigned.
- Message cancelled.
- Phone status refreshed.

Do not rely on toasts for critical failures. Critical failures need persistent UI.

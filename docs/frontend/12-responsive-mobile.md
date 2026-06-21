# Responsive And Mobile

Mobile matters because WhatsApp operations often happen away from a desk. The mobile
experience should be a focused companion, not a cramped desktop clone.

## Breakpoints

Test at:

- 320px
- 375px
- 768px
- 1024px
- 1440px

## Mobile Navigation

Mobile structure:

```text
Inbox list
Channel timeline
Context drawer
Composer
Search
Settings-lite
```

Use a drawer for app navigation. Avoid showing channel list, timeline, and context
panel side-by-side on small screens.

## Mobile Timeline

Requirements:

- Message bubbles fit long words and URLs.
- Composer remains reachable.
- Reply preview does not cover too much vertical space.
- Send-delay cancel remains visible.
- Media previews do not overflow.
- Context actions are reachable by bottom sheet or header action.

## Tablet

Tablet can use two panes:

```text
Channel list | Timeline
```

Context opens as drawer or third pane depending on width.

## Desktop

Desktop uses full four-region shell:

```text
App nav | Channel list | Timeline | Context panel
```

The context panel should be resizable. The app should remember panel width per user.

## Mobile Priorities

P1:

- Read messages.
- Reply safely.
- Add internal note.
- View/create ticket.
- Search.

P2:

- Handover.
- Quick replies.
- Coverage.
- Better filters.
- PWA install guidance.
- Web Push setup and notification preferences.

P3:

- Incident response.
- AI summary.
- Draft approvals.

P4:

- Dedicated mobile app.
- Native push notifications.
- Offline-friendly workflows.

## PWA And Push

Mobile web should support Web Push where the browser/platform allows it. On iOS and
iPadOS, users may need to add the app to the Home Screen before Web Push can be
enabled.

Mobile notification clicks should deep-link into the one-pane route for the exact
channel, message, ticket, or setting. Reply actions should focus the composer rather
than sending directly from the notification.

## Touch Targets

Minimum touch target: 44px for primary interactive elements on mobile.

Compact desktop controls can be smaller, but mobile cannot rely on hover-only actions.

## Offline/Low Connectivity

Mobile should handle:

- Reconnecting realtime.
- Failed send state.
- Retry where safe.
- Cached recent channel list.
- Clear stale data indicators.

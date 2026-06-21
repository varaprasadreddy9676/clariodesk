# Layouts And Navigation

ClarioDesk should use a stable app shell with a chat-first work area.

## App Shell

Desktop:

```text
┌─────────┬───────────────┬────────────────────────────┬──────────────────┐
│ App Nav │ Channel List  │ Timeline                   │ Context Panel    │
│         │               │                            │                  │
│         │               │                            │                  │
│         │               │ Composer                   │                  │
└─────────┴───────────────┴────────────────────────────┴──────────────────┘
```

Width guidance:

```text
App nav: 56-240px collapsible
Channel list: 280-360px
Timeline: flexible, min 420px desktop
Context panel: 320-480px resizable
```

## Navigation Items

Primary:

- Inbox
- Tickets
- Search
- Phones
- Clients
- Team
- Reports
- Settings

Secondary surfaces should live inside these sections, not as top-level clutter.

## Header Pattern

Each major screen has:

- Left: title/breadcrumb.
- Center optional: search or selected context.
- Right: primary actions, status, overflow menu.

Inbox header is channel-specific and should show mapping, phone state, and risk.

## Panel Behavior

Context panel:

- Resizable on desktop.
- Collapsible.
- Opens as drawer on tablet/mobile.
- Deep-linkable to selected tab/object.

Use panel tabs instead of stacking many sections:

- Ticket
- Context
- Participants
- Media
- Notes
- Events

## Command Menu

P2+ command menu should support:

- Jump to channel.
- Search messages.
- Create ticket.
- Add note.
- Open phone status.
- Invite user.
- Open settings.

Command menu must respect permissions.

## Notifications

Notifications panel should include:

- Mentions.
- Assigned ticket.
- New message in assigned channel.
- Phone disconnected.
- Failed send.
- Mapping review needed.
- SLA risk.

Clicking notification deep-links to the exact work surface.

## Responsive Strategy

Desktop:

- Persistent app nav, channel list, timeline, context panel.

Tablet:

- App nav collapsed.
- Channel list + timeline.
- Context drawer.

Mobile:

- One primary pane at a time.
- Bottom/tab navigation may be considered after usage proves need.
- Composer remains easy to reach.

## Layout Anti-Patterns

Avoid:

- Dashboard-first home for agents.
- Hiding channel list behind too many clicks on desktop.
- Putting ticket fields above the conversation.
- Permanent three-column squeeze on mobile.
- Floating cards inside cards.
- Marketing-style hero sections.

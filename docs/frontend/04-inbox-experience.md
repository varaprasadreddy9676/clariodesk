# Inbox Experience

The inbox is the primary product surface. It must be as easy to understand as
WhatsApp, but with operational control around the conversation.

## Layout

Desktop:

```text
App sidebar | Channel list | Timeline + composer | Context panel
```

Mobile:

```text
Channel list -> Timeline -> Context drawer
```

The timeline should dominate. Sidebars and panels support the conversation; they
should not make the screen feel like a CRM form.

## Channel List

Each channel row should show:

- Channel/group title.
- Client/project mapping.
- Last message snippet.
- Last message time.
- Unread count.
- Open ticket count or highest ticket priority.
- Assignment indicator.
- Status: unmapped, active, muted, archived, mixed, degraded.
- Phone/gateway status indicator when relevant.

Rows should be compact and stable. Hover states must not shift layout.

## Inbox Views

P1 fixed views:

- All assigned.
- My assigned.
- Unread.
- Unmapped.
- Open tickets.
- Waiting for us.
- Waiting for client.

P2:

- Saved views.
- Pinned views.
- Quick filters.
- Configurable channel list columns.

P3:

- SLA breach queues.
- Storm mode queues.
- Asset-risk queues.
- AI triage queues.

P4:

- Compliance queues.
- Auditor views.
- Cross-workspace/portfolio dashboards.

## Timeline Header

The channel header should show:

- Channel title.
- Client/project mapping.
- Mapping mode: single client, mixed, unmapped, archived.
- Phone instance.
- Transport mode.
- Realtime status.
- Risk state.
- Primary action menu.

For risky states, show a banner below the header:

```text
This group is unmapped. Replies are disabled until an admin maps it.
```

```text
This phone is syncing. Old messages may appear as historical context.
```

```text
This is a mixed group. SLA and automation are disabled by default.
```

## Timeline

The timeline should feel chat-native:

- Incoming/outgoing direction is visually obvious.
- Groups by day.
- Sender names for group messages.
- Media previews.
- Reply previews.
- Delivery states.
- Backfill/remap markers.
- System events.

The timeline should also support operations:

- Create ticket from message.
- Link message to ticket.
- Add internal note around a message.
- Pin message/context.
- Download media.
- Copy text.
- Jump to quoted message.
- Show audit-relevant status changes.

## Context Panel

The right panel should default to the most relevant context:

- If a ticket is selected: ticket detail.
- If no ticket is selected: channel context.
- If mapping is missing: mapping panel.
- If phone is degraded: diagnostics panel.

Panel tabs:

- Ticket
- Context
- Participants
- Media
- Notes
- Events

Do not overload the right panel with all information at once. Use compact sections
and progressive disclosure.

## Empty States

Important empty states:

- No phone connected.
- Phone connected but no groups synced.
- No assigned channels.
- No messages in selected channel.
- No mapped groups.
- No tickets.
- Search has no results.

Each empty state should provide the next action if the user is allowed to take it.

## Full-Product Growth

P1:

- Channel list.
- Timeline.
- Safe composer.
- Ticket context panel.
- Mapping states.
- Realtime status.

P2:

- Saved/pinned views.
- Handover notes.
- SLA indicators.
- Coverage access.
- Quick filters.

P3:

- Virtual threads.
- Incident/storm mode.
- AI summaries.
- Draft approvals.
- Asset risk warnings.

P4:

- Compliance queues.
- Enterprise policy panels.
- Official API route governance.
- Plugin-injected context sections.

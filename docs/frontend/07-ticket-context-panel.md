# Ticket And Context Panel

The context panel turns chat into structured operations. It should be useful without
making the inbox feel like a CRM form.

## Panel Layout

Desktop: resizable right panel.

Mobile: bottom sheet or full-screen drawer.

Default tabs:

- Ticket
- Context
- Participants
- Media
- Notes
- Events

The active tab should persist per channel where helpful.

## Ticket Tab

P1 ticket fields:

- Title.
- Status: open, pending, closed.
- Priority.
- Assignee.
- Client/project.
- Source message.
- Created time.
- First-response state.

Actions:

- Create ticket from message.
- Assign owner.
- Change status.
- Link/unlink messages.
- Add internal note.

For mixed groups, ticket creation must require client/project selection.

## Context Tab

Show:

- Client.
- Project.
- Channel mapping mode.
- Mapping effective timestamp.
- Phone instance.
- Transport mode.
- Risk state.
- Pinned context.
- Handover note when implemented.

For unmapped groups, this tab should become the mapping workflow.

## Participants Tab

Show:

- Known contacts.
- Unknown members.
- Internal users.
- Ghost-agent identities.
- Recent participant changes.

P2/P3 can add member risk, allowed-member lists, and group governance workflows.

## Media Tab

Show:

- Recent media.
- Storage status.
- Source: live/backfill/upload.
- Client/project context.
- Download action.

P3 adds asset vault governance and cross-client contamination warnings.

## Notes Tab

Show:

- Channel notes.
- Ticket notes.
- Mentions.
- Handover notes.

Internal notes should never be visually confused with messages.

## Events Tab

Show audit-relevant events:

- Channel mapped.
- Ticket created/updated.
- Message sent.
- Outbox cancelled.
- Phone disconnected.
- Group renamed.
- Media purged.

P4 can expose fuller compliance/audit views.

## Full-Product Growth

P1:

- Basic ticket panel.
- Channel mapping context.
- Participants.
- Internal notes.

P2:

- Handover/pinned context.
- SLA/reverse SLA.
- Coverage access.
- Better media health.

P3:

- Virtual threads.
- Incident mode.
- Asset risk.
- AI summary panel.

P4:

- Compliance review.
- Break-glass context.
- Enterprise policies.
- Plugin-provided panel sections.

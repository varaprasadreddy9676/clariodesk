# Information Architecture

The app is organized around operational work, not database entities. The primary
mental model is:

```text
Workspace -> Client/Project -> WhatsApp Channel -> Messages -> Tickets/Notes/Media
```

## Primary Navigation

The app shell should have a persistent left rail/sidebar with:

- Inbox
- Tickets
- Search
- Phones
- Official WhatsApp
- Clients
- Team
- Reports
- Settings

The sidebar may collapse to icons on desktop. On mobile it becomes a drawer.

## Inbox Structure

The inbox is the default home for most users.

Desktop layout:

```text
Left rail      Channel list       Timeline                  Context panel
-----------    ---------------    ----------------------    ----------------
App nav        Clients/views      Group header              Ticket/context
Status         Channels           Messages                  Mapping
Settings       Unmapped           Composer                  Participants
```

Mobile layout:

```text
Screen 1: channel list
Screen 2: timeline + composer
Screen 3: context drawer/tabs
```

The mobile experience should still feel chat-first. Context should be one swipe/tap
away, not permanently squeezed beside the message timeline.

## Core Surfaces

### Inbox

Purpose: read WhatsApp group messages, reply safely, add internal notes, and create
or update tickets.

Primary objects:

- Channel
- Message
- Internal note
- Ticket
- Media
- Participant
- Phone status

### Tickets

Purpose: manage work that emerged from WhatsApp messages.

Views:

- My open tickets
- Unassigned
- Waiting for us
- Waiting for client
- Urgent
- Recently closed
- SLA risk

Ticket screens should deep-link back to the source channel and source message.

### Search

Purpose: find messages, tickets, contacts, clients, projects, and media within
permission scope.

Search must never show inaccessible channels or cross-client content. Permission
scoping should affect both results and suggestions.

### Phones

Purpose: connect, monitor, and diagnose WhatsApp transports.

Key flows:

- Connect phone by QR/pairing.
- See connection state.
- See risk mode.
- Trigger group sync.
- Diagnose webhook/gateway failures.
- Review sync/backfill state.

### Official WhatsApp

Purpose: manage official Meta WhatsApp Business Platform channels without mixing
that complexity into the core group support inbox.

Key areas:

- WABA accounts.
- Phone numbers.
- Templates.
- WhatsApp Flows.
- Opt-outs.
- Official 1:1 conversations.
- Bot workflows.
- Delivery/cost/tier analytics.

This section is P4/P5 platform scope. It should remain separate from Core v1
support operations.

### Clients

Purpose: manage client/project metadata and channel mappings.

The client page is not the primary work surface in Core v1. It supports the inbox,
not the other way around.

### Team

Purpose: manage users, roles, assignments, and coverage.

The UI must make "no assignment = no visibility" understandable.

### Reports

Purpose: understand operations after usage accumulates.

P1 can be minimal. P2+ adds response time, channel health, ticket volume, media,
and SLA views.

### Settings

Purpose: workspace, gateway, retention, security, integrations, AI, automation,
and enterprise controls.

Settings must not hide operational failures. Critical phone/gateway failures should
also surface in the inbox.

## Saved Views

Core v1 may ship fixed views. The full product should support saved and pinned views:

- Personal saved views.
- Workspace public views.
- Admin-curated standard views.
- Pinned views in the sidebar.
- URL-shareable filter state.

Examples:

- My assigned groups
- Unmapped groups
- Groups with open tickets
- SLA risk
- Storm mode
- Media failed
- Waiting for client

## Deep Links

Every important object needs a stable deep link:

- Channel timeline.
- Message inside channel.
- Ticket.
- Media item.
- Mapping review event.
- Phone diagnostic.
- Audit event.

Notification clicks should land the user in the exact channel, message, tab, or
panel needed to act.

## Permission-Aware IA

Navigation must be permission-scoped:

- Admin sees all clients/channels/settings.
- Agent sees assigned clients/channels and allowed actions.
- Viewer sees read-only assigned surfaces.

When an object is inaccessible, prefer a specific permission state over a generic
404 where appropriate:

```text
You do not have access to this channel.
Ask an admin to assign you to the client or group.
```

Do not leak client names or message snippets in permission-denied states if the
user should not know the object exists.

## Full-Product Navigation Roadmap

P1:

- Inbox
- Tickets
- Search
- Phones
- Clients
- Team
- Settings

P2:

- Reports
- Handover
- Saved views
- Coverage
- Quick replies

P3:

- Automations
- AI assist
- Incident mode
- Asset vault
- Virtual threads

P4:

- Compliance
- Plugin marketplace
- Official API templates
- Enterprise policies
- Managed cloud controls

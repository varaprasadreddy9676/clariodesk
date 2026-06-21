

## Priority Overlay — How to Read This Document

This document is intentionally comprehensive. It is **not** a single-sprint MVP plan. It should be read as a full product requirement registry plus a prioritized execution roadmap.

### Product Goal Rule

ClarioDesk is an open-source customer support desk for WhatsApp chats.

The primary operational focus is customer support groups, but the inbox must surface all WhatsApp chats linked to a phone in the same WhatsApp-like order, with optional filters for groups only or direct chats only.

The primary problem is not WhatsApp messaging itself. The problem is that companies
use customer WhatsApp groups as support systems, but WhatsApp groups were never
designed for structured support operations.

The mission is:

```text
No customer issue should be lost inside a WhatsApp group again.
```

The product must prioritize customer group support operations before generic CRM,
marketing, omnichannel, or AI-chatbot workflows.

To avoid over-building, every feature in this FRS must be interpreted using the following priority classes:

| Priority | Meaning | Build Timing | Engineering Rule |
|---|---|---|---|
| **P0 — Non-Negotiable Safety / Data Integrity** | Required to prevent data loss, client leaks, automation spam, or unusable product behavior | Before or during Core v1 | Must be built before any production/pilot use |
| **P1 — Core v1 Usable Product** | Required for the first useful release: linked-device chat sync, group mapping where needed, shared support inbox, safe replies, internal notes, basic tickets | First 8–12 week release | Must ship before real users can operate customer groups |
| **P2 — Operational v1.5 / v2** | Makes daily support reliable: SLA basics, handover, Web Push/PWA notifications, quick replies, coverage, operational dashboards | After Core v1 proves usage | Build based on real support-team feedback |
| **P3 — Advanced Product Differentiators** | Strong competitive features: AI summaries, voice transcription, semantic search, virtual threading, incident mode, advanced asset safety | Post-v2 | Build only after core support workflow is stable |
| **P4 — Enterprise / Long-Term Vision** | Enterprise/compliance scale: Official WhatsApp Management, SSO, advanced RBAC, plugin system, hybrid official routing maturity | Long-term / paid enterprise | Build only when customers demand it |

### Priority Interpretation Rule

If a feature is described in detail but marked **P3** or **P4**, it remains part of the product vision but **must not block Core v1**.

Core v1 must focus on this single workflow:

```text
Customer sends message in WhatsApp support chat
→ ClarioDesk receives it through linked-device gateway
→ support team sees it in shared inbox
→ safely reply or add internal note
→ create ticket from message
→ assign owner
→ track basic status
→ preserve audit/history without triggering backfill spam
```

### Transport Positioning Rule

The platform must be honest about WhatsApp transport risk:

```text
Linked-device mode = useful for existing WhatsApp chats and groups, self-hosted/community usage, and teams that accept operational risk.
Official Meta WhatsApp Business Platform mode = preferred for compliant 1:1 business messaging, templates, WhatsApp Flows, notifications, OTP, opt-outs, and enterprise customer-facing communication.
```

Linked-device mode should not be marketed as a risk-free official WhatsApp API
replacement. Official API support is part of the long-term hybrid architecture, but
Core v1 may start with one linked-device gateway to validate the customer WhatsApp
group support workflow.

### Mixed Group Reality Rule

The ideal operating model is one client/project per group, but the platform must acknowledge messy real-world migration:

```text
Clean group = mapped to one client/project; automation and SLA can be enabled.
Mixed group = contains multiple clients/vendors/projects; manual classification required; automation/SLA disabled by default.
Unmapped group = admin review required for reporting and client attribution, but the chat remains visible and replyable by default.

Direct chats do not need group mapping for visibility or reply. They should appear in the inbox immediately after sync and remain active by default.
```

### MVP Scope Discipline Rule

The comprehensive FRS should not be interpreted as “build everything now.” The first release must intentionally exclude AI, advanced automations, full asset governance, official API hybrid routing, virtual threading, shared draft collaboration, enterprise RBAC, and incident war-room workflows unless a paying pilot requires one of them.
# Open-Source Customer Support Desk For WhatsApp Groups
## Comprehensive Functional Requirements Document

**Document Version:** 4.0  
**Document Type:** Functional Requirements Specification (FRS)  
**Target Product:** Open-source, self-hostable customer support desk for WhatsApp groups, with shared inboxes, tickets, owners, workflows, audit, automation, and AI assist  
**Primary Users:** Organizations managing support, operations, implementation, service delivery, client success, vendor coordination, or project communication across multiple WhatsApp groups and 1:1 channels  
**Prepared For:** Product, Engineering, Design, QA, DevOps, Security, and Go-to-Market teams  
**Revision Notes:** v1.2 keeps the comprehensive v1.1 requirements intact and adds a clear execution-priority overlay, shippability guidance, production-risk prioritization, official-vs-linked-device transport positioning, and a ruthless MVP/Core-v1 roadmap. No previous requirements have been removed; lower-priority items are explicitly marked as post-v1 backlog or long-term vision.  

---

## 1. Executive Summary

Many organizations manage their day-to-day customer, vendor, branch, project, and support operations through WhatsApp groups. This works initially because WhatsApp is fast, familiar, and universally adopted. However, once the number of groups grows, operations become chaotic.

Common problems include:

- Missed client messages.
- No clear ownership.
- No ticket tracking.
- No SLA visibility.
- No internal notes.
- No shift handover.
- No reliable document retrieval.
- No safe separation between external replies and internal comments.
- No client/project isolation.
- No analytics.
- No audit trail.
- No structured way to convert group messages into actionable support work.

This product aims to solve that by converting chaotic customer WhatsApp groups into
organized support workflows: shared inboxes, tickets, owners, statuses, handovers,
search, audit, media retention, and operational clarity.

The real problem is not "WhatsApp messaging." The real problem is:

```text
Businesses are using WhatsApp groups as support systems, but WhatsApp groups were
never designed for structured support operations.
```

The platform must support a hybrid WhatsApp connectivity model:

1. **Linked-device mode** for existing WhatsApp groups and low-cost group operations.
2. **Official Meta WhatsApp Business Platform mode** for compliant, scalable 1:1 messaging, templates, WhatsApp Flows, notifications, OTPs, opt-outs, and formal business communication.

The product must be open-source at its core, self-hostable, gateway-agnostic, extensible, and useful for organizations handling support and operations across multiple clients.

---

## 2. Product Vision

### 2.1 Vision Statement

Build the open-source customer support command center for organizations running
support and implementation operations inside WhatsApp groups.

### 2.2 Product Positioning

**Primary positioning:**

> Open-source customer support desk for WhatsApp groups.

**Polished positioning:**

> ClarioDesk turns customer group chats into organized support workflows with shared inboxes, tickets, ownership, and operational clarity.

**Alternative positioning:**

> A self-hostable WhatsApp group support platform that turns client groups into trackable tickets, tasks, SLAs, handovers, assets, automations, analytics, and AI-assisted workflows.

### 2.3 Core Product Promise

For every client, project, account, branch, or vendor group, the platform should answer:

- What happened?
- Who owns it?
- What is pending?
- Is it waiting on us or the client?
- What is the SLA?
- What documents were shared?
- What should the next agent do?
- What must never be leaked externally?
- What is the complete audit trail?

---

## 3. Core Principles

### 3.1 One Client/Project = One Isolated Channel

The system must enforce the principle:

> One client, project, branch, account, vendor, or operational unit must be mapped to its own isolated WhatsApp group/channel.

The platform must never encourage mixing unrelated clients in the same group.

### 3.2 Historical Context Must Not Trigger Operations

Historical imports and backfills must enrich context only. They must not trigger:

- Auto acknowledgements.
- SLA timers.
- Auto-ticket creation.
- AI auto-replies.
- Out-of-office responses.
- Escalations.
- Client nudges.

### 3.3 Transport Must Be Separate from Operations

WhatsApp connectivity must be abstracted from the core product.

The core operations layer must work regardless of whether messages come from:

- Linked-device gateway.
- Meta Cloud API.
- Twilio.
- BSP.
- Future official group API.
- Email or other channels later.

### 3.4 Client Isolation Is Mandatory

Every message, ticket, contact, document, note, automation, AI context, and analytics event must be scoped by workspace and client/project where applicable.

### 3.5 AI Must Be Safe by Default

AI should assist agents first, not replace them blindly.

Default AI behavior:

- Suggest, summarize, classify, and draft.
- Do not auto-send external messages unless explicitly configured.
- Never mix private context across clients.
- Never act on stale historical backfill messages.

### 3.6 Human Behavior Is Part of the Product

The system must be designed around real-world WhatsApp chaos:

- Voice notes.
- Casual client chatter.
- Multiple client stakeholders.
- Shift handovers.
- Accidental wrong-box replies.
- Old documents buried in media history.
- Out-of-office loops.
- Client-side delays.
- Manual replies from physical phones.

---

## 4. Target Users and Personas

### 4.1 Workspace Owner / Organization Admin

Responsible for setting up the platform, connecting WhatsApp numbers, managing users, configuring workspaces, setting policies, and ensuring security.

Needs:

- Connect numbers.
- Manage teams.
- Configure clients/projects.
- Set permissions.
- Configure integrations.
- Monitor risk and cost.
- Export data.
- Review audit logs.

### 4.2 Support Lead / Operations Lead

Responsible for daily support operations across many client WhatsApp groups.

Needs:

- See all open issues.
- Assign tickets.
- Monitor SLAs.
- Review handovers.
- Handle escalations.
- Identify noisy groups.
- Generate summaries.

### 4.3 Support Agent / Implementation Agent

Works on incoming client messages and tickets.

Needs:

- Read group messages.
- Reply safely.
- Add private notes.
- Create tickets.
- Update statuses.
- Pin important context.
- Access shared files.
- Search past messages.
- Avoid duplicate replies.

### 4.4 Developer / Internal Escalation User

Handles technical escalations, but may not need direct WhatsApp group access.

Needs:

- View linked ticket context.
- See screenshots/logs/files.
- Add internal notes.
- Update resolution status.
- Avoid external communication unless authorized.

### 4.5 Management / Read-Only Viewer

Needs high-level visibility.

Needs:

- Open vs resolved tickets.
- SLA breaches.
- Client-wise issue load.
- Agent workload.
- Critical incidents.
- Trends by category.

### 4.6 Client User / External Portal User (Future)

May later access a portal to view ticket status, but initially remains on WhatsApp.

Needs:

- Easy communication via WhatsApp.
- Clear updates.
- Minimal friction.

---

## 5. Supported Industry Use Cases

The platform must be generic, not restricted to healthcare/HIMS.

Supported verticals should include:

- SaaS support teams.
- HIMS/healthcare software vendors.
- Logistics operations.
- Real estate builders.
- Education institutions.
- IT support companies.
- Implementation/project teams.
- Agencies.
- Franchise operations.
- Distributor/dealer networks.
- Manufacturing support.
- Field service teams.
- Vendor coordination teams.
- Apartment/community operations.

Each vertical can later be supported through templates.

---

## 6. Product Scope

### 6.1 In Scope

The platform must include:

- WhatsApp linked-device connection.
- Official WhatsApp API connection.
- Gateway adapter abstraction.
- Group/chat synchronization.
- Client/project mapping.
- Shared inbox.
- External replies.
- Internal private notes.
- Ticket creation from messages.
- Tasks.
- SLA and reverse SLA.
- Shift handover.
- Pinned context.
- Asset vault.
- Media backup.
- Voice transcription.
- AI summaries and suggestions.
- Contact identity and channel membership management.
- Group governance.
- Automation rules.
- Incident mode.
- Analytics.
- Audit logs.
- API and webhooks.
- Integrations.
- Self-hosted deployment.

### 6.2 Out of Scope for Initial MVP

The first MVP should not include:

- Fully autonomous AI customer support.
- Complex marketing campaign system.
- Advanced CRM replacement.
- Native mobile app.
- Full omnichannel support beyond WhatsApp.
- Public marketplace for plugins.
- Enterprise SSO unless required for paid enterprise phase.

---

## 7. High-Level Functional Architecture

### 7.1 Core Layers

1. **Transport Layer**
   - Linked-device gateways.
   - Official Meta Cloud API.
   - BSP adapters.
   - Future channel adapters.

2. **Policy and Routing Layer**
   - Chooses transport based on message intent, cost, risk, channel type, and compliance needs.

3. **Normalization Layer**
   - Converts all incoming/outgoing messages into internal common format.

4. **Operations Layer**
   - Inbox.
   - Tickets.
   - Tasks.
   - SLAs.
   - Handover.
   - Assets.
   - Automation.
   - AI.
   - Analytics.

5. **Governance and Security Layer**
   - Access control.
   - Audit.
   - Data isolation.
   - Sensitive-data handling.
   - Retention.

### 7.2 Logical Flow

```text
WhatsApp Group / Chat / Official API
        ↓
Gateway Adapter
        ↓
Webhook Ingestion
        ↓
Raw Event Store
        ↓
Message Normalizer
        ↓
Tenant + Channel Resolver
        ↓
Policy Engine
        ↓
Operations Services
        ↓
Agent Dashboard
```

---

## 8. WhatsApp Transport Requirements

## 8.1 Linked-Device Mode

### 8.1.1 Purpose

Linked-device mode must support existing WhatsApp/WhatsApp Business app numbers and chats using QR/pairing-based connection.

### 8.1.2 Supported Use Cases

- Existing client WhatsApp groups.
- Project implementation groups.
- Vendor groups.
- Branch support groups.
- Community/operations groups.
- Low-volume inbound support.
- Group-based ticketing.

### 8.1.3 Functional Requirements

The system must support:

- Connect WhatsApp number through QR/pairing.
- Display QR code in dashboard.
- Show connection status.
- Sync chats and groups.
- Chat sync must create newly discovered groups as unmapped channels and direct chats as active channels.
- Chat sync must archive channels that are no longer returned by the latest live gateway snapshot so stale chats do not remain operational.
- Chat sync must preserve existing channel mappings and active/archived/muted status.
- Chat sync must return a simple report: total chats seen, newly created channels, and refreshed existing channels.
- Sync group members.
- Receive text messages.
- Receive media messages.
- Receive voice notes.
- Receive quoted/replied messages.
- Receive reactions where supported.
- Receive participant add/remove events where supported.
- Send text replies.
- Send media replies.
- Send quoted replies where supported.
- Detect outbound messages sent outside dashboard.
- Handle session disconnect.
- Handle reconnect.
- Handle sync/backlog after reconnect.

### 8.1.4 Supported Gateway Adapters

The platform should keep an adapter boundary, but Core v1 product support is:

- ClarioDesk Gateway adapter as the only Core v1 path, using linked-device primitives under our control.
- Future linked-device adapters only after Clario Gateway is robust and production-proven.
- Evolution API, WAHA, and OpenWA may be studied as references, but they are not user-facing Phase 1 product dependencies.

### 8.1.5 Gateway-Agnostic Adapter Interface

Every adapter must normalize operations such as:

- Connect.
- Disconnect.
- Fetch QR.
- Get health.
- Fetch chats.
- Fetch groups.
- Fetch recent group messages.
- Fetch contacts.
- Send message.
- Send media.
- Download media.
- Receive webhook event.

### 8.1.6 Linked-Device Risk States

Each phone instance must show:

- Connected.
- Disconnected.
- Syncing.
- QR required.
- Rate limited.
- Restricted.
- Possibly banned/unusable.
- Degraded.
- Gateway unavailable.

### 8.1.7 Operational Guardrails

Linked-device mode must enforce:

- Per-number send rate limits.
- Per-group cooldowns.
- No rapid repeated messages.
- No high-volume cold outreach.
- No unsafe bulk sending by default.
- New number warm-up warnings.
- Bulk usage risk warnings.
- Session health monitoring.

---

## 8.2 Official Meta WhatsApp Business Platform Mode

### 8.2.1 Purpose

Official mode must support compliant 1:1 messaging, templates, WhatsApp Flows,
notifications, OTPs, reminders, opt-outs, delivery analytics, and enterprise
communication.

Official mode is part of the full ClarioDesk platform vision, but it must remain a
separate module from the Core v1 customer WhatsApp group support desk. Core support
agents should not need WABA setup, template approval, Flow configuration, or tier
limit details to manage a group support ticket.

Detailed official-module planning lives in:

- `docs/official-whatsapp/official-whatsapp-management.md`

### 8.2.2 Supported Use Cases

- 1:1 customer/client support.
- Business notifications.
- Appointment reminders.
- Payment reminders.
- OTP/authentication messages.
- Utility templates.
- Marketing templates where allowed.
- Formal closure messages.
- Enterprise workflows requiring official channel.
- SaaS/customer-owned Meta account onboarding.
- Structured data collection using WhatsApp Flows.
- Opt-out compliant outbound communication.

### 8.2.3 Functional Requirements

The system must support:

- Meta Cloud API adapter.
- BSP adapter extension.
- Official WhatsApp Management module.
- Embedded Signup / customer-owned Meta account onboarding future.
- WABA and phone-number registry.
- Webhook verification.
- Inbound message reception.
- Outbound message sending.
- Template message sending.
- Template creation/sync/status registry.
- Template status tracking.
- WhatsApp Flows definition/runtime future.
- Flow data-exchange endpoint handling future.
- Opt-out detection and send blocking.
- Message delivery/read status where supported.
- Cost tracking.
- Category tracking.
- Quality/tier/limit visibility where available.
- Per-workspace spend limits.
- Per-client spend limits.

### 8.2.3.1 Official WhatsApp Management Module

The full platform should include a dedicated official-channel module:

```text
Official WhatsApp
  WABA accounts
  Phone numbers
  Templates
  Flows
  Opt-outs
  Official 1:1 conversations
  Bot workflows
  Delivery analytics
  Cost/tier monitoring
  Industry packs
```

This module shares workspaces, clients, contacts, users, audit, webhooks, queues,
notifications, AI/BYOK policies, and reports with ClarioDesk. It should not overload
the Core v1 group inbox.

### 8.2.3.2 Official Module Product Problems

The official module should solve:

- Avoiding BSP/middleman markup where customers can connect their own Meta account.
- Giving SaaS companies a multi-tenant WhatsApp layer for their business clients.
- Managing template lifecycle across clients and phone numbers.
- Handling replies with deterministic and AI-assisted bot workflows.
- Abstracting WhatsApp Flows setup, encryption, and result routing.
- Enforcing opt-outs and outbound compliance.
- Giving visibility into delivery, failures, read status, spend, quality, and limits.
- Shipping industry packs for healthcare, education, logistics, BFSI, and retail.
- Supporting self-hosted deployments where data sovereignty matters.

### 8.2.4 Cost Awareness

Official API routes must show:

- API charges apply.
- Message category.
- Estimated cost when possible.
- Workspace daily/monthly usage.
- Client-wise cost.
- Cost cap warnings.

### 8.2.5 Official Mode Restrictions

The system must clearly show limitations:

- Not intended for existing normal WhatsApp groups unless supported by official API capability.
- Template rules apply for business-initiated messages.
- Cost applies based on Meta/BSP pricing.
- Media limitations may differ.

---

## 8.3 Hybrid Routing

### 8.3.1 Routing Principle

The system must choose transport based on:

- Conversation type.
- Message intent.
- Client configuration.
- Risk level.
- Cost limits.
- Compliance requirements.
- Availability of gateway.
- Fallback policies.

### 8.3.2 Route Decision Examples

| Scenario | Preferred Transport |
|---|---|
| Existing client WhatsApp group support | Linked-device |
| Group message reply | Linked-device |
| Official 1:1 notification | Meta Cloud API |
| OTP/authentication | Meta Cloud API |
| Marketing campaign | Meta Cloud API only |
| WhatsApp Flow form | Meta Cloud API |
| Opt-out-sensitive outbound message | Meta Cloud API with opt-out policy |
| Bulk group broadcast | Linked-device only with strict limits or disabled |
| Ticket closure summary to official contact | Meta Cloud API or email |
| Emergency fallback when linked device down | Official API/email/SMS |

### 8.3.3 Policy Engine Requirements

The policy engine must validate:

- Is route active?
- Is channel a group?
- Is official API allowed?
- Is cost limit exceeded?
- Is cooldown active?
- Is outbound automation allowed?
- Is message stale/backfilled?
- Is user authorized?
- Is media allowed?
- Is AI auto-send allowed?

---

## 9. Workspace and Multi-Tenancy Requirements

### 9.1 Workspace

A workspace represents one organization using the platform.

Requirements:

- Create workspace.
- Configure workspace name/logo/timezone.
- Configure business hours.
- Configure default SLA policies.
- Configure default risk policies.
- Configure AI settings.
- Configure retention policies.

### 9.2 Multi-Tenant Isolation

Every major object must include `workspace_id`.

Objects include:

- Users.
- Teams.
- Clients.
- Projects.
- Contacts.
- Phone instances.
- Channels.
- Groups.
- Messages.
- Media.
- Tickets.
- Tasks.
- Notes.
- Automation rules.
- AI runs.
- Audit logs.
- Analytics events.

### 9.3 Cross-Workspace Phone Collision

The same phone number must be allowed to exist separately in different workspaces.

Unique constraints must be scoped by workspace.

Example:

```text
workspace_id + primary_phone
```

not global `primary_phone` alone.

---

## 10. Client, Project, and Channel Mapping

### 10.1 Client/Project Model

The platform must allow flexible mapping.

A WhatsApp group can be mapped to:

- Client.
- Project.
- Branch.
- Vendor.
- Department.
- Account.
- Community.
- Custom business object.

### 10.2 Channel Registry

Every group/chat must have an internal channel record.

Required fields:

- Channel ID.
- Workspace ID.
- Provider.
- Provider chat/group ID.
- Channel type: group, 1:1, official API, email, etc.
- Display name.
- Linked phone instance.
- Client ID.
- Project ID.
- Status.
- Mapped by.
- Mapping effective date.
- Backfill policy.
- Risk level.
- Allowed actions.
- Fallback channels.

### 10.3 Group Mapping Rules

- One WhatsApp group can map to only one primary client/project at a time.
- One client/project can have multiple groups.
- A group can be archived and remapped only through admin-approved workflow.
- All mappings must be audited.
- A group cannot trigger automation until mapped or explicitly allowed as unmapped.

### 10.4 Unmapped Groups

Unmapped groups must appear in an admin queue.

For unmapped groups:

- Messages can be stored.
- Automation must be disabled.
- SLA must be disabled.
- Agents should not reply unless permitted.
- Admin must map or ignore/archive.

---

## 11. Historical Backfill Requirements

### 11.1 Backfill Principle

Historical messages imported during group mapping or reconnect must be treated as context only, not live operations.

### 11.2 Mapping Boundary

When a group is mapped:

```text
mapping_effective_at = current timestamp
```

Messages before this are historical.

Messages after this are live operational events.

### 11.3 Backfill Policies

Admin must choose one of the following:

1. Start fresh.
2. Import history as read-only context.
3. Import last X days for manual review.
4. Advanced backfill with filters.

### 11.4 Backfilled Message Flags

Backfilled messages must be marked:

- `is_backfill = true`
- `is_live_event = false`
- `automation_suppressed = true`
- `sla_eligible = false`
- `ticket_auto_create_eligible = false`
- `automation_suppressed_reason = historical_backfill`

### 11.5 Backfill Automation Suppression

Backfilled messages must never trigger:

- Auto acknowledgements.
- Out-of-office replies.
- Ticket auto-create.
- SLA timers.
- AI auto-replies.
- Client nudges.
- Notifications.
- Incident alerts.

### 11.6 Backfill Manual Review

The system may generate:

- AI summary.
- Possible unresolved issue suggestions.
- Important document list.
- Unknown participant list.

But users must manually confirm actions.

### 11.7 Backfill Timeline Marker

Chat timeline must show:

```text
Client mapping started here.
Messages above are historical context.
Messages below are live operational events.
```

### 11.8 Backfill Completion Report

After backfill, show:

- Messages imported.
- Date range.
- Participants discovered.
- Unknown participants.
- Media downloaded.
- Media expired.
- Potential unresolved issues.
- Automation triggered: must be zero.
- Tickets auto-created: must be zero unless manually approved.

### 11.9 Reconnection Webhook Storm Handling

When reconnecting after downtime, the system must:

- Detect sync/backlog phase.
- Check provider timestamp.
- Mark old messages as stale/backfill.
- Suppress automation.
- Avoid delayed auto-replies.
- Queue messages with backpressure.
- Preserve history.
- Show sync completion report.

---

## 12. Message Ingestion and Normalization

### 12.1 Raw Event Storage

Every incoming gateway event must be stored in raw form before normalization.

Required fields:

- Workspace ID.
- Phone instance ID.
- Adapter type.
- Provider event ID.
- Raw payload.
- Received timestamp.
- Processing status.
- Error details if any.

### 12.2 Normalized Message Model

Every message must be normalized with:

- Message ID.
- Workspace ID.
- Client ID.
- Project ID.
- Channel ID.
- Conversation type.
- Provider.
- Adapter.
- Mode: linked-device or official.
- Provider message ID.
- Sender contact ID.
- Sender phone.
- Sender display name.
- Direction: inbound/outbound.
- Sent by type.
- Message type.
- Body.
- Media references.
- Quoted message ID.
- Timestamp from provider.
- Ingested timestamp.
- Backfill flags.
- Automation flags.
- Linked ticket ID.

### 12.3 Message Types

The system must support:

- Text.
- Image.
- Video.
- Audio.
- Voice note.
- PDF.
- Excel.
- CSV.
- Word document.
- Location.
- Contact card.
- Link preview.
- Sticker.
- Reaction.
- Poll where supported.
- Deleted message event where supported.
- Edited message event where supported.
- Group participant event.

### 12.4 Idempotency

The system must prevent duplicates using unique keys:

```text
workspace_id + channel_id + provider_message_id
```

If a message arrives from both live webhook and backfill, prefer live classification.

### 12.5 Message Ordering

The system must order messages by provider timestamp but handle out-of-order arrival.

UI must show:

- Actual sent time.
- Ingested time if delayed.
- Delayed/backfilled badge where applicable.

### 12.6 Processing Phases

Message processing phases:

- Raw received.
- Deduplicated.
- Media captured.
- Normalized.
- Tenant resolved.
- Policy evaluated.
- Stored.
- Indexed.
- Realtime broadcast.
- Automation evaluated.
- Analytics recorded.

---

## 13. Media and Asset Vault Requirements

### 13.1 Live Media Capture

For live messages, media must be downloaded immediately and stored in private storage before links expire.

Supported storage:

- S3.
- MinIO.
- Local storage for development.

### 13.2 Media States

Media must have states:

- Pending download.
- Downloaded.
- Download failed retryable.
- Expired/unavailable.
- Quarantined.
- Deleted by retention policy.

### 13.3 Media Metadata

Store:

- Original filename.
- MIME type.
- File size.
- Sender.
- Channel.
- Client/project.
- Linked ticket.
- Uploaded/sent time.
- Storage location.
- Checksum.
- Virus scan status.

### 13.4 Asset Vault

Each client/project must have an asset vault containing all media/documents shared in mapped channels.

Asset vault must support:

- Filter by file type.
- Filter by sender.
- Filter by group.
- Filter by date.
- Search filename/text where possible.
- Link asset to ticket.
- Download with permissions.
- Preview images/PDFs.
- Show expired/unavailable historical media.
- Retention status.

### 13.5 OCR and Document Indexing Future Scope

Later versions may support:

- OCR for images/PDFs.
- Text extraction from PDFs/docs.
- Spreadsheet preview.
- AI document summary.
- Sensitive-data detection inside files.

---

## 14. Contact and Identity Management

### 14.1 Contact Architecture

The system must use three layers:

1. Contact identity.
2. Provider identity.
3. Channel membership.

### 14.2 Contacts

Global within workspace, scoped by workspace.

Fields:

- Contact ID.
- Workspace ID.
- Primary phone.
- Canonical name.
- Email.
- Avatar.
- Global notes.
- Source.
- Verification status.

### 14.3 Contact Identities

Stores identifiers from different platforms.

Fields:

- Contact identity ID.
- Workspace ID.
- Contact ID.
- Provider.
- Provider user ID.
- Phone.
- Source.
- Confidence score.

### 14.4 Channel Memberships

Stores how a contact appears in a specific group/channel.

Fields:

- Membership ID.
- Workspace ID.
- Contact ID.
- Channel ID.
- Client ID.
- Project ID.
- Display name in channel.
- Role in channel.
- Is internal.
- Is client-side.
- Is vendor/third party.
- Is verified.
- Last seen.
- Last name sync.
- Source.

### 14.5 Name Sync Rules

When WhatsApp display name changes:

- Update channel-specific display name.
- Do not automatically update canonical global name.
- Show suggestion to admin/agent.

### 14.6 Internal Contact Detection

System must maintain global workspace agents/internal contacts.

If sender contact matches a workspace user/agent:

- Infer internal status across all groups.
- Do not trigger client-side SLA.
- Treat message as team response or internal activity.

Channel membership can override if necessary.

### 14.7 Ghost Agent Handling

If an outbound message is sent directly from the physical phone or another WhatsApp Web session:

- Ingest message.
- Mark direction as outbound.
- Mark sent_by_type = phone_user or external_device.
- Attribute to virtual agent if exact human unknown.
- Close/stop first-response SLA if applicable.
- Update dashboard timeline.
- Avoid automation loop.

### 14.8 Virtual Agent for Physical Device

Analytics must include a virtual agent:

```text
Physical Device [Phone Name]
```

All unknown physical-device outbound replies must be attributed there.

---

## 15. Group Governance Requirements

### 15.1 Group Member Monitoring

The system must detect where supported:

- Member added.
- Member removed.
- Admin changed.
- Group name changed.
- Group photo changed.

### 15.2 Unknown Member Alerts

When a new unknown member joins a mapped client group:

- Flag group.
- Notify support/admin.
- Mark member unverified.
- Ask admin to approve, ignore, or mark internal/client/vendor.

### 15.3 Allowed Member List

Each client/project group may have:

- Allowed client contacts.
- Allowed internal contacts.
- Allowed vendor contacts.
- Blocked contacts.

### 15.4 Group Naming Policy

The system should support naming patterns such as:

```text
[Client Name] - Support
[Client Name] - Implementation
[Project Name] - Operations
```

Warn if group name does not follow configured pattern.

### 15.5 Group Risk Score

Each group may have risk indicators:

- Unknown members present.
- Too many participants.
- Unmapped participants.
- No assigned owner.
- High message volume.
- No recent support response.
- Sensitive files shared.

---

## 16. Shared Inbox Requirements

The shared inbox must be an operations console, not a generic sales CRM screen.
The strongest reference patterns from Evo CRM and Frappe CRM are:

- A dense three-pane workspace: list/sidebar, timeline, context panel.
- Record-level activity tabs for messages, notes, tickets, media, and audit events.
- Capability-gated channel actions, so unavailable WhatsApp features are hidden or disabled with a clear reason.
- Reply previews and quoted-message navigation.
- Realtime connection and delivery status visible near the work surface.
- Helpful empty states and setup prompts.

Do not copy generic CRM concepts into Core v1 unless they directly serve customer
WhatsApp group support operations.
Sales leads, deals, opportunity pipelines, broad campaign tooling, and visual automation builders are post-v1
or out of scope unless explicitly re-prioritized.

### 16.1 Inbox Views

The dashboard must support:

- All chats.
- My assigned chats.
- Unassigned chats.
- Unread chats.
- High-priority chats.
- Chats with open tickets.
- Unmapped groups.
- Muted/snoozed chats.
- Chats awaiting client.
- Chats awaiting us.

### 16.2 Conversation Panel

Conversation view must show:

- Group/client/project header.
- Transport mode badge.
- Risk/cost badge.
- Phone instance used.
- Realtime connection state.
- Gateway/channel diagnostics when degraded or misconfigured.
- Participant list.
- Messages.
- Media previews.
- Reactions.
- Quoted replies.
- Reply-to preview with click/scroll to original message.
- Backfill marker.
- Mapping/remapping boundary marker.
- Ticket links.
- Private note markers.
- Pinned context.
- Ghost-agent / external-device attribution.
- Deleted-on-WhatsApp marker.

### 16.3 External Reply Box

The external reply box must:

- Be visually distinct from internal notes.
- Show destination clearly.
- Show transport mode.
- Show cost/risk indicator.
- Support text and attachments.
- Support templates/quick replies.
- Support quoted reply where available.
- Show quoted-message preview before send.
- Validate quoted-message access before sending.
- Support 3-second send delay.
- Show countdown and cancel action during the delay.
- Warn for risky/internal wording.
- Prevent sending if route unavailable.
- Be capability-gated by adapter/phone state.
- Support Enter-to-send and Shift+Enter-for-newline only if that behavior is discoverable and configurable.

### 16.4 Internal Notes

Internal notes must:

- Be visually distinct.
- Never go to WhatsApp.
- Support mentions.
- Link to tickets.
- Support file attachments where needed.
- Be audited.

### 16.5 Defensive UI Guardrails

The UI must prevent accidental leaks by:

- External reply and internal note boxes using radically different colors/styles.
- Destination confirmation for sensitive messages.
- 3-second send delay.
- Warning for words like internal, draft, do not share, client difficult, unpaid, escalation, etc.
- Optional approval workflow for high-risk replies.

### 16.6 Realtime Collaboration

The inbox must support:

- Agent online status.
- Typing indicators.
- Conversation lock/claim.
- Duplicate reply warning.
- Live message arrival.
- Live assignment changes.
- Live ticket status changes.

### 16.7 Message Actions

For each message, users can:

- Reply.
- Quote reply.
- Create ticket.
- Link to ticket.
- Add private note.
- Pin message.
- Mark important.
- Add label.
- Copy text.
- Download media.
- Translate future scope.
- Generate summary future scope.

### 16.8 Operator Console Layout

Core v1 should use a focused operator-console layout:

```text
Left rail/sidebar:
  phone health
  clients
  mapped channels
  unmapped groups
  saved/pinned views

Center:
  selected group timeline
  backfill/remap markers
  realtime and delivery state
  safe composer

Right panel:
  channel mapping
  client/project context
  ticket list/detail
  participants/contact identities
  internal notes and audit snippets
```

The right panel should be resizable on desktop and become a drawer/tabbed view on mobile.
The product should remember the last active tab/view for each user where it improves workflow continuity.

### 16.9 Message Rendering Requirements

Message rendering must support:

- Text with safe WhatsApp-style formatting.
- Images, videos, audio, documents, stickers, locations, contact cards, reactions, system messages, and deleted messages.
- Outgoing delivery states: queued, sending, sent, delivered, read, failed, cancelled.
- Failed message badge and retry/cancel affordance where safe.
- Media preview with permission-checked signed URL.
- Time tooltip with full timestamp and user/workspace timezone display.
- System timeline rows for mapping changes, backfill boundaries, ticket creation, assignment changes, and phone/gateway events.

Rendering untrusted message content must use a safe parser/sanitizer. The frontend must not insert raw gateway HTML.

---

## 17. Shift Handover and Context Recovery

### 17.1 Handover Panel

Every client/group must have a “What’s going on?” panel.

It should show:

- Current situation.
- Current owner.
- Pending side: us/client/third party.
- Important pinned messages.
- Latest internal note.
- Open tickets.
- Next action.
- Do-not-send warning if any.
- Last updated by.
- Last updated time.

### 17.2 Handover Note

Agents must be able to create handover notes:

- Summary.
- Pending action.
- Blocker.
- Next owner.
- Expected client response.
- Escalation status.

### 17.3 AI Shift Summary

The system should generate optional summaries:

- Last 30 minutes.
- Last 2 hours.
- Today.
- Since last handover.

AI summary must identify:

- What happened.
- Decisions made.
- Pending action items.
- Who is responsible.
- Important files/screenshots.
- Risk/conflict.

### 17.4 Handover Timeline

The system must maintain handover history.

Fields:

- From agent.
- To agent/team.
- Summary.
- Timestamp.
- Linked tickets.
- Pinned messages.

---

## 18. Ticketing Requirements

### 18.1 Ticket Creation

Tickets can be created from:

- A WhatsApp message.
- Multiple selected messages.
- A media file.
- An AI suggestion.
- A manual form.
- An automation rule.
- An external integration webhook.

### 18.2 Ticket Fields

Required fields:

- Ticket ID.
- Workspace.
- Client.
- Project/channel.
- Source message(s).
- Title.
- Description.
- Category.
- Subcategory.
- Priority.
- Status.
- Assigned team.
- Assigned agent.
- Created by.
- Raised by.
- Due date.
- SLA policy.
- Pending side.
- Tags.
- Attachments.
- Internal notes.
- Public update history.
- Resolution notes.
- Root cause.
- Reopen reason.
- Closed by.
- Closed timestamp.

### 18.3 Ticket Statuses

Default statuses:

- New.
- Acknowledged.
- Need More Info.
- In Progress.
- Pending Client.
- Pending Internal Team.
- Pending Third Party.
- Resolved.
- Closed.
- Reopened.
- Duplicate.
- Cancelled.

Statuses must be customizable per workspace/template.

### 18.4 Ticket Priority

Default priority:

- P1 Critical.
- P2 High.
- P3 Medium.
- P4 Low.

Priority rules must be configurable.

### 18.5 Pending Side

Ticket must track who is blocking progress:

- Us/internal.
- Client.
- Third party/vendor.
- Unknown.

This is important for reverse SLA and nudges.

### 18.6 Ticket Linking

Tickets can be:

- Linked to multiple messages.
- Linked to files.
- Linked to other tickets.
- Marked as duplicate.
- Merged.
- Added to incident.

### 18.7 Ticket Timeline

Every ticket must have a timeline:

- Created.
- Assigned.
- Status changes.
- Priority changes.
- Client updates.
- Internal notes.
- SLA events.
- Linked messages.
- Linked media.
- Closure.
- Reopen.

### 18.8 Manual vs Automatic Tickets

The system must distinguish:

- Manual ticket.
- AI-suggested ticket.
- Automation-created ticket.
- Integration-created ticket.

Auto-created tickets from live messages must follow policy rules.

Backfilled messages must not auto-create tickets by default.

---

## 19. Task Management Requirements

### 19.1 Tasks

Tasks are lightweight work items that may or may not be full tickets.

Task fields:

- Title.
- Description.
- Client/project.
- Linked chat/message.
- Owner.
- Due date.
- Status.
- Checklist.
- Priority.

### 19.2 Task Use Cases

- Follow up with client.
- Ask developer for update.
- Review uploaded document.
- Prepare summary.
- Verify fix.
- Schedule call.

### 19.3 Task Statuses

- Open.
- In Progress.
- Done.
- Cancelled.

---

## 20. SLA and Reverse SLA Requirements

### 20.1 SLA Types

The system must support:

- First response SLA.
- Resolution SLA.
- Update cadence SLA.
- Acknowledgement SLA.
- Reverse/client response SLA.

### 20.2 SLA Eligibility

Only live client-side messages should start SLA.

Messages from internal members should not start client SLA.

Backfilled/stale messages should not start SLA.

### 20.3 SLA Policies

SLA can depend on:

- Priority.
- Client.
- Project.
- Business hours.
- Channel.
- Ticket category.
- Support plan.

### 20.4 Reverse SLA / Client Nudge

When ticket is pending client:

- Start client response timer.
- Notify internal owner when stale.
- Optionally auto-send polite nudge after configured time.
- Apply cooldown to avoid repeated nudges.

### 20.5 SLA Breach Actions

On breach:

- Notify assigned agent.
- Notify team lead.
- Escalate to manager.
- Add audit event.
- Show on dashboard.
- Optional incident creation for P1.

---

## 21. Automation Requirements

### 21.1 Rule Engine

Automation should use:

```text
Trigger → Conditions → Actions
```

### 21.2 Triggers

Supported triggers:

- Message received.
- Message from client-side member.
- Message contains keyword.
- Message with media received.
- Voice note received.
- Ticket created.
- Ticket status changed.
- Ticket assigned.
- SLA nearing breach.
- SLA breached.
- Client pending time exceeded.
- Group member added.
- Phone disconnected.
- Phone reconnected.
- Backfill completed.
- AI classification matched.

### 21.3 Conditions

Conditions:

- Client/project.
- Channel type.
- Message type.
- Sender type.
- Business hours.
- Priority.
- Ticket status.
- Transport mode.
- Is backfill.
- Is live event.
- Cooldown active.
- Cost limit.

### 21.4 Actions

Actions:

- Send acknowledgement.
- Create ticket.
- Suggest ticket.
- Assign ticket.
- Add label.
- Add private note.
- Notify user/team.
- Call webhook.
- Start incident.
- Trigger n8n workflow.
- Generate AI summary.
- Draft reply.
- Send client nudge.
- Mute group temporarily.

### 21.5 Cooldown Rules

Every outbound automation must support cooldown.

Examples:

- OOO message once per group per 12 hours.
- Client nudge once per ticket per 24/48 hours.
- Auto-ack once per issue/thread where possible.

### 21.6 Automation Safety

Automation must not run for:

- Backfill.
- Stale sync messages.
- Internal member chatter unless explicitly configured.
- Unmapped groups.
- Restricted phone instances.
- Rate-limited routes.

---

## 22. AI Requirements

AI must be native to the product plan, but optional at runtime. The app must keep
working when AI is disabled, no provider key is configured, budget is exhausted, or
the selected model provider is unavailable.

Detailed AI/BYOK architecture and frontend behavior live in:

- `docs/ai/ai-native-byok-architecture.md`
- `docs/frontend/16-ai-native-ux.md`

### 22.1 AI Modes

The system must support:

- AI off.
- Suggest only.
- Auto-classify.
- Auto-ack only.
- Auto-reply for approved FAQ only.
- Full auto-reply for selected channels only.

Default must be suggest only.

### 22.1.1 AI-Native Product Principle

AI should assist across the full product:

- Inbox catch-up, urgency explanation, and noise/storm detection.
- Message classification, translation, summarization, and sensitive-data warnings.
- Composer suggested replies, rewrites, tone adjustment, and risk checks.
- Ticket title, priority, owner, next-action, field extraction, and closure summary.
- Voice transcription, OCR, document/media summaries, and attachment risk review.
- Search query interpretation and semantic search.
- Automation rule suggestions and dry-run explanations.
- Reports, trend summaries, and SLA risk drivers.

AI must not become the only path to perform a task. Every AI feature needs a manual
fallback.

### 22.1.2 BYOK Requirements

The platform must support BYOK for AI providers.

Admin requirements:

- Add, test, rotate, and delete provider API keys.
- Choose provider and model globally.
- Override provider/model by feature where needed.
- Configure monthly workspace budget.
- Configure per-feature token/cost limits.
- Enable or disable each AI feature.
- Configure data redaction and retention policy.
- View provider health and last test result.
- View AI audit logs.

Security requirements:

- Provider keys must be encrypted at rest.
- Provider keys must never be returned to the browser after save.
- Provider keys must never be logged.
- Provider keys must be scoped to workspace.
- Key management must require explicit admin permission.
- Provider failures must degrade gracefully.

Supported provider strategy:

```text
P2/P3: external BYOK providers through a provider abstraction
P4: local/self-hosted model providers and enterprise routing policies
```

### 22.2 AI Triage

AI should classify messages as:

- Issue.
- Request.
- Complaint.
- Follow-up.
- Escalation.
- Approval.
- Information.
- Casual chatter.
- Thank you/closure.
- Internal coordination.
- Noise.

### 22.3 AI Priority Detection

AI should suggest priority:

- Critical.
- High.
- Medium.
- Low.

It must explain why.

### 22.4 AI Suggested Replies

AI can draft replies based on:

- Message content.
- Ticket context.
- Client/project info.
- Knowledge base.
- Previous internal notes.
- Current pending side.

Agent approval required by default.

### 22.5 Voice Note Transcription

When voice note arrives:

- Download audio.
- Transcribe.
- Generate short summary.
- Allow ticket creation from transcript.
- Link transcript to original audio.
- Mark transcript as AI-generated and editable.

### 22.6 Thread Summary

AI should generate:

- Last X messages summary.
- Last X hours summary.
- Ticket-specific summary.
- Shift handover summary.
- Client weekly summary.

### 22.7 Noise Detection

AI may detect casual client-side chatter.

Initial mode must be suggest/silence only, not destructive.

### 22.8 Sensitive Data Detection

AI/rule engine should detect:

- Phone numbers.
- Email addresses.
- IDs.
- Payment details.
- Credentials.
- API keys.
- Contracts.
- Invoices.
- Patient/student/customer data depending on template.

Warn before external sharing/export.

### 22.9 AI Context Isolation

AI retrieval must always filter by:

- Workspace.
- Client/project.
- Permission scope.

AI must never use one client’s private context to answer another client.

### 22.10 AI Audit

Every AI action must be logged:

- Input context references.
- Model/provider.
- Provider connection, prompt version, and feature key.
- Output.
- Tokens, estimated cost, latency, and status.
- Whether accepted/edited/rejected.
- Agent who sent final reply.
- Redaction profile and policy decisions.

### 22.11 AI Permissions

AI permissions must be separated:

- Manage AI provider keys.
- Manage AI budgets and policies.
- Run AI suggestions.
- Apply AI suggestions to drafts/tickets.
- Approve AI-generated external replies.
- View AI audit logs.
- Export AI audit evidence.

An agent who can use suggested replies should not automatically be allowed to view
provider keys, change budgets, or approve autonomous replies.

### 22.12 AI Context And Retrieval Rules

AI context must obey the same boundaries as normal APIs:

- Workspace.
- Client/project.
- Channel.
- Ticket.
- User permission scope.
- Retention policy.
- Data residency policy when available.

Retrieval and semantic search must filter by scope before ranking. AI must never use
one client's private context to answer another client's group.

### 22.13 Prompt-Injection And Untrusted Input

WhatsApp messages, attachments, filenames, transcripts, and client-provided text are
untrusted data. The system must treat them as content to analyze, not instructions
to follow.

Required controls:

- Server-owned prompts and policies.
- Schema validation for structured AI output.
- No direct model access to external-send actions.
- No model ability to bypass permissions, send delay, or routing policies.
- Detection of output that asks to reveal secrets or ignore policy.
- Redaction before provider calls where configured.

### 22.14 AI Budget And Failure UX

AI features must expose clear states:

- Disabled by policy.
- No provider configured.
- Budget exceeded.
- Queued.
- Generating.
- Ready.
- Failed.
- Redacted/blocked by policy.

The UI must not wait indefinitely for AI. Operators must be able to continue normal
work while AI jobs run or fail.

### 22.15 AI Output Ownership

AI-generated content must be marked as AI-generated until a user accepts or edits it.
When AI output becomes an external reply, ticket field, internal note, automation
rule, or report annotation, the final action must retain a link to the AI suggestion
for audit.

---

## 23. Smart Noise Suppression Requirements

### 23.1 Manual Snooze

Agents can snooze:

- Group for 15/30/60 minutes.
- Specific thread.
- Non-urgent alerts.

### 23.2 AI-Assisted Noise Filter

AI can classify client-to-client internal chatter.

If configured:

- Suppress notifications.
- Do not create tickets.
- Do not trigger SLA.
- Keep messages visible in timeline.

### 23.3 Tag/Keyword Override

Even if snoozed, alert if message contains:

- Urgent.
- Down.
- Broken.
- Not working.
- Escalate.
- Support team tag.
- Custom keywords.

---

## 24. Incident Mode Requirements

### 24.1 Incident Creation

Incidents can be created:

- Manually.
- From P1 ticket.
- From automation.
- From AI suggestion.

### 24.2 Incident Fields

- Incident ID.
- Title.
- Client/project.
- Severity.
- Status.
- Incident commander.
- Internal team.
- Linked tickets.
- Linked messages.
- Start time.
- Impact.
- Updates.
- RCA.
- Closure time.

### 24.3 Incident Workflow

Statuses:

- Open.
- Investigating.
- Mitigating.
- Monitoring.
- Resolved.
- Closed.

### 24.4 War Room

System should support internal incident view:

- Timeline.
- Internal notes.
- Actions.
- Owners.
- Client update drafts.
- Update reminders.

### 24.5 RCA Requirement

For selected severity levels, ticket/incident cannot close without:

- Cause.
- Resolution.
- Preventive action.
- Owner.

---

## 25. Notifications Requirements

Notifications are a core workflow, not a later mobile-only feature. Until native
mobile apps ship, the web app must support foreground realtime notifications and
background Web Push notifications where the browser/platform allows it.

Detailed notification architecture and frontend UX live in:

- `docs/notifications/realtime-and-web-push.md`
- `docs/frontend/17-notifications-and-pwa.md`

### 25.1 Notification Channels

Support notifications through:

- In-app.
- Web Push/PWA.
- Browser tab badge/title.
- Email.
- Slack/Teams future.
- WhatsApp internal group future.
- Webhook.

### 25.2 Notification Events

Notify for:

- New assigned ticket.
- SLA breach.
- P1 incident.
- Mention in internal note.
- Phone disconnected.
- Unknown member added.
- Backfill completed.
- Automation failure.
- Cost limit approaching.
- Failed outbound send.
- Mapping review needed.
- Gateway/queue degraded.
- Assigned-channel message needing reply.

### 25.2.1 Notification Event Priority

Notification events must carry priority:

- Critical: P1 incident, SLA breach, phone disconnected for active operations.
- High: assigned-channel message needing reply, failed outbound send, mention.
- Medium: assigned ticket, mapping review, backfill complete with warnings.
- Low: informational sync complete, digest-ready events.

Priority affects realtime emphasis, Web Push eligibility, quiet-hours bypass rules,
and digest behavior.

### 25.3 Notification Preferences

Users can configure:

- Channels.
- Frequency.
- Quiet hours.
- Client/project subscriptions.
- Preview privacy level.
- Per-device push subscriptions.
- Per-event enable/disable controls where policy allows.

### 25.4 Realtime Notifications

When the web app is open, notifications should arrive through the realtime layer.

Requirements:

- Permission-scoped rooms/events.
- No global fanout of private client content.
- Deep link to exact channel, message, ticket, or setting.
- Reconcile missed notifications after reconnect.
- Show realtime connection health in the UI.
- Do not treat realtime as the source of truth; fetch authoritative state from API.

### 25.5 Web Push / PWA Notifications

The system must support Web Push where available.

Requirements:

- Service worker registration.
- Push subscription management per user/device.
- VAPID key configuration.
- Permission request only after explicit user action.
- Device list and revoke controls.
- Test notification flow.
- Notification click handling with deep links.
- Browser/platform unsupported state.
- iOS/iPadOS Home Screen web app guidance.

Default push payloads should minimize sensitive content because notifications can
appear on lock screens and shared desktops.

### 25.6 Push Notification Actions

Web Push notifications should support action buttons where the platform allows.

Allowed actions:

- Reply: open/focus app with external composer active.
- Add note: open/focus app with internal note composer active.
- Open ticket.
- Assign to me where policy allows.
- Mark notification read.
- Mute channel for 1 hour.

External WhatsApp replies must not be sent directly from a web notification by
default. The normal composer must run destination, mapping, route, send delay,
sensitive-data, and audit checks.

### 25.7 Notification Privacy

Notification preview levels:

- Private: generic alert only.
- Standard: client/channel and event type.
- Full preview: sender/message excerpt where admin policy and user preference allow.

No notification may include content from a client/project/channel the user cannot
access at delivery time.

### 25.8 Notification Delivery Audit

The system must record:

- Event id.
- Recipient user.
- Delivery channel.
- Device/subscription where applicable.
- Status.
- Error code.
- Delivered/clicked/action timestamps.
- Action taken.
- Suppression reason.

### 25.9 Notification Rate Limits And Digests

Notifications must avoid becoming noise.

Controls:

- Per-user quiet hours.
- Per-channel mute.
- Per-event cooldown.
- Storm bundling.
- Digest mode for low-priority events.
- Critical event bypass rules controlled by admin policy.

---

## 26. Templates and Quick Replies

### 26.1 Quick Replies

Agents can insert saved replies.

Quick replies can be scoped by:

- Workspace.
- Team.
- Client.
- Category.
- Status.

### 26.2 Template Variables

Templates must support variables:

- Client name.
- Agent name.
- Ticket ID.
- Ticket status.
- Due date.
- Pending side.
- Custom fields.

### 26.3 Transport-Specific Templates

Official API templates must be treated separately from internal quick replies.

Official template management must include:

- Template name.
- Language.
- Category.
- Approval status.
- Variables.
- Cost category.

---

## 27. Bulk and Scheduled Messaging Requirements

### 27.1 Bulk Messaging Philosophy

The platform must not position itself as a spam/bulk marketing tool.

Bulk should be controlled and operations-oriented.

### 27.2 Bulk Use Cases

- Send update to multiple project groups.
- Notify clients of planned downtime.
- Send implementation reminder.
- Send document request.

### 27.3 Bulk Safety

Bulk sending must enforce:

- Approval workflow.
- Rate limits.
- Random delays for linked-device mode.
- Per-number quotas.
- No repeated identical spam patterns.
- Risk warning.
- Official API preferred for marketing.
- Audit log.

### 27.4 Scheduled Messages

Users can schedule:

- One-time messages.
- Recurring reminders.
- Follow-up nudges.
- Client status updates.

Scheduled messages must respect:

- Business hours.
- Cooldowns.
- Route availability.
- Cost/risk policy.

---

## 28. Search Requirements

### 28.1 Global Search

Search across:

- Messages.
- Tickets.
- Contacts.
- Groups.
- Files.
- Notes.
- Tasks.

### 28.2 Scoped Search

Search must be scoped by:

- Workspace.
- Client.
- Project.
- Channel.
- User permissions.

### 28.3 Search Filters

Filters:

- Date range.
- Sender.
- File type.
- Ticket status.
- Priority.
- Message type.
- Label.
- Backfill/live.
- Has media.
- Has ticket.

### 28.4 Search Privacy

No user should see search snippets from clients/projects they cannot access.

---

## 29. Analytics and Reporting Requirements

### 29.1 Dashboard Metrics

Show:

- Total messages.
- Incoming messages.
- Outgoing messages.
- Open tickets.
- Resolved tickets.
- SLA breaches.
- Average first response time.
- Average resolution time.
- Client pending count.
- Unassigned tickets.
- Active incidents.
- Phone uptime.
- API cost.

### 29.2 Client/Project Analytics

Show per client/project:

- Message volume.
- Ticket volume.
- Top categories.
- SLA performance.
- Pending issues.
- Repeat issues.
- Media shared.
- Active participants.

### 29.3 Agent Analytics

Show:

- Replies sent.
- Tickets assigned.
- Tickets resolved.
- Average response time.
- Workload.
- Physical device responses as virtual agent.

### 29.4 Group Analytics

Show:

- Most active groups.
- Noisy groups.
- Groups with unknown members.
- Groups with pending tickets.
- Groups with high SLA risk.

### 29.5 Transport Analytics

Show:

- Linked-device uptime.
- Disconnect events.
- Reconnects.
- Message failures.
- Rate-limit warnings.
- Official API usage/cost.
- Adapter health.

### 29.6 Export Reports

Allow export to:

- CSV.
- Excel future.
- PDF future.
- API.

---

## 30. Security and Compliance Requirements

### 30.1 Authentication

Support:

- Email/password.
- Magic link optional.
- OAuth optional.
- SSO/SAML enterprise future.

### 30.2 Authorization

Role-based access control:

- Super Admin.
- Workspace Admin.
- Team Lead.
- Agent.
- Developer/Internal Escalation.
- Viewer.
- Auditor.
- Client Portal User future.

### 30.3 Permission Scopes

Permissions must control:

- View messages.
- Send external replies.
- Add internal notes.
- Create tickets.
- Assign tickets.
- Close tickets.
- Export data.
- Download media.
- Manage contacts.
- Manage group mappings.
- Manage phone connections.
- Manage automations.
- Manage AI.
- View audit logs.

### 30.4 Audit Logs

Log:

- Login/logout.
- Message viewed.
- External reply sent.
- Internal note added.
- Ticket created/updated/closed.
- Assignment changed.
- Group mapped/unmapped.
- Contact updated.
- Media downloaded.
- Export generated.
- Automation run.
- AI suggestion generated.
- Phone connected/disconnected.
- Settings changed.

### 30.5 Data Retention

Configurable retention:

- Messages.
- Media.
- Raw events.
- Tickets.
- Audit logs.
- AI runs.

### 30.6 Sensitive Data Protection

Support:

- Sensitive content detection.
- Warning before forwarding/exporting.
- Masking in reports.
- Restricted file downloads.
- Watermarked exports future.
- Data deletion request handling.

### 30.7 Gateway Session Security

For linked-device sessions:

- Encrypt session tokens at rest.
- Restrict gateway API access.
- Rotate internal keys.
- Do not expose gateway publicly without authentication.
- Audit reconnect/logout.

### 30.8 Official API Security

For Meta/BSP:

- Secure token storage.
- Webhook signature verification.
- Access token rotation.
- Cost abuse prevention.

---

## 31. Integration Requirements

### 31.1 Webhooks

Support outgoing webhooks for:

- Message received.
- Ticket created.
- Ticket updated.
- SLA breached.
- Incident created.
- Media uploaded.
- Contact created.

### 31.2 Public API

Provide REST API for:

- Clients/projects.
- Contacts.
- Channels.
- Messages.
- Tickets.
- Tasks.
- Notes.
- Media.
- Automations.
- Analytics.

### 31.3 API Keys

Support:

- Workspace API keys.
- Scoped permissions.
- Expiry.
- Rotation.
- Audit.

### 31.4 Integrations

Future/optional integrations:

- Jira.
- GitHub Issues.
- Linear.
- Freshdesk.
- Zoho Desk.
- HubSpot.
- Salesforce.
- Slack.
- Microsoft Teams.
- Google Sheets.
- Google Calendar.
- Email.
- n8n.
- Zapier.
- MCP tools.

### 31.5 Plugin System

Long-term product should support plugins for:

- Ticket sync.
- Custom actions.
- AI tools.
- External lookup.
- Custom dashboards.

---

## 32. Admin and Settings Requirements

### 32.1 Workspace Settings

Admin can configure:

- Workspace name/logo.
- Timezone.
- Business hours.
- Default SLA.
- Retention policy.
- Default AI mode.
- Default route policy.

### 32.2 Phone Management

Admin can:

- Connect phone.
- View QR.
- Reconnect.
- Disconnect.
- Rename phone.
- Assign phone to clients/teams.
- View status/logs.
- Configure send limits.

### 32.3 Client/Project Management

Admin can:

- Create client/project.
- Map groups.
- Archive client/project.
- Configure client-specific SLA.
- Configure custom fields.
- Configure fallback channels.

### 32.4 Team Management

Admin can:

- Invite users.
- Assign roles.
- Assign teams.
- Link user to contact/phone.
- Deactivate users.
- Configure access to clients/projects.

### 32.5 Automation Settings

Admin can:

- Create/edit/delete rules.
- Enable/disable rules.
- Test rules.
- View automation logs.

### 32.6 AI Settings

Admin can:

- Choose provider.
- Configure API key.
- Rotate/delete API key.
- Test provider connection.
- Choose model.
- Configure model per feature.
- Configure monthly budget and per-feature limits.
- Configure redaction and retention profile.
- Enable local model future.
- Configure AI mode per client/channel.
- Configure knowledge base.
- View AI audit logs.
- View provider health and cost usage.

---

## 33. Custom Fields and Templates

### 33.1 Custom Fields

Users can define custom fields for:

- Client.
- Project.
- Contact.
- Channel.
- Ticket.
- Task.

Field types:

- Text.
- Number.
- Date.
- Dropdown.
- Multi-select.
- Checkbox.
- User/team.
- URL.
- File.

### 33.2 Industry Templates

The platform should ship with templates:

- SaaS support.
- Implementation projects.
- Healthcare/HIMS support.
- Logistics operations.
- Education support.
- Real estate operations.
- Agency client service.
- Franchise support.

Each template may include:

- Statuses.
- Categories.
- Custom fields.
- SLA rules.
- Quick replies.
- AI prompts.
- Dashboards.

---

## 34. User Experience Requirements

### 34.1 First-Time Setup

Onboarding wizard:

1. Create workspace.
2. Invite team.
3. Connect WhatsApp number.
4. Sync groups.
5. Map first group to client/project.
6. Create first ticket.
7. Configure basic SLA.
8. Configure quick reply.

### 34.2 Empty States

Helpful empty states for:

- No phone connected.
- No groups synced.
- No mapped groups.
- No tickets.
- No automation rules.

### 34.3 Risk Transparency

UI must clearly show:

- Linked-device mode: no Meta API fee, but higher operational risk.
- Official API mode: charges apply, lower session risk.
- Disconnected state.
- Sync delay.
- Stale message.
- Backfilled message.

### 34.4 Accessibility

UI should support:

- Keyboard navigation.
- Clear contrast.
- Screen reader labels where possible.
- Responsive layout.

---

## 35. Failure Handling Requirements

### 35.1 Gateway Disconnect

When linked-device phone disconnects:

- Mark disconnected.
- Stop outbound automation.
- Alert admins.
- Show last sync time.
- Show reconnect instructions.
- Allow fallback route if configured.

### 35.2 Gateway Reconnect

On reconnect:

- Detect backlog.
- Mark old messages stale/backfill.
- Suppress automation.
- Download available media.
- Produce sync report.

### 35.3 Media Download Failure

If media fails:

- Retry with backoff.
- Mark retryable.
- Mark expired if no longer available.
- Show clear status in UI.

### 35.4 Send Failure

If message send fails:

- Show failed state.
- Allow retry.
- Show adapter error.
- Do not mark as delivered.
- Log audit.

### 35.5 Queue Backpressure

If queues are overloaded:

- Prioritize live messages.
- Pause backfill.
- Pause AI jobs.
- Continue storing raw events.
- Alert admins.

### 35.6 Official API Cost Limit Exceeded

If cost limit reached:

- Block non-critical official sends.
- Alert admin.
- Allow override by authorized user.

---

## 36. Non-Functional Requirements

### 36.1 Performance

- Live message should appear in dashboard within 1–3 seconds under normal conditions.
- Message send action should show optimistic pending state immediately.
- Search should return results within reasonable time for workspace-level data.
- Backfill jobs must not degrade live inbox.

### 36.2 Scalability

Architecture must support:

- Multiple workspaces.
- Multiple connected phones per workspace.
- Hundreds of groups.
- Millions of messages over time.
- Large media storage.
- Horizontal workers.

### 36.3 Reliability

- Raw events must be persisted before processing.
- Processing must be retryable.
- Jobs must be idempotent.
- Backfills must be resumable.
- Gateway nodes must be isolated from core app.

### 36.4 Observability

System must expose:

- Application logs.
- Gateway logs.
- Queue metrics.
- Message processing metrics.
- Error rates.
- Adapter health.
- Webhook processing latency.
- Send success/failure.

### 36.5 Deployment

Initial deployment must support:

- Docker Compose.
- Environment-based configuration.
- PostgreSQL.
- Redis.
- S3/MinIO.
- Optional gateway containers.

Future:

- Kubernetes Helm chart.
- Managed cloud.
- Multi-region future.

---

## 37. Suggested MVP Phases

### 37.1 MVP 0 — Gateway Proof

Goal: prove WhatsApp group sync and reply.

Features:

- Connect one linked-device number.
- Sync groups.
- Receive group messages.
- Send text reply.
- Store raw and normalized messages.
- Basic phone status.

### 37.2 MVP 1 — Operations Inbox

Features:

- Workspace login.
- Group list.
- Client/project mapping.
- Real-time inbox.
- External reply.
- Internal notes.
- Message actions.
- Media capture.
- Basic asset vault.
- Defensive UI guardrails.
- Basic audit.

### 37.3 MVP 2 — Ticketing and Handover

Features:

- Create ticket from message.
- Ticket list.
- Ticket side panel.
- Status/priority/owner.
- Pinned context.
- Handover note.
- Pending side.
- Basic SLA.

### 37.4 MVP 3 — Automation and Governance

Features:

- Auto acknowledgement.
- OOO cooldown.
- SLA alerts.
- Client nudges.
- Unknown member alerts.
- Rule engine.
- Daily digest.

### 37.5 MVP 4 — AI Assist

Features:

- Voice transcription.
- Thread summary.
- AI ticket draft.
- Suggested reply.
- Sensitive data warning.
- Noise detection.

### 37.6 MVP 5 — Hybrid Official API

Features:

- Meta Cloud API adapter.
- Official 1:1 conversations.
- Template support.
- Cost tracking.
- Route policy engine.
- Fallback routing.
- Opt-out blocking.
- Delivery/read status sync.

### 37.6.1 MVP 5B — Official WhatsApp Management Module

Features:

- WABA/phone registry.
- Embedded Signup future.
- Template lifecycle management.
- WhatsApp Flows builder/runtime future.
- Bot workflow engine.
- Industry packs.
- Delivery, quality, tier, and cost dashboards.
- SaaS/customer-owned Meta account management.

### 37.7 MVP 6 — Enterprise Readiness

Features:

- Advanced RBAC.
- SSO.
- Advanced audit.
- Advanced analytics.
- Plugin system.
- Enterprise deployment.
- Compliance tools.

---

## 38. Acceptance Criteria Summary

The platform is considered successful when:

- Admin can connect a WhatsApp number.
- Groups sync into the system.
- Admin can map a group to a client/project.
- Agents can view messages in real time.
- Agents can safely reply from dashboard.
- Agents can add internal notes without risk of external send.
- Agents can create tickets from messages.
- Tickets can be assigned, tracked, and closed.
- SLA starts only for eligible live client messages.
- Backfilled messages do not trigger automation.
- Media is captured before expiration for live messages.
- Physical phone replies appear in dashboard and affect SLA.
- Group member changes are visible.
- Client/project isolation is enforced.
- Audit logs capture important actions.
- System can survive reconnect/backfill without spamming clients.

---

## 39. Competitive Differentiators

The product should differentiate through:

- Open-source core.
- Self-hosted deployment.
- Gateway-agnostic design.
- Hybrid linked-device + official API architecture.
- Group-first operations model.
- Client/project isolation.
- Shift handover.
- Defensive reply guardrails.
- Asset vault.
- Group governance.
- Reverse SLA.
- Incident mode.
- AI assist with guardrails.
- Transparent cost/risk UI.

---

## 40. Final Requirement Statement

The product must become the open-source customer support desk for WhatsApp groups.
It must allow organizations to manage multiple clients, projects, branches, or
vendors without losing issues, losing context, leaking data, missing ownership, or
depending on a single WhatsApp transport.

The first release must solve the most painful workflow:

```text
Customer WhatsApp group message
→ mapped to client/project
→ visible in shared support inbox
→ safe agent reply or private note
→ ticket created from message
→ owner assigned and status tracked
→ basic SLA/pending side visible where enabled
→ context preserved for next shift
→ media saved in asset vault
→ full audit maintained
```

If this workflow is reliable, the product becomes immediately useful even before advanced AI or official API support.

---

## 41. Appendix: Key Business Rules

1. Historical messages must not trigger live automation.
2. SLA must use provider timestamp, not ingestion timestamp.
3. Backfill must be low-priority compared to live messages.
4. AI context must be scoped by workspace and client/project.
5. WhatsApp display names must be stored as channel aliases, not global truth.
6. Physical phone replies must be treated as outbound team replies.
7. Linked-device bulk sending must be restricted by default.
8. External reply and internal note UI must be visually distinct.
9. Media from live messages must be downloaded immediately.
10. Every external send must be auditable.
11. Every group must have a mapping boundary.
12. Every route must show risk/cost to the user.
13. Unmapped groups must not trigger operations.
14. Unknown group members must be flagged.
15. Client/project search results must never leak across boundaries.

---

## 42. Appendix: Glossary

**Workspace:** Organization using the platform.  
**Client:** External customer/account/vendor/project owner.  
**Project:** Optional sub-unit under client.  
**Channel:** Internal representation of group/chat/API conversation.  
**Linked-device mode:** WhatsApp Web-style QR connection.  
**Official API mode:** Meta WhatsApp Business Platform / BSP route.  
**Backfill:** Historical message import.  
**Live event:** New operational message eligible for SLA/automation.  
**Ghost Agent:** Human replying directly from phone/outside dashboard.  
**Asset Vault:** Client/project file repository generated from WhatsApp media.  
**Reverse SLA:** Tracking time waiting for client response.  
**Incident Mode:** Critical issue workflow with timeline, owner, RCA.  
**Transport:** Message delivery mechanism.  
**Operations Layer:** Inbox/ticket/SLA/automation/analytics logic.  



---

# Addendum: Enterprise Operational Hardening Requirements

## A. User Session Access Control and Visibility Model

### A.1 Principle
Access control must follow a strict least-privilege model. If an agent is assigned to Client A, Client B's groups, tickets, messages, contacts, attachments, analytics, and search results must be completely hidden by default.

Default rule:

```text
No assignment = no visibility.
```

Read-only cross-client visibility must be explicitly granted through coverage roles, temporary access windows, or emergency/incident permissions. It must never be the default.

### A.2 Access Modes
The platform must support the following access modes:

| Access Mode | Description | Use Case |
|---|---|---|
| No Access | User cannot see the client/project/group at all | Default for unrelated clients |
| Assigned Agent | User can view, reply, create tickets, update tickets | Normal support ownership |
| Read-only Coverage | User can view messages/tickets but cannot send client-facing replies | Backup/shift coverage |
| Temporary Coverage | Time-bound access for a specific client/group/project | Leave, night shift, temporary escalation |
| Escalation Access | User can access specific ticket/incident only | Developer/DBA/infra escalation |
| Admin Access | Full workspace-level visibility | Support admins and owners |
| Auditor Access | Read-only access to messages, tickets, audit logs | Compliance/internal audit |

### A.3 Sidebar Visibility
Agents must only see groups they are allowed to access.

Requirements:

```text
Hide unauthorized clients/groups from sidebar
Hide unauthorized groups from unread counts
Hide unauthorized groups from global notifications
Hide unauthorized groups from global search
Hide unauthorized client names from analytics unless permission exists
```

### A.4 Global Search Security
Global search must enforce workspace, client, project, and channel permissions at query time.

Required behavior:

```text
Unauthorized messages must not appear even as snippets
Unauthorized attachment names must not appear
Unauthorized contact aliases must not appear
Unauthorized ticket titles must not appear
Search result counts must not reveal hidden data volumes
```

### A.5 Coverage Workflow
Admins and leads can grant temporary read-only or full coverage.

Fields:

```text
coverage_id
workspace_id
client_id
project_id
channel_id
user_id
access_level
reason
starts_at
expires_at
granted_by
revoked_by
status
```

Access expiration must automatically revoke permissions and remove sidebar visibility.

### A.6 Emergency Break-Glass Access
The platform may support emergency access, but it must be heavily audited.

Requirements:

```text
User must provide reason
Access duration must be limited
Admins must be notified
All viewed messages/attachments must be audited
Break-glass report must be generated
```

### A.7 Internal Escalation Users
Developers/DBAs/infra users should not receive full group visibility by default. They should see only the ticket context and selected messages/media shared for escalation.

Default:

```text
Escalation user sees ticket + linked evidence only
Escalation user cannot browse full client group history unless granted
Escalation user cannot send WhatsApp replies unless explicitly permitted
```

---

## B. Storage Lifecycle and Data Retention Hardening

### B.1 Raw Event Storage
Raw gateway payloads must not be stored as large JSON blobs inside PostgreSQL by default.

Required design:

```text
PostgreSQL stores operational metadata only
S3/MinIO stores compressed raw payload object
raw_payload_ref points to object storage path
```

Metadata table (canonical schema is TDD §6.13 `raw_event_refs`; this is the same table — keep the name and columns aligned with the TDD):

```text
raw_event_refs
--------------
id
workspace_id
provider
adapter_type
provider_event_id
phone_instance_id
channel_id
event_type
provider_timestamp
received_at
compressed_size_bytes
sha256_hash
object_key
retention_until
processing_status
created_at
```

Object storage path:

```text
raw-events/{workspace_id}/{yyyy}/{mm}/{dd}/{event_id}.json.gz
```

### B.2 Raw Event Retention
Default raw payload retention should be short.

Recommended defaults:

```text
Raw payloads: 7-14 days
Normalized messages: 90-180 days
Media/assets: policy-based
Ticket metadata: long-term
Audit logs: 1-3 years
Analytics aggregates: long-term
```

### B.3 Soft Purges With Context Decoupling
Message retention must not destroy ticket history.

If an expired message is not linked to a ticket:

```text
Hard delete message body and metadata according to policy
```

If an expired message is linked to a ticket:

```text
Preserve metadata shell
Remove body/media/raw refs if required
Replace visible content with placeholder
Keep sender, timestamp, direction, channel, ticket linkage
```

Placeholder:

```text
[Message contents purged by workspace retention policy]
```

### B.4 Delete for Everyone Handling
If an external WhatsApp user deletes a message after it has already been ingested:

```text
Update message WhatsApp status to deleted_by_sender
Show UI badge: This message was deleted by the sender on WhatsApp
Do not destructively delete active ticket evidence automatically
Retain internal captured content according to workspace compliance policy
Audit the deletion event
```

### B.5 Media Lifecycle States
Media records must support these states:

```text
pending_download
downloaded
expired_unavailable
download_failed_retryable
deleted_by_retention
quarantined
restricted
```

### B.6 Storage Health Dashboard
Admins must see:

```text
Database size
Object storage size
Raw event storage size
Media storage size
Largest clients/groups by storage
Retention policy impact estimate
Purge job status
Failed purge jobs
Expired media count
```

---

## C. Virtual Threading Inside WhatsApp Groups

### C.1 Problem
A single WhatsApp group often contains multiple parallel topics. The platform must help agents manage these as separate operational threads without changing the actual WhatsApp group structure.

### C.2 Virtual Thread Model
A virtual thread is an internal topic cluster inside one WhatsApp group.

Fields:

```text
virtual_threads
---------------
id
workspace_id
channel_id
client_id
project_id
title
summary
status
priority
root_message_id
last_message_id
linked_ticket_id
created_by: ai | user | rule
confidence_score
created_at
updated_at
```

### C.3 Thread Detection
The system should support:

```text
Manual create thread from message
AI-suggested topic clustering
Rule-based thread creation from keywords
Merge threads
Split thread
Close thread
Convert thread to ticket
```

### C.4 WhatsApp Reply Behavior
When an agent replies to a virtual thread, the platform should send the WhatsApp message as a quoted reply to the most relevant/root message.

Requirements:

```text
Default quote root message
Allow quote latest message
Allow no quote
Show preview before sending
```

### C.5 UI
In the dashboard, a group can be viewed as:

```text
Raw timeline
Virtual threads
Ticket-linked messages
Unassigned messages
```

---

## D. Shared Draft Collaboration / Stealth Mode

### D.1 Purpose
Agents must be able to prepare responses internally before sending anything to the WhatsApp group.

### D.2 Draft States

```text
draft
under_review
approved
sent
rejected
expired
cancelled
```

### D.3 Requirements

```text
Create draft reply for a group/thread/ticket
Collaborative editing by multiple internal users
Mention reviewer
Require approval for selected groups/clients/priority levels
Track draft history
Show who edited what and when
Only send after explicit approval
```

### D.4 Approval Rules
Approval may be required when:

```text
Client is marked high-touch
Ticket priority is P1/P2
Agent is junior/new
Message contains sensitive terms
Message is generated by AI
Message includes attachment/media
Message uses official API paid route over cost threshold
```

---

## E. Outbound Voice Notes With Verification

### E.1 Requirements
Agents should be able to record outbound voice notes from the dashboard.

Before sending:

```text
Transcribe audio internally
Run sensitive-data/PII scan
Show transcript to agent
Require confirmation before send
Store audio + transcript
Link to ticket/thread
```

### E.2 Send Modes

```text
Send as native WhatsApp audio/voice note if gateway supports it
Fallback to audio file attachment
Fallback to text transcript if audio send fails
```

### E.3 Compliance

```text
Outbound audio must be searchable through transcript
Transcript must be retained according to message retention policy
Audio must follow media retention policy
```

---

## F. Channel Deprovisioning / Group Offboarding

### F.1 Purpose
When a project/client relationship ends, the WhatsApp group must be safely closed or archived.

### F.2 Offboarding Workflow

```text
Mark group as pending archive
Generate closure summary
Send final group message if enabled
Export tickets/messages/assets if required
Remove or warn internal team members
Mute or archive channel
Disable automations
Stop SLA timers
Prevent new tickets unless reopened
Set group status = archived
```

### F.3 Final Closure Message
Configurable template:

```text
This project/support channel is now closed. For future support, please contact [support channel]. Thank you.
```

### F.4 Late Message Handling
If a client sends messages after closure:

```text
Do not alert normal agents by default
Trigger reopened-channel alert for support lead
Optionally send one cooldown-controlled guidance reply
```

---

## G. Dynamic Identity Aliasing / Client Persona

### G.1 Purpose
Multiple phone numbers may belong to one person or one business persona. The system must support aliasing without corrupting the underlying contact model.

### G.2 Persona Model

```text
client_personas
---------------
id
workspace_id
client_id
name
persona_type: person | department | vendor | executive | shared_phone | unknown
notes
created_at
updated_at
```

Mapping:

```text
client_persona_contacts
-----------------------
persona_id
contact_id
confidence
source: manual | crm | ai_suggested
is_primary
```

### G.3 Rules

```text
Never auto-merge contacts globally
Allow manual persona grouping inside a client/project
AI may suggest aliasing but not apply automatically
Persona is client-scoped, not workspace-global by default
```

---

## H. Multi-Side Typing / Composing State

### H.1 Requirements
If supported by the active gateway, the platform should capture composing/typing events.

Display:

```text
Client user typing
Internal dashboard agent typing
Phone user/ghost agent typing if detectable
Multiple users typing simultaneously
```

### H.2 Collision Prevention
When multiple internal agents are typing in same group/thread:

```text
Show warning
Suggest claiming thread/ticket
Prevent duplicate sends if locked by owner
```

---

## I. Recursive Automation Suppression / Anti-OOO Loop

### I.1 Problem
Automated replies can trigger other automated replies, creating spam loops.

### I.2 Detection
The policy engine must detect:

```text
Incoming message within N seconds of outbound automation
Known auto-reply phrases
Repeated message patterns
Emoji-only replies after auto-ack
Business OOO syntax
High-frequency ping-pong between two automations
```

### I.3 Action

```text
Immediately suppress further automation for that channel
Set cooldown window
Log automation loop risk
Notify admin if repeated
Allow manual replies only until cooldown expires
```

Default cooldown:

```text
12 hours for OOO messages
30 minutes for generic auto-ack
Configurable per workspace/channel
```

---

## J. Webhook Storm / Reconnection Backlog Handling

### J.1 Requirement
When a linked-device session reconnects and receives old messages in bulk, the system must not trigger live automation.

### J.2 Rules

```text
Detect sync_phase/history_sync/reconnect_backlog
Check provider_timestamp vs ingested_at
If older than threshold, mark as stale_sync_message
Bypass AI replies, auto-ack, ticket auto-create, SLA, notifications
Import into history only
Show stale review queue if needed
```

### J.3 Backpressure

```text
Live queue priority > sync/backfill queue priority
Pause backfill/sync processing if live queue is overloaded
Batch normalize old events
Throttle media downloads from backlog
```

---

## K. Agent Analytics for Physical Device Replies

### K.1 Virtual Agent
Messages sent from the connected WhatsApp phone or unknown linked device must be attributed to a virtual agent.

Example:

```text
Physical Device - Support iPhone
WhatsApp Web External Session
Unknown Linked Device
```

### K.2 Analytics
Reports must include:

```text
Dashboard agent replies
Physical device replies
Automation replies
AI replies
Official API replies
Unknown outbound replies
```

This prevents agent activity from disappearing when people reply outside the dashboard.

---

## L. Global Internal User Inference

### L.1 Requirement
If a phone number belongs to a workspace user/agent, the system should infer internal status across all channel memberships in that workspace.

Model:

```text
workspace_user_identities
-------------------------
workspace_id
user_id
contact_id
phone
verified_at
status
```

Rule:

```text
If sender_contact_id belongs to workspace_user_identities, treat sender as internal unless channel membership explicitly overrides.
```

When an employee leaves:

```text
Disable workspace user identity
Mark all related memberships as former_internal
Alert admins if still present in client groups
```

---

## M. Backfill Mapping Requirements

### M.1 Mapping Boundary
When an existing WhatsApp group is mapped to a client/project, create:

```text
mapping_effective_at = current timestamp
```

Messages before the boundary are historical context. Messages after the boundary are live operations.

### M.2 Backfill Modes

```text
Start fresh
Import history as read-only context
Import last X days for manual review
Advanced import with date/media/filter controls
Dry run estimate
```

### M.3 Backfilled Messages
Backfilled messages must be marked:

```text
is_backfill = true
automation_suppressed = true
sla_eligible = false
ticket_auto_create_eligible = false
```

### M.4 Timeline Marker
UI must display:

```text
Client mapping started here. Messages above are historical context. Messages below are live operations.
```

---

## N. Updated MVP Priority From Operational Review

### N.1 MVP 1 Must Include

```text
Gateway connection
Group sync
Client/project mapping
Shared inbox
External reply vs internal note guardrails
3-second send delay
Basic asset vault
Create ticket from message
Pinned context/handover note
Permission-scoped sidebar/search
Raw event object-storage design
```

### N.2 MVP 2 Must Include

```text
Ticket lifecycle
SLA basics
Read-only/temporary coverage access
Backfill modes
Stale sync handling
Media lifecycle states
Physical device virtual agent attribution
```

### N.3 MVP 3 Must Include

```text
Virtual threading
Draft approvals
OOO cooldown
Client nudge automation
Recursive automation suppression
Advanced asset vault
```

### N.4 MVP 4 Must Include

```text
AI summaries
Voice note transcription
Outbound voice note transcript verification
Sensitive data detection
AI ticket suggestions
AI thread clustering
```

---

# Appendix O: Production Hardening Requirements — Blast Radius, Asset Isolation, Group Storms, and Context Drift

This appendix extends the Functional Requirements Specification with additional production-grade safeguards for high-volume, multi-client WhatsApp operations. These requirements are mandatory for avoiding account bans, client data leakage, automation loops, data pollution, and misleading project analytics.

The core design principle remains:

```text
Every WhatsApp operation must be evaluated for:
1. Client/project isolation risk
2. WhatsApp account risk
3. Automation side effects
4. Human operational safety
5. Historical/reporting correctness
```

---

## O.1 Broadcast and Blast-Radius Control

### O.1.1 Problem Statement

Organizations often need to send one operational update to many client groups, such as:

```text
We are currently experiencing minor service degradation. Our engineering team is investigating.
```

This looks harmless from a business perspective, but in linked-device WhatsApp mode it can be dangerous. If the system sends the same message to 20, 40, or 100 WhatsApp groups in rapid succession, WhatsApp may classify the behavior as automated bulk messaging or spam-like activity. This can cause the operational phone number to be rate-limited, restricted, or banned.

### O.1.2 Requirement: Jittered Outbox Queue

The platform must route all multi-recipient outbound messages through a controlled outbox queue.

The system must never send bulk group messages concurrently through linked-device transport.

Required behavior:

```text
Bulk announcement requested
↓
Create outbox batch
↓
Validate recipient groups
↓
Run risk and policy checks
↓
Queue each group message individually
↓
Send one group at a time
↓
Apply randomized human-like delay between sends
↓
Record delivery/failure per group
```

### O.1.3 Human-Like Delay Rules

For linked-device bulk/group sends:

```text
Minimum delay between group sends: configurable, default 12 seconds
Maximum delay between group sends: configurable, default 28 seconds
Delay strategy: randomized jitter
Concurrent sends per phone number: 1 by default
```

The system must support workspace-level and phone-level throttling:

```text
max_messages_per_minute_per_phone
max_messages_per_hour_per_phone
max_bulk_recipients_per_batch
max_bulk_batches_per_day
```

### O.1.4 Typing Simulation Before Send

Where supported by the gateway adapter, the outbox worker should emit a composing/typing state before sending each bulk group message.

Default behavior:

```text
Send composing event
Wait 2–5 seconds
Send message
Wait randomized jitter delay
Move to next group
```

If the gateway does not support typing events, the system must continue safely without blocking the send.

### O.1.5 Bulk Message Risk Levels

Every bulk send must be classified before execution:

| Risk Level | Example | Behavior |
|---|---|---|
| Low | 3–5 groups, operational update | Allow with jitter |
| Medium | 10–25 groups, same message | Require confirmation + jitter |
| High | 25+ groups, identical content | Require admin approval |
| Blocked | Marketing/cold outreach via linked-device mode | Block or require official API route |

### O.1.6 Official API Preference for Bulk Notifications

For business-initiated notifications, marketing, OTPs, or high-volume outreach, the routing policy should prefer official Meta WhatsApp Business Platform mode where configured.

Linked-device mode must be positioned as:

```text
Inbound-first and customer-group-support-first.
Not a spam/broadcast engine.
```

### O.1.7 Bulk Send UI Requirements

Before sending, the UI must show:

```text
Number of recipient groups
Transport mode
Estimated duration
Risk level
Phone number used
Daily quota impact
Whether randomized delay will be applied
Whether official API charges apply
```

Example warning:

```text
You are about to send this announcement to 42 WhatsApp groups using linked-device mode.
To reduce account risk, messages will be sent one-by-one over approximately 18 minutes.
Do not close the outbox worker during this time.
```

### O.1.8 Outbox Batch Audit

Each bulk send must generate an audit record:

```text
outbox_batch_id
workspace_id
created_by_user_id
phone_instance_id
transport_mode
recipient_count
risk_level
message_hash
started_at
completed_at
cancelled_at
status
```

Each recipient send must store:

```text
recipient_channel_id
client_id
scheduled_at
sent_at
delay_applied_ms
send_status
provider_message_id
error_code
retry_count
```

### O.1.9 Cancellation and Pause

Admins must be able to:

```text
Pause batch
Resume batch
Cancel remaining sends
Retry failed recipients
Export delivery report
```

Already-sent messages cannot be unsent unless the underlying WhatsApp delete-for-everyone operation is supported and still within the allowed window.

---

## O.2 Cross-Client Media Contamination Prevention

### O.2.1 Problem Statement

Agents frequently switch between client groups. A major risk is accidentally sending Client A’s confidential file into Client B’s WhatsApp group.

Examples:

```text
Client A network diagram accidentally sent to Client B
Client A invoice sent to Client C
Implementation Excel sheet uploaded to wrong project group
Screenshot containing credentials pasted into wrong channel
```

This can cause legal, contractual, privacy, and reputational damage.

### O.2.2 Requirement: Asset Context Isolation

Every asset stored in the Asset Vault must be bound to its originating context.

Required fields:

```text
asset_id
workspace_id
client_id
project_id
channel_id
source_message_id
uploaded_by_contact_id
stored_by_user_id
asset_origin_type: whatsapp_inbound | dashboard_upload | ticket_attachment | generated_export
classification: public | internal | confidential | restricted
sha256_hash
mime_type
file_name
storage_key
created_at
```

### O.2.3 Client-Bound Asset Token

When an agent downloads, previews, copies, drags, or reuses an asset from the platform, the frontend must retain a temporary asset context token.

Token metadata:

```text
asset_id
workspace_id
client_id
project_id
channel_id
issued_to_user_id
issued_at
expires_at
nonce
```

The token does not need to expose secrets to the browser. It can be represented by signed metadata or stored server-side with a short reference key.

### O.2.4 Cross-Client Upload Blocking

If a user attempts to attach, paste, drag, or reuse an asset belonging to a different `client_id`, the system must block the action before the message is sent.

Example alert:

```text
Security Warning
This file belongs to Client A and cannot be shared with Client B.

To proceed, request admin override or upload a different file.
```

Default behavior:

```text
Same client_id → allow
Same project_id → allow
Different project same client → warn if confidential/restricted
Different client_id → block
Unknown asset origin → warn and require confirmation
```

### O.2.5 Local File Upload Risk Detection

The platform cannot reliably know the origin of a file selected from the user’s local filesystem unless it was previously downloaded from the platform or fingerprinted.

Therefore, the system should maintain a recent asset fingerprint cache:

```text
sha256_hash
file_size
file_name
origin_client_id
origin_asset_id
last_downloaded_by_user_id
last_downloaded_at
```

When the user uploads a local file, the frontend/backend should compute or verify a file hash where feasible and compare it with recently downloaded assets.

If the hash matches an asset belonging to another client, block the upload.

### O.2.6 Paste and Drag-Drop Handling

The file protection logic must apply to:

```text
Attachment picker
Drag and drop
Clipboard paste
Forward from Asset Vault
Attach from ticket
Attach from media search
Attach from local downloads where hash matches known asset
```

### O.2.7 Admin Override

Admin override may be allowed for legitimate cross-client sharing, but must require:

```text
Explicit reason
Confirmation modal
Optional second approval
Audit log
Visible security label on message
```

Example:

```text
This file originated from Client A and is being shared with Client B by admin override.
Reason: Shared product release note approved for all clients.
```

### O.2.8 Asset Classification

The system should allow manual and AI-assisted classification:

```text
Public
Internal
Confidential
Restricted
Contains PII
Contains financial data
Contains credentials/secrets
Contains contract/legal data
```

Restricted assets must never be attached across clients without high-level permission.

### O.2.9 UI Requirements

In every asset preview, show:

```text
Client owner
Project owner
Source group
Uploaded by
First seen date
Confidentiality label
Linked tickets
```

When composing a reply, the attachment tray must show:

```text
Attached file belongs to: Client A
Current chat belongs to: Client B
Status: Blocked
```

---

## O.3 Inbound Group Storm Detection and Suppression

### O.3.1 Problem Statement

During incidents, a client group may suddenly receive dozens of messages from multiple client-side users within seconds. If the platform treats every message as an independent event, it may create many duplicate tickets, trigger many AI responses, spam the group with acknowledgements, and pollute SLA metrics.

### O.3.2 Requirement: Dynamic Channel Cooldown

The system must detect sudden inbound message spikes per channel and enter a temporary suppression state.

Default detection rule:

```text
If client-side messages > 10 within 30 seconds in a single channel
→ activate Inbound Storm Mode
```

This threshold must be configurable per workspace, client, and priority policy.

### O.3.3 Storm Mode State

When storm mode activates:

```text
channel_state = inbound_storm
storm_started_at = now
storm_detection_reason = message_rate_threshold
```

During storm mode, the system must:

```text
Pause AI auto-replies
Pause auto-acknowledgements
Pause automatic ticket creation per message
Pause client nudges
Pause OOO automation
Continue ingesting messages
Continue storing media
Continue updating live timeline
Aggregate messages into a storm bundle
Notify assigned support lead
Show storm banner in UI
```

### O.3.4 Storm Bundle

Create one storm bundle record:

```text
storm_bundle_id
workspace_id
client_id
channel_id
started_at
ended_at
message_count
client_sender_count
internal_sender_count
dominant_keywords
linked_incident_id
summary_status
```

The platform should offer actions:

```text
Create incident
Create one ticket from storm
Attach storm messages to existing ticket
Generate AI summary
Mark as false alarm
Mute for X minutes
```

### O.3.5 Incident Mode Auto-Trigger

If storm content contains critical terms, the system should suggest or auto-create an incident based on workspace policy.

Critical terms examples:

```text
down
urgent
not working
all users
production stopped
billing stopped
payment failed
system unavailable
major issue
```

Recommended behavior:

```text
Storm detected
↓
AI/rule summary generated silently
↓
Support lead receives alert
↓
One incident/ticket suggested
↓
Human confirms before client-facing reply
```

### O.3.6 Storm UI Requirements

The chat UI must display a clear banner:

```text
Inbound Storm Detected
54 client messages received in 2 minutes.
Automation has been paused for this channel.
Review grouped summary before replying.
```

Provide grouped view:

```text
Message clusters
Top senders
Top keywords
Media received
Possible root issue
Suggested next response
```

### O.3.7 Storm Exit Rules

Storm mode exits when:

```text
No more than N client messages received for cooldown period
Support lead manually ends storm mode
Incident is created and channel is moved to managed incident mode
```

Default cooldown:

```text
No client-side message burst for 5 minutes
```

After storm exits:

```text
Automation remains paused until manually re-enabled or cooldown expires
OOO remains suppressed for that group for configurable period
SLA is represented by one incident/ticket, not 50 individual message timers
```

---

## O.4 WhatsApp Group Context Drift and Metadata Change Monitoring

### O.4.1 Problem Statement

A WhatsApp group may be created for one project or purpose and later repurposed by the client without informing the support organization.

Example:

```text
Original group: Project Alpha Implementation
Later renamed: Production Bug Escalations
```

If the platform keeps mapping the group to the old project, analytics, SLA, routing rules, and project timelines become inaccurate.

### O.4.2 Requirement: Group Metadata Change Monitoring

The gateway adapter must capture group metadata modification events where supported:

```text
subject/title changed
profile picture changed
description changed
participants added/removed
admin changed
group settings changed
invite link changed
```

At minimum, group title/subject changes must be detected.

### O.4.3 Metadata Event Record

Store group metadata events:

```text
group_metadata_events
---------------------
id
workspace_id
channel_id
client_id
project_id
event_type
old_value
new_value
changed_by_contact_id
provider_timestamp
ingested_at
review_status
reviewed_by_user_id
reviewed_at
```

### O.4.4 Channel Registry Review Task

When the group name or description changes, create a Channel Registry task:

```text
The WhatsApp group “Project Alpha Implementation” was renamed to “Production Bug Escalations”.
Would you like to:
1. Keep current mapping
2. Update channel display name only
3. Move group to a different project/client container
4. Close old mapping and create a new mapping boundary
```

### O.4.5 Mapping Boundary for Repurposed Groups

If a group is repurposed, the system must support a new mapping boundary.

Example:

```text
Old mapping:
Group G → Client A / Project Alpha
Valid until: 2026-06-10 18:00

New mapping:
Group G → Client A / Production Support
Valid from: 2026-06-10 18:01
```

This prevents project analytics from being polluted.

### O.4.6 Historical Timeline Markers

When a group mapping changes, insert timeline markers:

```text
──────── Mapping changed ────────
This group was moved from Project Alpha to Production Support on 10 Jun 2026, 6:01 PM.
Messages above belong to Project Alpha.
Messages below belong to Production Support.
```

### O.4.7 Analytics Rules

Reports must respect mapping validity periods.

For example:

```text
Message on 2026-06-01 → counted under Project Alpha
Message on 2026-06-11 → counted under Production Support
```

Never attribute all historical messages to the newest mapping.

### O.4.8 Group Drift Risk Detection

The system should flag possible drift even without title changes.

Signals:

```text
New dominant topic differs from mapped project/category
Messages reference production/support after implementation closure
No open tickets in mapped project, but frequent unrelated messages continue
Different participant set appears
Project closed but channel remains active
```

AI can suggest drift review:

```text
This group appears to be used for production support, but it is still mapped to Project Alpha Implementation.
Review mapping?
```

---

## O.5 Updated MVP Placement

The following requirements must be included in the roadmap.

### MVP 1: Core Safety and Transport Hardening

Add:

```text
Jittered Outbox Queue
Per-phone send throttling
Bulk announcement risk warnings
Basic outbox delivery report
Group metadata event capture where gateway supports it
```

Reason: These are existential safeguards. They protect test numbers and early production numbers from account restrictions and prevent analytics pollution from day one.

### MVP 2: Operations Safety

Add:

```text
Group rename review tasks
Mapping boundary updates
Outbox pause/resume/cancel
Basic asset ownership labels
```

### MVP 3: Asset Vault and Security

Add:

```text
Asset context isolation
Cross-client attachment blocking
Recent file hash/fingerprint detection
Confidentiality labels
Admin override with audit
```

### MVP 4: Advanced Automation and AI

Add:

```text
Inbound group storm detection
Storm bundles
Incident auto-suggestion
AI topic clustering during storms
Recursive automation suppression improvements
Group drift AI review
```

---

## O.6 Acceptance Criteria

### Broadcast Safety

```text
Given an agent sends one announcement to 30 linked-device groups
When the batch starts
Then messages must be sent sequentially with randomized delays
And the system must show estimated duration and risk
And each send must be audited individually
```

### Cross-Client Asset Protection

```text
Given an agent downloads a file from Client A’s Asset Vault
When the same file is uploaded into Client B’s chat
Then the system must block the upload before sending
And show a security warning
And create an audit log entry
```

### Inbound Storm Suppression

```text
Given a channel receives more than configured threshold client messages within configured time window
When storm mode activates
Then AI auto-replies and auto-acknowledgements must be paused
And messages must be bundled for human triage
And only one incident/ticket suggestion should be generated by default
```

### Group Context Drift

```text
Given a mapped WhatsApp group is renamed on WhatsApp
When the gateway receives the metadata event
Then the platform must create a Channel Registry review task
And must not silently change project mapping without admin decision
```

### Mapping Boundary Analytics

```text
Given a group is remapped from Project A to Project B on a specific timestamp
When reports are generated
Then messages before the boundary must count under Project A
And messages after the boundary must count under Project B
```

---

## O.7 Final Product Rule

The product must never treat WhatsApp as a clean, structured, cooperative source of truth.

Instead, the product must assume:

```text
Users will rename groups.
Users will reuse old groups.
Users will send wrong files.
Users will panic-message during incidents.
Agents will click the wrong chat.
Executives will demand bulk announcements.
Gateways will reconnect with stale backlogs.
Automation can loop if not suppressed.
```

The platform wins by absorbing that chaos and turning it into safe, structured operations.



---

# P. Execution Priority Matrix and Shippability Control

This appendix is the controlling priority guide for engineering delivery. It does not remove any requirement from the FRS. It classifies the existing requirements so the team can ship a usable product without attempting the full long-term roadmap at once.

## P.1 Priority Definitions

### P0 — Non-Negotiable Safety / Data Integrity

P0 items are required before any real pilot because failure here can cause client data leaks, duplicate/spam replies, false automation, lost messages, or serious trust loss.

Examples:

```text
Backfill/live boundary
Message idempotency
External/internal reply separation
Permission-scoped client visibility
Basic audit trail
Raw payload object storage reference
Live media immediate download
Stale sync suppression
Send delay terminology instead of false undo-send
```

### P1 — Core v1 Usable Product

P1 items are the minimum features required to make the product useful for a small
support team managing 5–10 customer WhatsApp groups.

Examples:

```text
One gateway adapter
Phone connection status
Group sync
Group-to-client/project mapping
Shared support inbox
Text reply
Internal note
Basic media display
Create ticket from message
Assign ticket owner
Open/Pending/Closed status
Basic first-response timer
Admin/Agent/Viewer roles
```

### P2 — Operational v1.5 / v2

P2 items improve daily operations after Core v1 is validated.

Examples:

```text
Handover notes
Pinned context
Simple SLA policies
Auto-ack with cooldown
OOO cooldown
Coverage/read-only access
Basic analytics
Web Push/PWA notifications
Better contact review
Simple import/migration wizard
Phone pool support basics
```

### P3 — Advanced Product Differentiators

P3 items are valuable but should not block the first release.

Examples:

```text
Virtual threading
AI summaries
Voice note transcription
Advanced asset vault governance
Cross-client file contamination blocking
Incident mode
Group storm aggregation
Shared draft collaboration
Client-side nudges
Group offboarding workflow
Dynamic persona aliasing
```

### P4 — Enterprise / Long-Term Vision

P4 items are for enterprise/commercial maturity.

Examples:

```text
Official Meta API hybrid routing maturity
Official WhatsApp Management module
Embedded Signup / WABA onboarding
Template lifecycle governance
WhatsApp Flows management
Opt-out compliance engine
Official delivery/cost/tier analytics
SSO/SAML
Advanced RBAC
Break-glass access
Plugin marketplace
Industry templates
Advanced compliance reporting
Data residency controls
Full cost/risk routing dashboard
BYO LLM/local AI controls
```

---

## P.2 Corrected Core v1 Scope

Core v1 should be built as a narrow, practical release. The goal is not to challenge
every Periskope feature immediately. The goal is to prove that the open-source
product can reliably manage customer WhatsApp group support with safer replies and
basic tickets.

### P.2.1 Must Ship in Core v1

| Area | Requirement | Priority |
|---|---|---|
| Gateway | First-party ClarioDesk Gateway as the only Core v1 linked-device adapter; external gateways remain reference-only | P1 |
| Phone Status | Connected/disconnected/syncing/QR-required status | P1 |
| Group Sync | List groups from connected number | P1 |
| Message History Sync | Import recent group messages through the selected gateway and mark them as history/backfill when appropriate | P1 |
| Group Mapping | Map group to client/project or mark as unmapped/mixed | P1 |
| Shared Inbox | Timeline view for mapped groups | P1 |
| Reply | Send text reply to group | P1 |
| Send Delay | Hold outbound message for configured delay before dispatch; label clearly as “send delay” | P0 |
| Internal Notes | Add private internal note clearly separated from external reply | P1 |
| Defensive UI | External reply and internal note composers must be visually distinct | P0 |
| Tickets | Create ticket from message | P1 |
| Ticket Assignment | Assign ticket to user | P1 |
| Ticket Status | Open / Pending / Closed | P1 |
| Basic Timer | First-response timer only | P1 |
| Backfill Boundary | Historical imports must not trigger automation/SLA/tickets | P0 |
| Media | Download and store live media in object storage | P0/P1 |
| Raw Events | Store raw payload blob in S3/MinIO, not large JSON in PostgreSQL | P0 |
| Idempotency | Deduplicate webhook/backfill messages | P0 |
| Visibility | Agents see only assigned clients/groups | P0 |
| Roles | Admin / Agent / Viewer only | P1 |
| Audit | Log sends, notes, ticket creation/status changes | P0/P1 |

### P.2.2 Explicitly Out of Scope for Core v1

The following requirements remain valid but must not block the first usable release:

```text
AI transcription/summaries/classification
Official Meta API adapter
Hybrid route policy engine
Full SLA engine
Advanced automation builder
Virtual threading
Shared live drafts
Incident war rooms
Advanced asset vault security
Cross-client watermark/token blocking
Client personas
Plugin marketplace
SSO/SAML
Advanced RBAC/break-glass
Bulk announcements
Jittered broadcast queue
Localization beyond basic timezone/display support
Mobile app
Generic sales leads/deals/opportunity pipeline
Kanban-first inbox workflow
Advanced field/layout builder
```

---

## P.3 Revised Delivery Roadmap

### Phase 0 — Gateway Spike, 2–3 Days

Purpose: prove the transport path only.

Scope:

```text
Connect one WhatsApp number
Read one group
Receive text message
Send one text reply
Receive one media message
Handle one disconnect/reconnect test
```

Acceptance:

```text
A developer can connect a number, receive group messages, and send a reply through the selected gateway.
```

This is not a product release.

---

### Phase 1 — Core Shared Inbox, Weeks 1–4

Scope:

```text
Workspace login
Admin/Agent/Viewer roles
Phone connection page
Group list
Mapped/unmapped group state
Message timeline
Unread indicators
Send text reply
Send delay
Internal note
Defensive composer UI
Basic search
Basic audit
```

Acceptance:

```text
A support agent can open a mapped WhatsApp group, read messages, safely send replies, and add private notes without using WhatsApp directly.
```

---

### Phase 2 — Mapping, Backfill, and Visibility Safety, Weeks 5–6

Scope:

```text
Client/project records
Group-to-client/project mapping
Mixed group flag
Mapping effective timestamp
Historical backfill suppression
Unmapped group review
Permission-scoped sidebar
Permission-scoped search
Raw event object storage references
Idempotency
Stale sync suppression
```

Acceptance:

```text
An admin can map an existing group to a client/project without old messages triggering automations, false tickets, or false SLA events.
```

---

### Phase 3 — Basic Ticketing, Weeks 7–10

Scope:

```text
Create ticket from message
Ticket side panel
Assign ticket owner
Open/Pending/Closed statuses
Link ticket to original message
Basic first-response timer
Simple ticket comments/internal notes
```

Acceptance:

```text
A group message can become an assigned support ticket, and the team can track whether it is open, pending, or closed.
```

---

### Phase 4 — Reliability and Pilot Readiness, Weeks 11–12

Scope:

```text
Live media immediate download
Basic media preview
Gateway health warnings
Reconnect UX
Physical-phone outbound echo handling as “External Device” virtual agent
Simple operational dashboard
Pilot setup checklist
```

Acceptance:

```text
The product is safe enough for a controlled pilot with 5–10 groups, one connected number, and a small support team.
```

---

## P.4 Transport Risk Priority

### P.4.1 Linked-Device Mode

Linked-device mode is useful but risky. The product must not hide this.

Priority behavior:

| Requirement | Priority |
|---|---|
| Risk warning in phone connection UI | P0 |
| Gateway health status | P1 |
| Automation disabled during reconnect sync | P0 |
| Backfill suppression | P0 |
| Send-rate guardrails | P2 for normal sends, P3 for bulk sends |
| Phone pool support | P2/P3 |
| Gateway-agnostic adapter abstraction | P2 for implementation, P4 for multiple production adapters |

### P.4.2 Official Meta API Mode

Official mode is strategic but not required for the first group-inbox release unless the first customer specifically requires compliant 1:1 workflows.

Priority behavior:

| Requirement | Priority |
|---|---|
| Official API concept in architecture | P1 documentation |
| Meta Cloud API adapter | P3/P4 |
| Official 1:1 conversations | P3/P4 |
| Template registry/send validation | P3/P4 |
| Opt-out blocking | P3/P4 |
| Delivery/read status sync | P3/P4 |
| Cost tracking | P4 |
| Hybrid route engine | P4 |
| Official 1:1 notification workflows | P4 |
| Embedded Signup / WABA onboarding | P4/P5 |
| WhatsApp Flows management | P4/P5 |
| Bot workflow engine | P4/P5 |
| Industry packs for official workflows | P4/P5 |

---

## P.5 Mixed Group Handling Priority

The ideal rule is one client/project per group. However, migration reality requires mixed group support.

### P.5.1 Core v1 Mixed Group Behavior

For Core v1:

```text
Mixed groups are allowed but marked high-risk.
Automation is disabled by default.
SLA is disabled by default.
Every ticket created from a mixed group must manually choose client/project.
Search results from mixed groups must be scoped by ticket/client tags, not assumed group ownership.
```

### P.5.2 Post-v1 Mixed Group Enhancements

```text
Participant-based client hints
Message-level client tagging
AI-assisted message classification
Virtual client lanes inside a mixed group
Migration wizard to split messy groups into clean groups
```

Priority: P2/P3 depending on customer migration needs.

---

## P.6 AI Priority and Cost Control

AI runtime features are not part of Core v1, but AI-ready foundations are part of
planning from Core v1. Core v1 schemas, permissions, audit categories, and frontend
states should not block future BYOK implementation.

When AI is introduced, it must be async and budget-controlled.

### P.6.1 AI Execution Rules

```text
No blocking UI waits for AI.
AI jobs run asynchronously.
Every workspace has monthly AI budget limits.
Every AI feature has per-feature enable/disable controls.
Every provider key is BYOK, encrypted at rest, and never returned to the browser.
Every AI output has audit provenance.
Keyword/rule fallback must exist for low-budget users.
AI never sends external replies by default.
```

### P.6.1.1 AI-Ready Foundation Priority

| Foundation | Priority |
|---|---|
| AI-disabled/no-provider frontend states | P1 design |
| AI permission names in RBAC plan | P1 design |
| AI audit event categories | P1 design |
| BYOK provider abstraction in technical design | P1 design |
| Provider key storage implementation | P2/P3 |
| AI job queue implementation | P2/P3 |
| AI settings UI/API | P2/P3 |
| Local/self-hosted AI adapter | P4 |

### P.6.2 AI Priority

| AI Feature | Priority |
|---|---|
| BYOK provider settings | P2/P3 |
| AI audit and cost dashboard | P2/P3 |
| Simple thread summary on demand | P3 |
| Voice note transcription | P3 |
| Sensitive data scanning | P3/P4 |
| Ticket field extraction | P3 |
| AI suggested replies | P3 |
| Semantic search | P3/P4 |
| AI virtual threading | P4 |
| AI auto-replies | P4 and disabled by default |

---

## P.7 Data Storage Priority

The data lifecycle rules are P0/P1 because poor storage choices can make self-hosted deployments unusable.

### P.7.1 Core v1 Storage Rules

```text
Raw payload blobs go to object storage, not PostgreSQL JSON columns.
PostgreSQL stores operational metadata and object references.
Live media is downloaded immediately to object storage.
Messages are partition-ready by workspace/date, even if partitioning is not enabled in the first release.
Deletion/retention must preserve ticket metadata shells when linked to tickets.
```

Priority: P0 for schema direction; P2 for advanced retention UI.

---

## P.8 Access Control Priority

Core v1 should use a simple model:

```text
Admin: all workspace access
Agent: assigned clients/groups only
Viewer: read-only assigned clients/groups only
```

Advanced access modes are post-v1:

```text
Coverage windows → P2
Read-only cross-team visibility → P2
Break-glass access → P4
Auditor role → P4
SSO/SAML → P4
```

Default access rule remains strict:

```text
If a user is not assigned to a client/group, it is hidden from sidebar, notifications, global search, and dashboard metrics.
```

---

## P.9 Localization Priority

Core v1 must not assume English-only usage.

Minimum P1 requirements:

```text
UTF-8 support for all messages
Emoji support
Right-to-left text must render acceptably in message bubbles
Workspace timezone configuration
Message timestamps shown in workspace/user timezone
```

Post-v1:

```text
Full UI translations
Agent-side translation tools
Per-client language preference
AI translation/summarization
```

Priority: P1 for data/display correctness; P3 for translation features.

---

## P.10 Performance Priority

Core v1 should be designed for a realistic pilot, not internet scale.

### P.10.1 Core v1 Target

```text
1 workspace
1 connected phone
5–10 active groups
5 internal users
Up to 10,000 messages imported/stored
```

### P.10.2 Post-v1 Targets

```text
10–50 groups per phone → P2
100+ groups per phone → P3, requires phone pool/gateway node strategy
Multiple phone instances → P2/P3
Millions of messages → P3/P4, requires partitioning/search scaling
```

---

## P.11 Product Positioning Priority

The product must be positioned honestly.

Use:

```text
Open-source customer support desk for teams already managing customer work in WhatsApp groups.
```

Avoid:

```text
Free WhatsApp API replacement
Official WhatsApp automation platform
Risk-free enterprise WhatsApp compliance product
Bulk WhatsApp sender
```

---

## P.12 Final Build Instruction

The complete FRS is the product vision. The engineering team must execute by priority, not by document order.

Core v1 succeeds if it solves this:

```text
A client sends a WhatsApp group message.
The team sees it in a shared support inbox.
An agent can safely reply or add an internal note.
The message can become an assigned ticket.
Old imported messages do not trigger spam or false SLAs.
Agents cannot see other clients they are not assigned to.
```

Everything else is valid product vision, but not a blocker for the first release.

---

## Q. Reference Product Lessons and Full-Product UX Backlog

This section captures product and UI lessons from reviewing Evo CRM Community and Frappe CRM.
These products are references, not architectural dependencies. ClarioDesk remains a
customer support desk for WhatsApp groups, so each borrowed idea must be adapted to clients, projects, channels,
tickets, permissions, and transport safety.

### Q.1 Product Identity Guardrail

Borrow:

```text
Dense work surfaces
Activity timelines
Realtime notifications
Record side panels
Saved views
Capability-gated actions
Message rendering patterns
Onboarding and empty states
```

Do not blindly borrow:

```text
Generic sales leads/deals
Broad omnichannel CRM scope in Core v1
Marketing campaigns as a primary use case
Visual automation builders before the safety core is stable
User-customizable field layout builders in Core v1
Pipeline/Kanban-first mental model for group operations
```

The product should feel like an operations command center first, CRM second.

### Q.2 Core Shared Inbox UX Backlog

The inbox should evolve toward a high-quality operator console:

```text
Three-pane layout
Collapsible navigation
Resizable context panel
Responsive mobile drawer layout
Persistent last active view/tab
Permission-scoped saved views
Pinned views for common workflows
Unread and attention counters
Realtime connection badge
Phone/gateway diagnostic banner
Backfill and remap timeline markers
```

Core v1 should implement the narrowest useful version. Later releases can add saved/pinned
views, per-user preferences, mobile-optimized drawers, and richer workspace customization.

### Q.3 Message and Composer UX Backlog

The message surface should mature in layers:

```text
P1:
  safe text replies
  internal notes
  send-delay countdown/cancel
  media preview/download
  quoted reply preview
  delivery status badges
  deleted-message marker
  ghost-agent attribution

P2:
  quick replies
  handover/pinned context
  richer filters
  retry/failed-send workflow
  basic message reactions where gateway supports them
  attachment type picker with risk checks

P3:
  AI suggested replies
  voice transcription
  virtual thread reply targeting
  shared drafts and approvals
  cross-client attachment blocking
  storm bundles

P4:
  official-template governance
  multilingual reply assistance
  compliance review queues
  enterprise approval policies
```

Any message formatting must be parsed and sanitized. The frontend must never render raw gateway
HTML or unsanitized message content.

### Q.4 Activity Timeline and Context Panel Backlog

Frappe CRM's activity model is useful, but ClarioDesk's activity stream should be support-operations-specific.

The timeline/context model should eventually combine:

```text
WhatsApp messages
internal notes
ticket events
assignment changes
status changes
mapping/remapping events
phone/gateway events
media lifecycle events
audit snippets
handover notes
SLA and reverse-SLA state
```

Core v1 may show these as separate panels/tabs. Later versions can provide a unified activity feed
with filtering by event type.

### Q.5 Views, Filters, and Bulk Actions Backlog

Useful CRM-style list patterns should be adapted to operational queues:

```text
P1:
  All groups
  My assigned groups
  Unmapped groups
  Groups with open tickets
  Unread groups

P2:
  saved views
  pinned views
  quick filters
  configurable columns for channel/ticket lists
  bulk assignment
  bulk archive/mute where safe

P3:
  group-by views
  SLA breach queues
  storm-mode queues
  asset-risk queues
  AI triage queues

P4:
  enterprise dashboards
  compliance/auditor views
  organization-wide portfolio views
```

Kanban can be useful for tickets later, but the primary inbox should remain channel/message-first.

### Q.6 Admin, Setup, and Diagnostics Backlog

The setup experience should borrow the best onboarding patterns:

```text
Connect phone
show QR/status
sync groups
review unmapped groups
map first group
send first safe reply
create first ticket
invite team
assign access
verify realtime health
verify storage/media health
```

Diagnostics should be close to the user's work:

```text
phone disconnected
gateway unreachable
webhook failing
queue backlog
media download failing
route unavailable
adapter lacks a requested capability
official-template not approved
```

Admins should not need to leave the inbox to understand why a channel cannot send or receive.

### Q.7 Customization Backlog

Customization should arrive only after the core workflow is stable:

```text
P2:
  saved views
  quick filters
  workspace defaults
  quick replies
  client/project fields needed for operations

P3:
  custom ticket fields
  configurable ticket/context side panel
  industry templates
  dashboard widgets

P4:
  plugin marketplace
  enterprise policy packs
  advanced field/layout builder
  managed-cloud control plane
```

This avoids turning Core v1 into a generic CRM builder before the WhatsApp group
support loop is proven.

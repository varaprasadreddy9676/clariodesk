# Official WhatsApp Management Module

This module is part of the long-term ClarioDesk platform vision. It should not
replace the customer WhatsApp group support desk. It adds a separate official Meta
WhatsApp Business Platform surface for compliant 1:1 messaging, notifications,
templates, Flows, opt-outs, delivery analytics, and SaaS/client-owned Meta account
management.

Product rule:

```text
Group Support Desk solves existing WhatsApp group support chaos.
Official WhatsApp Management solves compliant WhatsApp Business Platform operations.
They share platform foundations, but they remain separate workflows.
```

## Why This Belongs In The Platform

Many organizations need both communication modes:

- Existing customer WhatsApp groups for high-touch support and implementation.
- Official Meta Cloud API for compliant 1:1 messages, reminders, OTP, templates,
  formal notifications, and business-initiated communication.

The same workspace, users, clients, audit, policies, webhooks, AI, and analytics can
serve both. A separate application would duplicate platform foundations and make it
harder to connect official 1:1 messages back to support tickets later.

## Product Boundary

This module should not appear inside the core inbox unless it is needed for the
current support workflow.

Separate navigation/module:

```text
Official WhatsApp
  WABA accounts
  Phone numbers
  Templates
  Flows
  Opt-outs
  Conversations
  Bot workflows
  Delivery analytics
  Cost/tier monitoring
  Industry packs
```

Core support agents should not need to understand WABA setup, template approval, Flow
JSON, tier limits, or Meta app configuration to reply to a group message.

## Core Capabilities

### WABA And Phone Management

- Embedded Signup for client onboarding where available.
- Connect customer-owned Meta/WABA assets.
- Manage WABA IDs, phone number IDs, display names, quality status, and messaging
  limits where exposed by Meta APIs.
- Configure webhooks.
- Track token/permission health.
- Support SaaS/provider mode where each client connects their own Meta account.

### Official 1:1 Messaging

- Receive inbound 1:1 messages through official webhooks.
- Send customer-service-window replies.
- Send template messages outside the customer-service window.
- Send media and interactive messages where supported.
- Store delivery/read/failure statuses.
- Link official 1:1 conversations to client/project/contact/ticket records.

### Template Lifecycle

- Create/sync templates.
- Track approval/rejection/paused status.
- Validate variables before send.
- Maintain per-client and per-phone template registry.
- Separate official templates from internal quick replies.
- Warn when the wrong template category or missing variable would cause failure.

### WhatsApp Flows

- Provide reusable Flow templates for common operations.
- Store Flow definitions and versions.
- Handle Flow data-exchange endpoints.
- Handle required encryption/decryption and signature checks.
- Route Flow submissions into tickets, webhooks, client systems, or workflows.

### Opt-Out And Compliance

- Detect STOP/unsubscribe style messages.
- Maintain opt-out lists by workspace/client/contact/channel.
- Hard-block sends to opted-out contacts.
- Keep audit evidence for opt-in/opt-out events.
- Support industry-specific compliance defaults.

### Bot And Workflow Engine

- Deterministic state machines for structured flows.
- AI-assisted interpretation for natural-language replies where enabled.
- Human handoff to support inbox/ticket where needed.
- Webhook/API connector steps for customer systems.

### Cost, Quality, And Tier Visibility

- Per-client and per-phone usage.
- Template performance.
- Delivery/read/failure rates.
- Opt-out rates.
- Spend estimates where pricing data is configured.
- Tier/quality warnings where available.

### Industry Packs

Potential packs:

- Healthcare: appointment reminders, patient intake, reschedule flow.
- Education: fee reminders, exam schedule, parent communication.
- Logistics: delivery updates, slot change, proof of delivery.
- BFSI: compliant alerts, KYC requests, service reminders.
- Retail: order updates, returns, feedback.

Industry packs configure templates, Flows, bot states, opt-in wording, and connector
definitions. They should not fork the core data model.

## Shared Platform Foundations

Reuse:

- Workspace tenancy.
- Client/project/contact records.
- Users, teams, permissions.
- Audit logs.
- Queue/worker infrastructure.
- Webhook ingestion.
- Notification framework.
- AI/BYOK policies.
- Reporting/dashboard primitives.
- Public API and integration framework.

Keep separate:

- WABA/account setup screens.
- Official template registry.
- Flow builder/runtime.
- Bot workflow runtime.
- Official cost/tier dashboards.
- Official opt-out policy engine.

## Phasing

P1/P2:

- Keep schema and navigation extensible.
- Do not build official management runtime.
- Preserve official API concept and route boundaries.

P3/P4:

- Meta Cloud API adapter.
- Official 1:1 conversations.
- Template registry and send validation.
- Delivery status sync.
- Basic cost visibility.
- Opt-out blocking.

P4/P5:

- Embedded Signup.
- Full WABA/phone management.
- WhatsApp Flows builder/runtime.
- Bot workflow engine.
- Industry packs.
- SaaS/customer-owned Meta account onboarding.
- Tier/quality dashboards.
- Enterprise governance and compliance exports.

## Acceptance Criteria

This module is successful when:

- A business/client can connect its own Meta/WABA assets.
- Templates can be created, synced, validated, and used safely.
- Official 1:1 messages can be received, sent, tracked, and audited.
- Opt-outs block outbound sends.
- Flows can collect structured data and route results to support workflows.
- Costs, delivery, quality, and limits are visible.
- The module can link official conversations to ClarioDesk clients/tickets without
  polluting the core group support inbox.

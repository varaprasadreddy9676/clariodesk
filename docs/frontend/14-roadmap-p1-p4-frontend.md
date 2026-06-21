# Frontend Roadmap P1-P4

This roadmap covers the complete product frontend. It preserves a simple Core v1
while making room for the full long-term platform.

## P1: Core Group Operations

Goal:

```text
An agent can manage assigned WhatsApp groups safely without opening WhatsApp.
```

Screens:

- Login/register workspace.
- App shell.
- Inbox.
- Phone connection.
- Group sync/unmapped review.
- Channel mapping.
- Timeline.
- External reply composer.
- Internal note composer.
- Ticket panel.
- Search.
- Clients/projects.
- Team assignments.
- Basic settings.

Must feel complete:

- Loading/empty/error states.
- Permission-scoped navigation.
- Realtime status.
- In-app notification center.
- Notification deep links.
- Browser tab unread count.
- Send-delay countdown.
- Message media rendering.
- Mobile usable.

## P2: Operational Maturity

Goal:

```text
Teams can operate daily with handover, SLA visibility, saved workflows, and better controls.
```

Add:

- Saved/pinned views.
- Quick filters.
- Quick replies.
- Handover notes.
- Pinned context.
- SLA/reverse SLA indicators.
- Coverage access.
- Basic analytics.
- Storage/media health.
- Queue/gateway diagnostics.
- Phone pool basics.
- Web Push/PWA setup.
- Notification preferences, quiet hours, preview privacy.
- Better contact review.
- Import/migration wizard.

UX direction:

- More filters and views, but still channel-first.
- More admin controls, but not a generic CRM builder.
- AI-ready component states and admin IA, but no dependency on AI for core work.

## P3: Differentiators

Goal:

```text
ClarioDesk becomes meaningfully better than using a normal shared inbox.
```

Add:

- AI summaries.
- AI suggested replies.
- BYOK provider settings.
- AI budget and audit screens.
- Voice note transcription.
- Semantic search.
- Sensitive-data scan.
- Virtual threads.
- Shared draft approvals.
- Incident mode.
- Group storm bundles.
- Notification digests.
- App badging.
- Asset vault governance.
- Cross-client attachment blocking.
- Advanced dashboards.
- Custom ticket fields.
- Configurable context panel sections.
- Industry templates.

UX direction:

- Advanced features appear contextually.
- AI never blocks core work.
- Risk and approval workflows are explicit.

## P4: Enterprise And Platform

Goal:

```text
Large organizations can govern, audit, extend, and scale the platform, including
official Meta WhatsApp Business Platform operations.
```

Add:

- Official WhatsApp module.
- WABA/phone-number management.
- Embedded Signup flow.
- Template lifecycle screens.
- WhatsApp Flows builder/runtime screens.
- Opt-out management.
- Official 1:1 conversation surface.
- Delivery/cost/tier dashboards.
- SSO/SAML UX.
- Advanced RBAC.
- Break-glass workflows.
- Auditor/compliance views.
- Official API template governance.
- Cost/risk routing dashboard.
- Plugin marketplace.
- Enterprise policy packs.
- Data residency controls.
- BYO/local AI controls.
- Multi-provider AI routing.
- AI evaluation and prompt-version governance.
- Managed cloud controls.
- Dedicated mobile app.
- Native mobile push alignment.

UX direction:

- Enterprise controls are powerful but separated from daily agent work.
- Compliance surfaces are auditable and exportable.
- Plugins cannot break safety primitives.

## Release Discipline

Each phase must ship with:

- Design states.
- Keyboard accessibility.
- Mobile behavior.
- Error/empty/loading coverage.
- Permission behavior.
- Realtime behavior.
- Component tests for risky UI.
- Playwright flows for critical paths.

Do not add a feature unless its states are designed.

## Frontend Readiness Before Coding

Before implementing `apps/web`, decide:

- Framework: likely Next.js/React unless changed.
- UI library: shadcn/Radix or custom primitives.
- Data fetching: React Query/SWR.
- Realtime client strategy.
- Icon set: lucide.
- Styling: Tailwind with semantic tokens.
- Storybook or equivalent component harness.
- Playwright E2E baseline.

Implementation should begin with the design system primitives and shell before
feature screens.

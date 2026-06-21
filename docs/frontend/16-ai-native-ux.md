# AI-Native UX

AI in ClarioDesk should feel like a quiet operations assistant inside the workflow,
not a separate chatbot or decorative AI dashboard. The experience must remain as
simple as WhatsApp for daily agents while giving admins enterprise-grade control over
provider keys, costs, policies, and audit.

## UX Principles

- AI appears in context, next to the work it can improve.
- AI output is suggested, editable, rejectable, and auditable.
- AI never hides the source scope used to generate an answer.
- AI never blocks reading, replying, ticket updates, or phone diagnostics.
- AI confidence should be expressed through plain operational state, not hype.
- AI controls must use the same design system as the rest of the app.

Avoid:

- A generic floating AI chatbot as the primary AI interface.
- Purple-gradient AI panels.
- Autocomplete that changes meaning silently.
- AI replies that look identical to human-authored outbound messages.
- Hidden provider/cost/data-scope behavior.

## AI Entry Points

Primary surfaces:

| Surface | AI Jobs |
|---|---|
| Channel sidebar | urgency, unresolved count, storm/noise hint, suggested owner |
| Timeline header | catch-up summary, last shift summary, open risk summary |
| Message row | translate, summarize, transcribe, classify, create ticket |
| Composer | suggest reply, rewrite, translate, tone adjust, sensitive-data scan |
| Ticket panel | suggested title, priority, fields, next action, closure note |
| Search | natural-language query, semantic results, filter conversion |
| Reports | recurring themes, workload insights, SLA risk drivers |
| Admin settings | BYOK, budgets, model routing, feature toggles, audit |

Each entry point should be discoverable but low-noise. Prefer inline buttons, menu
items, and contextual panels over a large permanent AI area.

## AI States

Every AI feature must support:

- Disabled by policy.
- No provider configured.
- Budget exceeded.
- Queued.
- Generating.
- Ready.
- Needs review.
- Applied.
- Edited after apply.
- Rejected.
- Failed with retry.
- Redacted because data policy blocked context.

States must use shared components:

```text
AiStatusBadge
AiGenerationSkeleton
AiSuggestionPanel
AiSourceScope
AiCostHint
AiReviewActions
AiPolicyBlockedState
```

## Suggestion Pattern

AI suggestions should be visually distinct from human content.

Required UI elements:

- `AI suggested` label.
- Source scope such as `12 messages, ticket #184, client Acme`.
- Generated timestamp.
- Provider/model disclosure in details.
- Apply, edit, reject, regenerate actions.
- Audit link for admins.

Suggested replies must enter the composer as editable drafts. They must not send
directly unless a later explicit policy allows it for a narrow approved FAQ case.

## Composer AI

The composer is the highest-risk AI surface.

Required controls:

- Suggest reply.
- Rewrite shorter.
- Rewrite more formal.
- Translate.
- Summarize quoted context.
- Check sensitive data.
- Explain why a send is blocked or risky.

Safety behavior:

- AI-generated drafts use a draft badge until the user edits or sends.
- Applying a suggestion preserves the source suggestion ID for audit.
- Sensitive-data findings appear above the send button before delay countdown.
- AI cannot bypass send delay, route restrictions, mixed-group warnings, or permission
  checks.

## Inbox AI

Inbox AI should reduce scanning time:

- Catch me up since my last read.
- Why is this group urgent?
- What changed while I was away?
- Is this noise, a new issue, a follow-up, or an escalation?
- Which tickets/messages need owner action?

The sidebar should remain human-readable. AI badges should be small and semantic,
for example `Risk`, `Storm`, `Waiting`, or `Needs reply`, with explanations in the
channel detail panel.

## Ticket And Context AI

Ticket panel AI should help structure work:

- Suggest title and description from selected messages.
- Suggest priority and SLA risk with reason.
- Suggest owner/team based on past routing.
- Extract fields from messages or media.
- Draft internal handover note.
- Draft closure summary.
- Identify stale pending-side ownership.

All suggested field changes should show a review diff before save.

## Media And Voice AI

Message media can be expensive and sensitive. AI actions should be explicit:

- Transcribe voice note.
- Summarize PDF/document.
- Extract invoice/order/reference fields.
- OCR image.
- Flag risky cross-client attachment reuse.

Large media AI jobs should show cost/size warning when configured by admin policy.

## Search AI

Natural-language search should convert user intent into visible filters:

```text
"critical unresolved Acme messages from last week"
-> client: Acme, priority: Critical, status: Open, date: Last 7 days
```

The UI must show converted filters so the user can edit or remove them. Semantic
search results must still respect workspace, client, and permission scopes.

## Admin AI UX

Admin settings should include:

- Provider connections.
- API key add/rotate/remove.
- Test connection.
- Provider health.
- Enabled AI features.
- Per-feature model selection.
- Monthly budget and per-feature limits.
- Data redaction profile.
- Retention policy for prompts/outputs.
- Audit log.
- BYOK/local model roadmap status.

Provider keys are write-only. After save, show only provider name, masked key
fingerprint, last tested time, and status.

## Mobile AI UX

Mobile must focus on review and action:

- Show summaries in compact drawers.
- Keep suggested reply review in the composer flow.
- Avoid side-by-side comparisons that need desktop width.
- Use bottom sheets for source scope and audit details.
- Never hide policy-blocked send reasons behind hover-only UI.

## Visual Design

AI surfaces use the normal product palette:

- Neutral panel surface.
- Teal/green-blue accent for available AI assist.
- Amber for review-needed output.
- Red/orange for risk findings.
- Gray for disabled/no-provider states.

Do not create a separate AI brand treatment. AI is part of the operating system of
the product, not a visual theme.

## Roadmap

P1:

- Reserve AI states/components in design system.
- Add AI-disabled/no-provider states to relevant screens.
- Define admin navigation location for future AI settings.

P2:

- BYOK settings.
- AI audit log.
- Basic summary and ticket-field suggestions.
- Provider health and budget states.

P3:

- Suggested replies.
- Voice transcription.
- Semantic search.
- Sensitive-data scan.
- Storm/noise/group-drift suggestions.

P4:

- Multi-provider routing.
- Local/self-hosted model UX.
- AI evaluation dashboards.
- Enterprise policy packs.
- Data residency-aware provider selection.

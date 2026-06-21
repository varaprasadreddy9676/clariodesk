# AI-Native And BYOK Architecture

ClarioDesk should be AI-native, but not AI-dependent. The core product must still
work without any model provider configured. AI should appear as a consistent assistive
layer across inbox, tickets, media, search, automations, reporting, and admin workflows.

The product rule is:

```text
AI assists every workflow where it reduces operator effort, but humans and policy
control every external action by default.
```

## Goals

- Make every major workflow AI-ready from the first architecture pass.
- Support BYOK so self-hosted and enterprise customers control model providers,
  keys, budgets, data exposure, and residency.
- Keep AI asynchronous, auditable, permission-scoped, and budget-controlled.
- Allow provider choice without coupling product features to one vendor.
- Make AI outputs explainable enough for operators to trust, edit, reject, and audit.

## Non-Goals

- Core v1 should not require an AI provider to operate.
- AI must not block the inbound webhook, message normalization, timeline fetch, or
  external send path.
- AI must not auto-send external WhatsApp replies by default.
- AI must not train on or reuse one client/project's context for another client/project.
- Prompt customization should not become a generic unsafe scripting system.

## BYOK Model

Admin-configured BYOK should support:

- Workspace-level provider connections.
- Per-feature enable/disable controls.
- Per-client/project overrides when required.
- Per-feature model routing.
- Monthly workspace budget caps.
- Per-job token and cost ceilings.
- Provider test connection and health status.
- Provider-specific rate-limit and outage diagnostics.
- Local/self-hosted model adapter in later enterprise phases.

Provider keys must:

- Be encrypted at rest with envelope encryption or a dedicated secret manager.
- Never be sent to the browser.
- Never be logged, exported, or included in error payloads.
- Be rotated without changing feature configuration.
- Be permission-gated to workspace owners/admins.

## Provider Abstraction

Use a small provider interface, not provider-specific calls scattered across product
modules.

```text
AiProvider
  generateText(input)
  classify(input)
  summarize(input)
  transcribe(input)
  embed(input)
  healthCheck()
```

Every provider response must be normalized into a common result shape:

```text
provider
model
request_id
output
confidence when available
usage_tokens
estimated_cost
finish_reason
latency_ms
raw_ref for secured debugging
```

Provider raw payloads are sensitive. Store them only when explicitly enabled for
diagnostics, apply retention limits, and redact secrets or high-risk personal data.

## AI Job Model

AI work should use queues:

```text
domain event
  -> ai_task created
  -> budget/policy check
  -> context builder
  -> provider call
  -> output validation
  -> ai_suggestion stored
  -> UI/event notification
```

Required task fields:

```text
workspace_id
client_id/project_id when applicable
channel_id/message_id/ticket_id when applicable
feature_key
provider_connection_id
model
status
input_refs
redaction_profile
prompt_version
created_by or system trigger
review_status
tokens/cost/latency
error_code
```

AI jobs must be idempotent where possible. Re-running a summary should create a new
version, not silently overwrite audit history.

## AI Suggestion Model

AI output should be stored as suggestions, not hidden mutations.

Suggestion types:

- Message classification.
- Priority/SLA risk.
- Ticket title/description/fields.
- Suggested reply.
- Internal note draft.
- Timeline summary.
- Shift handover.
- Voice transcription.
- Media/document summary.
- Sensitive-data/risk finding.
- Contact alias suggestion.
- Group drift suggestion.
- Incident/storm summary.
- Natural-language search interpretation.
- Automation rule suggestion.

Each suggestion should record:

- Source references, not only copied text.
- Output text or structured payload.
- Explanation/reasoning summary where useful.
- Confidence or quality signal where available.
- Accepted/edited/rejected status.
- Reviewing user and timestamp.
- Final user action linked back to the suggestion.

## Context Isolation

AI context builders must enforce the same authorization and tenancy rules as product
APIs.

Minimum filters:

- Workspace.
- Client/project.
- Channel.
- Ticket.
- User permission scope.
- Retention policy.
- Data residency policy when available.

The model should never receive data the current user and configured AI policy are not
allowed to access. Retrieval and embeddings must carry the same scope metadata and
must be filtered before ranking, not after.

## Prompt-Injection Defense

WhatsApp messages, attachments, filenames, transcripts, and client-provided text are
untrusted input. The system prompt must tell the model that user/client content is
data, not instructions.

Controls:

- Keep tool permissions server-side and feature-specific.
- Do not let model output directly call external send APIs.
- Validate structured AI output with schemas.
- Reject or quarantine outputs that ask to bypass policy.
- Redact secrets before provider calls when possible.
- Show high-risk findings before users apply AI output.

## Frontend Surfaces

AI should appear where work happens:

- Inbox: catch-up summary, urgency, noise/storm hints, suggested owner/priority.
- Timeline: message summaries, translation, transcript, media/document summary.
- Composer: suggested reply, rewrite, translate, tone adjust, sensitive-data warning.
- Ticket panel: suggested title, fields, status, next action, closure summary.
- Search: semantic search and natural-language filter conversion.
- Reports: trends, recurring issues, SLA risk drivers, unresolved themes.
- Admin: provider keys, budgets, feature toggles, audit, routing, retention.

AI UI must always show generation state, source scope, and whether output is safe to
apply or requires review.

## Backend Surfaces

Planned backend modules:

```text
ai-providers
ai-connections
ai-policies
ai-context
ai-jobs
ai-suggestions
ai-audit
ai-budget
ai-redaction
ai-embeddings
```

Core v1 should reserve boundaries and schema naming for these modules even if the
first implementation ships with AI disabled.

## Product Phasing

P1 foundation:

- AI-ready data boundaries in specs.
- Explicit AI-disabled default.
- Permission model includes future AI manage/run/review rights.
- Audit model reserves AI actor/output event types.
- BYOK architecture documented before provider implementation.

P2 foundation/features:

- BYOK settings UI and API.
- Provider health check.
- Budget and feature toggles.
- AI audit log.
- Basic summaries and ticket-field suggestions in suggest-only mode.

P3 differentiators:

- Suggested replies.
- Voice transcription.
- Semantic search.
- Sensitive-data scan.
- Storm/noise/group-drift detection.
- Media/document summaries.
- Shift handover summaries.

P4 enterprise/platform:

- Multiple provider routing.
- Local/self-hosted model adapters.
- Data residency-aware model routing.
- Enterprise policy packs.
- Prompt/version governance.
- AI evaluation dashboards.
- Fine-grained retention and redaction policies.

## Acceptance Criteria

AI is ready for production use only when:

- The app works when AI is disabled or provider calls fail.
- Provider keys are encrypted and never exposed to clients/logs.
- Every AI output has audit provenance.
- Every model call is workspace/client scoped.
- Costs are capped and visible.
- Prompt-injection and structured-output validation are implemented.
- External replies require human approval unless an explicit admin policy enables
  narrow automation.
- Operators can reject AI output and continue working normally.

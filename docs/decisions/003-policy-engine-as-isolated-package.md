# ADR-003: Pure deterministic policy engine as an isolated package

## Status

Accepted

## Date

2026-06 (Core v1 baseline)

## Context

ClarioDesk's differentiator against commercial WhatsApp tools is **safety**: preventing number bans, duplicate sends, echo loops, and false operations from backfill. These rules are subtle and high-stakes:

- `classifyMessage` decides whether a reconnect-sync message fires an SLA timer — getting it wrong means either missing real customer urgency or spamming agents with stale alerts.
- `evaluateSendPolicy` decides whether a bulk send goes out — getting it wrong means a banned number.
- `reconcEcho` decides whether an echo is a dashboard reply or a ghost-agent message — getting it wrong means duplicate outbound messages.

These rules are invoked from multiple runtimes (the API at outbox-create time, the worker at normalize and outbox-send time). If the rules live inside those runtimes, they get coupled to NestJS modules, Drizzle, Redis, and BullMQ — making them hard to test exhaustively and easy to get wrong. Bugs in safety logic are exactly the bugs that are hardest to catch after the fact (a misfired SLA timer, a quietly banned number).

Non-determinism is a specific threat: a rule that reads `Date.now()` or `Math.random()` directly can't be reproduced in a test, so edge cases (the exact age at which a reconnect message becomes "stale") go untested.

## Decision

Make the policy engine a **dedicated package** (`packages/policy-engine`) that is **pure and deterministic**, with four hard rules:

1. **No I/O.** No `db`, no `redis`, no `fetch`, no filesystem. Every function takes all inputs as arguments.
2. **Inject non-determinism.** `nowMs` and `rng` are passed in, never read internally. Same inputs → same output, always.
3. **Decision, not enforcement.** Functions return verdicts (`allowed | blocked | needs_approval`, `isLiveEvent`, `merge_into_outbox`). The worker and API enforce them. This keeps the engine reusable across runtimes.
4. **Never throw on the hot path.** Unknown payloads degrade to a safe default (suppressed / blocked) rather than throwing — a thrown error in `normalizeWebhook` would drop a real customer message.

Every rule has a co-located `.test.ts` that is table-driven over the input space — no mocks, no fixtures, no database.

## Alternatives considered

### Rules inline in the worker/API services
- Pros: Less indirection; the rule sits next to the code that uses it.
- Cons: Coupled to runtime deps → untestable in isolation → the safety logic, the highest-stakes code, becomes the least tested. Re-using the same rule across the API pre-check and the worker re-check means copy-paste or a shared helper anyway. **Rejected** — safety logic must be the most testable code in the codebase, not the least.

### Rules as a NestJS module with injected config
- Pros: Idiomatic for the API; config via DI.
- Cons: Forces a NestJS runtime to test the rules; the worker (not NestJS) would need a parallel path. Determinism is still on the honor system. **Rejected** — the rules are domain logic, not framework logic.

### Database-stored / admin-configurable rules
- Pros: Operators tune thresholds without deploys.
- Cons: Mutable rules in the hot path are a footgun (a bad config change bans every number), and most thresholds (stale-sync window, bulk-risk bands) encode hard WhatsApp constraints that shouldn't be casually editable. **Rejected for Core v1** — thresholds are code constants; per-workspace tunables can layer on later without changing the pure core.

## Consequences

- **The safety rules are the most thoroughly tested code in the codebase.** `classification.test.ts` covers every suppression reason and eligibility path table-driven over inputs; tests run in milliseconds with no infra.
- **Re-use across runtimes is trivial.** The API pre-check and the worker defense-in-depth re-check call the *same* `evaluateSendPolicy` — no drift between "what we checked at queue time" and "what we checked at send time."
- **Inputs are verbose.** `classifyMessage` takes 12 fields rather than reading them from a context object. This is deliberate — every input is visible at the call site and injectable in tests.
- **Operators cannot hot-tune hard thresholds.** The stale-sync window, bulk-risk bands, and send-delay ranges are code constants. This is a feature for safety logic, though it means some changes require a deploy.
- **The engine returns verdicts, so a future admin UI can surface "why was this send blocked?"** by storing the verdict reason on the outbox row — the policy_status / failure_reason columns already support this.

## References

- [Policy Engine](../architecture/policy-engine.md)
- [Message Pipeline § Where the policy engine plugs in](../architecture/message-pipeline.md) — the "Where the policy engine plugs in" section
- Package: `packages/policy-engine/src/`
- Tests: `packages/policy-engine/src/*.test.ts`

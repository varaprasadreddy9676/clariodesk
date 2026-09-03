# Architecture Decision Records

ADRs capture the *why* behind significant technical decisions in ClarioDesk — the context, constraints, and alternatives that code alone can't show. They exist so the same decisions don't get re-litigated, and so future contributors (human and agent) understand the trade-offs that shaped the codebase.

**Lifecycle:** `PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)`. Old ADRs are never deleted — they capture historical context. When a decision changes, a new ADR references and supersedes the old one.

## Index

| ADR | Title | Status |
|---|---|---|
| [ADR-001](./001-swappable-gateway-adapter.md) | Modular monolith with a swappable gateway adapter | Accepted |
| [ADR-002](./002-atomic-outbox-claim.md) | Atomic outbox claim for outbound sends | Accepted |
| [ADR-003](./003-policy-engine-as-isolated-package.md) | Pure deterministic policy engine as an isolated package | Accepted |

## When to add an ADR

- Choosing a framework, library, or major dependency
- Designing the data model or a cross-cutting subsystem
- Changing an API architecture or auth strategy
- Any decision that would be expensive to reverse

Use the standard ADR structure (Status, Date, Context, Decision, Alternatives Considered, Consequences) — see any existing ADR for a template. Keep it short — a 10-minute ADR prevents a 2-hour debate six months later.

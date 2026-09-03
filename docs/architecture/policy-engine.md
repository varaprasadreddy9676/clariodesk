# Policy Engine

The policy engine is ClarioDesk's safety brain. Its job is to keep WhatsApp numbers from getting banned, prevent double-sends and echo loops, and ensure that historical backfill never triggers live automations (SLA timers, auto-tickets, notifications).

It is an **isolated, pure, deterministic** package — `packages/policy-engine` — with zero I/O dependencies. Every rule is a pure function that can be exhaustively unit-tested without a database, HTTP server, or Redis. This isolation is the project's core design invariant (see [ADR-003](../decisions/003-policy-engine-as-isolated-package.md)).

The full message-flow context for where these rules fire lives in [Message Pipeline](./message-pipeline.md).

---

## Why it exists

WhatsApp aggressively bans numbers that look like bots: too-fast sends, bulk blasts, duplicate messages, or echo loops. Commercial tools handle this silently and charge for it. ClarioDesk has to do it in the open, so the rules are first-class, inspectable, and tested.

Three failure modes the engine prevents:

1. **Ban risk** — bulk sends or sub-second send cadence on a linked-device number.
2. **Lost or duplicated messages** — webhook redelivery, BullMQ retries, or multiple worker processes causing the same message to be stored or sent twice.
3. **False operations** — historical backfill or reconnect-sync being treated as live activity, firing SLA timers and auto-tickets for events that happened hours ago.

---

## Module map

All exports come from `packages/policy-engine/src/index.ts`. Each source file has a matching `.test.ts` (or shares `policy.test.ts`).

| File | Export | Purpose |
|---|---|---|
| `send-policy.ts` | `evaluateSendPolicy` | Outbound send gate — block / allow / require approval |
| `send-policy.ts` | `bulkSendDelayMs` | Randomized human-like inter-send delay (anti-ban) |
| `classification.ts` | `classifyMessage` | Live vs backfill/stale — the single most important inbound computation |
| `idempotency.ts` | `idempotencyKey`, `fingerprintKey` | Dedup keys — primary ID + content-hash fallback |
| `echo.ts` | `reconcEcho` | Merge outbound echoes into outbox rows; detect ghost-agent replies |
| `internal-sender.ts` | `resolveIsInternal` | Is the sender a workspace agent? |
| `backpressure.ts` | `assessBatch` | Reconnect-storm throttling |

---

## 1. Send policy — `evaluateSendPolicy`

**File:** `packages/policy-engine/src/send-policy.ts`

The outbound gate (TDD §10.2; FRS §8.3.3). Evaluated for every outbox row before dispatch, both as a pre-check at outbox-creation time and again as a defense-in-depth re-check inside the `outbox-send` worker right before bytes leave.

### Verdict model

```ts
type SendPolicyVerdict = {
  status: "allowed" | "blocked" | "needs_approval";
  reason: string;
  riskLevel: "low" | "medium" | "high";
};
```

### Hard blocks

| Condition | Reason |
|---|---|
| Phone status `restricted` / `archived` | `phone is <status>` |
| Phone status `disconnected` / `qr_required` | `phone not connected (<status>)` |
| Official-API cost limit exceeded | `official API cost limit exceeded (FRS §35.6)` |
| Cooldown active for the channel/thread | `outbound cooldown active for this channel/thread` |

### Bulk blast-radius control (FRS §O.1)

Recipient-count thresholds drive risk and approval flow:

| Recipients | Risk | Verdict |
|---|---|---|
| < `mediumRiskThreshold` (default 10) | low | `allowed` |
| `medium` → `high` threshold (10–25) | medium | `needs_approval` — confirmation required |
| ≥ `highRiskThreshold` (default 25) | high | `needs_approval` for admin; **blocked** for non-admin |

### Anti-ban send cadence — `bulkSendDelayMs`

```ts
bulkSendDelayMs(min: number, max: number, rng: () => number): number
```

Randomized delay (default 12–28s) between linked-device bulk sends. Linked-device numbers that send in a tight burst look automated and get flagged. The randomness is injected (`rng`) so delays are deterministic in tests.

> The per-reply send delay (default `SEND_DELAY_MS=3000`) is a **separate** mechanism — it's enforced via BullMQ's `delay` option on the outbox job at queue time, not by the policy engine. See [Message Pipeline § Outbound](./message-pipeline.md).

---

## 2. Classification — `classifyMessage`

**File:** `packages/policy-engine/src/classification.ts`

> "The single most important safety computation in the platform." — file header

Decides whether an incoming message is a **LIVE operational event** (eligible for SLA, automation, ticket auto-create, notifications) or **HISTORICAL/STALE context** that must never trigger any of those (FRS §11, §2.2; TDD §8.5).

### Result

```ts
type ClassificationResult = {
  isBackfill: boolean;
  isLiveEvent: boolean;
  automationSuppressed: boolean;
  automationSuppressedReason: SuppressionReason | null;
  slaEligible: boolean;
  ticketAutoCreateEligible: boolean;
};
```

### Suppression reasons

`historical_backfill` · `stale_sync` · `history_sync_event` · `explicit_backfill` · `unmapped_channel` · `mixed_channel` · `internal_sender` · `phone_restricted` · `non_operational_message_type`

### Decision order

1. **Backfill / stale detection (highest precedence)** — explicit backfill, history-sync batch, timestamp predates the channel's `mappingEffectiveAt`, or a reconnect-sync message older than `STALE_SYNC_THRESHOLD_SECONDS` (default 900s). All return a full backfill result: nothing fires.
2. **Non-operational message types** — reactions, system events, deletes store but never drive operations (TDD §6.11).
3. **Unmapped channels** — store messages, trigger nothing (FRS §10.4). Group mapping is the safety boundary between imported history and live operations.
4. **Restricted phone** — keep ingesting, suppress outbound automation.
5. **Internal sender** — internal chatter doesn't start client SLA (FRS §14.6) but is otherwise live.
6. **Mixed groups** — automation + SLA off by default (FRS §P.5.1; TDD §11.4).
7. **Single-client, client-inbound** — the only path that sets `slaEligible` and `ticketAutoCreateEligible`.

### Why this matters

Without classification, reconnecting a phone (which re-delivers the last hours of messages) would fire SLA timers and auto-tickets for every old message, and bulk-importing history would spam agents with notifications. The mapping boundary (`mappingEffectiveAt`) is what separates "this is old context we're catching up on" from "a customer is waiting."

---

## 3. Idempotency — `idempotencyKey`, `fingerprintKey`

**File:** `packages/policy-engine/src/idempotency.ts`

Prevents duplicate message storage when the gateway redelivers, BullMQ retries, or multiple workers race.

- **`idempotencyKey(ws, channel, providerMsgId)`** — the primary key. Deterministic from the provider message ID.
- **`fingerprintKey(input)`** — SHA-256 content-hash fallback for providers with unreliable IDs. Used as a secondary dedup when the primary ID is missing or non-unique.

The store layer (`DrizzleNormalizationStore.insertMessage`) inserts with `ON CONFLICT DO NOTHING` on these keys, so a redelivery is a no-op.

---

## 4. Echo reconciliation — `reconcEcho`

**File:** `packages/policy-engine/src/echo.ts`

When WhatsApp echoes back our own outbound message as an inbound webhook event, `reconcEcho` decides what to do:

| Scenario | Action | Meaning |
|---|---|---|
| Outbox row exists for this `providerMessageId` | `merge_into_outbox` | Agent sent via the dashboard → merge the echo into the existing outbox row (no duplicate) |
| No matching outbox row | `new_ghost_agent_message` | Someone typed on the physical phone itself → record as a ghost-agent reply |

This is why the `outbox-send` worker stamps `providerMessageId` on the outbox row immediately after sending — so the later inbound echo can find and merge into it rather than creating a duplicate outbound message.

---

## 5. Internal sender — `resolveIsInternal`

**File:** `packages/policy-engine/src/internal-sender.ts`

Determines whether a message sender is a workspace agent (FRS §14.6). Internal chatter is live but doesn't start client SLA timers or ticket auto-creation. Resolved from the sender's channel membership / workspace-user identity.

---

## 6. Backpressure — `assessBatch`

**File:** `packages/policy-engine/src/backpressure.ts`

```ts
assessBatch(input): StormAssessment
```

Detects reconnect storms — a phone that just reconnected and is now delivering a large backlog. Returns a throttle recommendation (`throttleMs`) that the normalize processor honors by inserting `sleep(storm.throttleMs)` between events in the batch. Prevents the worker from saturating the database or flooding realtime during a reconnect.

---

## Design invariants

1. **Pure functions only.** No `db`, no `redis`, no `fetch`. Every function takes all inputs as arguments (including `nowMs` and `rng`) and returns a value. This makes the engine the most thoroughly tested code in the codebase.
2. **Deterministic.** Same inputs → same verdict, always. No `Date.now()` or `Math.random()` inside — both are injected.
3. **Never throws on the hot path.** `normalizeWebhook` (in the adapter) and the policy checks are written so unknown payloads degrade to a safe default (suppressed / blocked) rather than throwing.
4. **Decision, not enforcement.** The engine returns verdicts; the worker and API layers enforce them. This keeps the rules reusable across runtimes and testable in isolation.

---

## Testing

Every rule has a co-located test file:

- `classification.test.ts` — the largest, covering all suppression reasons and eligibility paths
- `policy.test.ts` — `evaluateSendPolicy` and `bulkSendDelayMs`
- `backpressure.test.ts` — storm detection thresholds
- `echo.ts`, `idempotency.ts`, `internal-sender.ts` — covered by integration tests in `apps/worker`

Run them with:

```bash
npx vitest run packages/policy-engine
```

Because the functions are pure, these tests need no fixtures or mocks — they're table-driven over the input space.

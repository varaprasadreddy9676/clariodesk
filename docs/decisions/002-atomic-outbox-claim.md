# ADR-002: Atomic outbox claim for outbound sends

## Status

Accepted

## Date

2026-06 (Core v1 baseline)

## Context

All outbound replies flow through an `outbox_messages` table, and a BullMQ worker (`outbox-send`) is responsible for actually sending them through the gateway. Three forces conspire to produce duplicate sends:

1. **BullMQ redelivery** — if a worker crashes or the job stalls past its visibility timeout, BullMQ re-queues the same job.
2. **Multiple worker processes** — operators can run more than one worker instance; both can pick up the same job after a stall.
3. **Network retries** — the gateway HTTP call can time out after the message was actually delivered, causing a retry that sends a second copy.

Sending a customer the same message twice is one of the most visible, trust-destroying bugs in a support tool. WhatsApp also penalizes duplicate-looking sends as bot behavior.

A naive "SELECT row, check status, UPDATE to sending" sequence has a TOCTOU race: two workers can both SELECT a `pending` row, both decide to send, and both UPDATE.

## Decision

Use a **single atomic conditional UPDATE with RETURNING** as the claim mechanism.

```ts
// apps/worker/src/processors/outbox-send.processor.ts:31
const [outbox] = await deps.db
  .update(schema.outboxMessages)
  .set({ status: "sending", updatedAt: new Date() })
  .where(
    and(
      eq(schema.outboxMessages.id, outboxId),
      inArray(schema.outboxMessages.status, ["pending", "waiting_delay"]),
    ),
  )
  .returning();
if (!outbox) {
  // already claimed, sent, or cancelled — idempotent exit
  return;
}
```

The row is claimed and read in one statement. Postgres's row-level locking guarantees only one UPDATE succeeds; the other gets an empty `RETURNING` and exits. Combined with **worker concurrency of 1** for `outbox-send` (`apps/worker/src/index.ts:44`), sends are fully serialized per worker process, and the claim makes them safe across processes.

The outbox row also carries a `providerMessageId` stamped immediately after a successful send, which lets the inbound echo reconcile via `reconcEcho` rather than creating a duplicate outbound message.

## Alternatives considered

### SELECT-then-UPDATE with application-level lock
- Pros: More readable status checks in app code.
- Cons: TOCTOU race window between SELECT and UPDATE unless wrapped in a transaction with `SELECT ... FOR UPDATE`. More code, more failure modes (deadlock handling, transaction leaks). **Rejected** — the atomic UPDATE is simpler and provably race-free.

### Redis distributed lock (Redlock) per outbox id
- Pros: Lock before touching the DB; works across processes.
- Cons: Adds a Redis dependency to the send path, introduces lock-vs-lease edge cases (worker dies holding the lock), and the DB already enforces the invariant atomically. Lock + DB claim is belt-and-suspenders with two systems to get right. **Rejected** — Postgres is already the source of truth; let it arbitrate.

### Unique constraint on providerMessageId only (dedup at insert)
- Pros: Catches duplicates at storage time.
- Cons: `providerMessageId` is only known *after* the send returns, so it can't prevent two concurrent sends of the same outbox row — only the post-hoc echo duplication. Necessary for echo reconciliation but not sufficient for the claim. **Kept as the echo-dedup mechanism** (see [Policy Engine § Echo](../architecture/policy-engine.md#4-echo-reconciliation--reconcecho)), but the claim handles the concurrent-send case.

## Consequences

- **No duplicate sends across worker processes or BullMQ redeliveries.** The claim is the single point of truth for "is this row mine to send."
- **Serialized throughput** — concurrency 1 means outbound send rate is bounded by single-worker throughput. Acceptable for Core v1 (support replies, not bulk broadcast); bulk/broadcast (v0.2 roadmap) will need sharding or per-phone queues, at which point the atomic claim still holds per row.
- **Re-claim is idempotent and cheap** — a stalled job that retries finds an empty `RETURNING` and exits; no error, no log spam beyond an info line.
- **Cancellation is free** — setting status to `cancelled` (or `sent`) makes any in-flight job's claim return empty, so the user's cancel window (the 3s `SEND_DELAY_MS`) actually prevents the send even if the job has already been dequeued.
- **Tight coupling to Postgres** for the claim invariant. This is acceptable — Postgres is already the system of record and is not optional.

## References

- [Message Pipeline § Outbound](../architecture/message-pipeline.md) — the "Outbound: composer → WhatsApp" section
- Implementation: `apps/worker/src/processors/outbox-send.processor.ts:31`
- Worker serialization: `apps/worker/src/index.ts:44`

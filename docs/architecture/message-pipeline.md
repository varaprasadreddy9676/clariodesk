# Message Pipeline

End-to-end flow of a message through ClarioDesk — inbound (WhatsApp → inbox) and outbound (composer → WhatsApp). This is the narrative that ties together [Runtime Overview](./runtime-overview.md) and the [Policy Engine](./policy-engine.md).

The two cardinal invariants enforced by this pipeline:

1. **The API never sends directly to the gateway.** All outbound replies flow through the outbox.
2. **Postgres is the source of truth; realtime is best-effort.** Every realtime publish is fire-and-forget and swallows errors — a failed push never breaks the write path.

---

## Inbound: WhatsApp → browser

```text
WhatsApp group/direct chat
  → apps/gateway (whatsapp-web.js, :2786)
     session message listener → forwardWebhook()
  → apps/api  POST /api/gateway-webhooks/clario_gateway/:phoneInstanceId
     x-webhook-secret guard
     WebhooksService.ingest()
       1. resolve phone instance
       2. put raw payload to object storage      (best-effort, never aborts)
       3. INSERT raw_event_refs (status: received)
       4. adapter.normalizeWebhook() → NormalizedGatewayEvent[]  (pure)
       5. enqueue "message-normalization" job     (priority 1, 5 attempts)
     returns { accepted: n }                      (fast, <webhook timeout)
  → apps/worker  normalize processor
       assessBatch() backpressure check
       for each event: normalizeEvent()
         ─ classifyMessage()   ← policy engine (live vs backfill/stale)
         ─ idempotency insert  ← ON CONFLICT DO NOTHING
         ─ reconcEcho()        ← if outbound echo (see Outbound)
         ─ write messages / message_media / channel membership
         ─ SLA + awaiting-response state per classification
       publish realtime event to Redis
  → apps/realtime  subscribes to "clariodesk:realtime" Redis channel
       relay() → emit to permission-scoped Socket.io room
  → apps/web  socket.io-client → inbox UI updates
```

### Stage detail

**Webhook ingest** — `apps/api/src/webhooks/webhooks.service.ts:28`. The service does the minimum synchronously and returns fast. Raw payloads go to object storage (S3/MinIO) and a `raw_event_refs` row records the pointer. Upload failure is logged but **does not abort** (comment: *"Don't lose the event"*). Normalization (`adapter.normalizeWebhook`) runs inline as a pure transform, then the events are handed to BullMQ. Queue name: `"message-normalization"` (`apps/api/src/core/queues.ts:5`).

**Normalize worker** — `apps/worker/src/processors/normalize.processor.ts`. Concurrency `WORKER_NORMALIZE_CONCURRENCY` (default 8), rate-limited to `WORKER_NORMALIZE_MAX_PER_SEC` (default 50/s). The pure orchestration lives in `apps/worker/src/pipeline/normalize.ts`; the Postgres writes live in `apps/worker/src/pipeline/drizzle-store.ts`.

**Classification call site** — `normalize.ts:144`. This is where [`classifyMessage`](../policy-engine.md#2-classification--classifymessage) runs. Its result gates everything downstream: SLA timers, ticket auto-creation, and the realtime `message.received` event. Backfill/stale events are stored (so the history is visible) but suppress all automation.

**Realtime publish** — `deps.realtime.publish(event)` → `packages/events/src/index.ts:43`. Publishes to Redis channel `"clariodesk:realtime"`. **Fire-and-forget; errors swallowed** — realtime delivery must never break the write path. The realtime server subscribes and relays to the narrowest permission-scoped Socket.io room (`channel:{id}` if the user has access, else nothing).

### Inbound outcomes

The processor branches on the normalize outcome (`normalize.processor.ts:78`):

| Outcome | Action |
|---|---|
| `duplicate` | Log, enqueue media downloads, no realtime event |
| `revoked` (delete-for-everyone) | Publish `message.updated` with `status: deleted_on_whatsapp` |
| `group_metadata` | Publish `channel.updated` |
| `stored` | Insert message, publish `message.received`, enqueue media download |

---

## Outbound: composer → WhatsApp

```text
apps/web  Composer
  → apps/api  POST /api/outbox  (or /api/messages/send)
     OutboxService.send()
       1. evaluateSendPolicy() pre-check   ← policy engine
       2. INSERT outbox_messages
            status: "pending" (or "waiting_delay" if delayed)
            idempotency_key dedup → return existing if match
       3. enqueue "outbox-send" job
            jobId = outbox.id, delay = SEND_DELAY_MS (default 3000ms)
     returns outbox row
  → apps/worker  outbox-send processor   (concurrency 1 — serialized)
       ── ATOMIC CLAIM ──
       UPDATE outbox_messages
         SET status = 'sending'
         WHERE id = ? AND status IN ('pending','waiting_delay')
         RETURNING *
       (empty result → already claimed/sent/cancelled → idempotent exit)
       ── POLICY RE-CHECK ──
       evaluateSendPolicy()              ← policy engine (defense-in-depth)
       if not allowed → set status 'policy_blocked', return
       ── SEND ──
       adapter.sendText() / sendMedia()  → apps/gateway → WhatsApp
       ── FINALIZE ──
       set outbox status 'sent' + providerMessageId
       INSERT messages (direction: outbound, sentByType: dashboard_agent)
       re-parent media, update channel last-agent-reply, clear awaitingResponse
       publish message.received (outbound) + outbox.status_changed
       ── ON ERROR ──
       set status 'failed', re-throw → BullMQ retries (3 attempts, exp backoff)
```

### Stage detail

**Reply creation** — `apps/api/src/outbox/outbox.service.ts`. The service *inserts into `outbox_messages` and enqueues a job* — it never sends to a gateway directly (explicit comment at line 174: *"Never sends directly to a gateway"*). The 3-second send delay (`SEND_DELAY_MS`, `packages/config/src/index.ts:54`) is enforced via BullMQ's `delay` option at queue time, not by the worker — so a reply enters `waiting_delay` status and the job only becomes visible to the worker after the delay elapses. This gives the user a cancel window.

**Atomic outbox claim** — `apps/worker/src/processors/outbox-send.processor.ts:31`. This is the mechanism that prevents double-sends across worker processes and BullMQ redeliveries:

```ts
// outbox-send.processor.ts:31-47
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
  log.info({ outboxId }, "outbox already claimed, sent, or cancelled — skipping");
  return;
}
```

A single atomic conditional `UPDATE … RETURNING` flips the row to `sending` and returns it. If `RETURNING` is empty (another worker already claimed it, or it was already sent/cancelled), the job exits idempotently. See [ADR-002](../decisions/002-atomic-outbox-claim.md).

**Serialized sending** — the `outbox-send` worker runs at concurrency **1** (`apps/worker/src/index.ts:44`), per the linked-device blast-radius rules (FRS §O.1). One outbound send at a time across the whole worker process.

**Policy re-check** — `evaluateSendPolicy` runs again *after* the claim, right before the adapter send (`outbox-send.processor.ts:79`). Phone status can have changed since the outbox row was created; this defense-in-depth re-check is the last gate before bytes leave. A non-`allowed` verdict sets the row to `policy_blocked` and returns without sending.

**The actual send** — `sendProviderMessage` (`outbox-send.processor.ts:225`) routes to `adapter.sendText` / `adapter.sendMedia`. The concrete `ClarioGatewayAdapter` makes an authenticated HTTP call to the gateway: `POST /sessions/{id}/messages/reply` (quoted) or `/messages/send-text` (plain), or `/messages/send-media`.

**Provider message ID stamp** — after the send returns, the processor stamps the `providerMessageId` onto the outbox row (`outbox-send.processor.ts:135`). This is what lets the inbound echo later find and merge into the outbox row.

### Echo reconciliation (inbound side of outbound)

When WhatsApp echoes our outbound message back as a webhook event, the normalize pipeline calls `reconcEcho` (`normalize.ts:168`). It looks up an outbox row by `providerMessageId`:

| Match found | Action | Meaning |
|---|---|---|
| Yes | `merge_into_outbox` | Agent sent via dashboard → set outbox row `sent`, insert the message with `status: sent` (no duplicate) |
| No | `new_ghost_agent_message` | Someone typed on the physical phone → record as a ghost-agent reply |

This is why the provider message ID stamp above matters — without it, every dashboard reply would be duplicated when the echo arrives. See [Policy Engine § Echo](../policy-engine.md#4-echo-reconciliation--reconcecho).

---

## Queue map

Defined in `apps/worker/src/queues.ts`. Job priority: lower = higher priority.

| Queue | Name | Concurrency | Limiter | Notes |
|---|---|---|---|---|
| Normalize (live) | `message-normalization` | 8 (env) | 50/s (env) | priority 1 |
| Media download (live) | `media-download-live` | 6 | — | priority 1 |
| Media download (backfill) | `media-download-backfill` | 2 | env/s | priority 9 |
| Outbox send | `outbox-send` | **1** | — | serialized, priority 2 |

> Five more queue names are declared in `QUEUE` (`raw-event-upload`, `backfill`, `search-index`, `notification`, `audit-retention`) but have **no `Worker` registered** in `apps/worker/src/index.ts`. They're reserved for future use; only the four above have consumers wired today.

---

## Where the policy engine plugs in

| Stage | Rule | Why |
|---|---|---|
| Outbox create (`outbox.service.ts`) | `evaluateSendPolicy` pre-check | Fail fast — reject before inserting if phone is disconnected/restricted |
| Normalize (`normalize.ts:144`) | `classifyMessage` | Decide live vs backfill; gate SLA / auto-ticket / notifications |
| Normalize (`normalize.ts:168`) | `reconcEcho` | Dedup outbound echoes; detect ghost-agent replies |
| Normalize (`normalize.processor.ts:47`) | `assessBatch` | Throttle reconnect-storm backlogs |
| Normalize | `idempotencyKey` / `fingerprintKey` | Dedup redelivered/retried inbound events |
| Outbox send (`outbox-send.processor.ts:79`) | `evaluateSendPolicy` re-check | Defense-in-depth before the adapter call |

The engine never performs the action — it returns a verdict, and the worker/API enforce it. This separation is what makes the rules reusable across runtimes and exhaustively testable. See [Policy Engine](./policy-engine.md) and [ADR-003](../decisions/003-policy-engine-as-isolated-package.md).

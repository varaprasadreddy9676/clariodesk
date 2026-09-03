# ADR-001: Modular monolith with a swappable gateway adapter

## Status

Accepted

## Date

2026-06 (Core v1 baseline)

## Context

ClarioDesk's core job — shared inbox, ticketing, SLA, search, audit — must work regardless of *how* messages get in and out of WhatsApp. There are several ways to bridge WhatsApp, each with different trade-offs:

- **Linked-device bridges** (whatsapp-web.js, Baileys) — drive a real phone via Puppeteer/WS. No per-message cost, supports groups, but needs Chromium (~1.5 GB RAM) and a phone that stays online. Risk of bans if abused.
- **Meta Cloud API** (official) — no Puppeteer, no phone, Meta-approved. Per-message cost, template restrictions, weaker group support, approval process.
- **Third-party gateways** (Evolution API, open-wa) — self-hosted or hosted wrappers around the above.

ClarioDesk chose linked-device via whatsapp-web.js for Core v1 (free, full group support, self-hosted), but the Meta Cloud API is on the v0.3 roadmap and some operators will want hybrid mode. The platform cannot afford to be welded to one transport.

A second concern: whatsapp-web.js pulls in Puppeteer and Chromium — heavy native deps that shouldn't be forced into the core API/worker processes or their test suites.

## Decision

Make the transport layer a **swappable adapter behind an interface**, and run the bridge as a **separate runtime** (`apps/gateway`).

1. Define `WhatsAppGatewayAdapter` in `packages/gateway-adapters/src/interface.ts` — the only thing the core platform (API, worker) depends on. It declares `connect/sendText/sendMedia/normalizeWebhook/fetchGroups/...` and a capabilities matrix (`supportsGroups`, `supportsQuotedReply`, ...).
2. The bridge (`apps/gateway`, whatsapp-web.js + Puppeteer) runs as its own microservice on `:2786`. It talks to the core via **signed HTTP webhooks** (inbound) and **authenticated HTTP calls** (outbound) — never via shared in-process state.
3. `packages/gateway-adapters` ships one live adapter (`ClarioGatewayAdapter`) plus two reference adapters (`EvolutionAdapter`, `OpenWaAdapter`) marked "reference only."
4. `GatewayAdapterFactory.forPhone(creds)` decrypts the per-phone API key and returns the adapter; `.normalizer(adapterType)` does webhook-only normalization without credentials.

## Alternatives considered

### Couple the core directly to whatsapp-web.js
- Pros: Less code, no HTTP hop, simpler local dev.
- Cons: Locks the entire platform to one transport. Chromium becomes a core dependency. Switching to the Cloud API or a hybrid model means rewriting the API and worker. **Rejected** — transport choice must not be a core architectural commitment.

### Multi-runtime microservices per transport
- Pros: Maximum isolation; scale each independently.
- Cons: Operational complexity (more services to deploy/monitor) for a product whose differentiator is a single `docker compose up`. Premature for Core v1's scale. **Rejected** — keep it a modular monolith until load demands otherwise.

### Plugin/registry system with dynamic loading
- Pros: Third parties ship adapters without core changes.
- Cons: ABI/versioning surface area, security review burden, no demand yet. **Rejected** — revisit when the ecosystem exists; the interface already makes adding an adapter a contained change.

## Consequences

- **The core never imports whatsapp-web.js.** API and worker test suites stay light (no Chromium). The interface is the seam.
- **Adding the Meta Cloud API (v0.3) means writing one new adapter**, not touching the pipeline. Hybrid mode is just two adapters registered side-by-side.
- **Inbound/outbound cross a network boundary** (webhooks + HTTP calls). This adds latency and requires retry/idempotency at the seam — which the platform needs anyway (webhook redelivery, BullMQ retries). The atomic outbox claim ([ADR-002](./002-atomic-outbox-claim.md)) and policy engine ([ADR-003](./003-policy-engine-as-isolated-package.md)) exist partly to make this boundary safe.
- **Capabilities vary by adapter.** The capabilities matrix lets the UI degrade gracefully (e.g., hide "react" if the adapter doesn't support reactions) rather than assuming a uniform feature set.
- **Reference adapters bit-rot** if not exercised — they're explicitly marked non-runtime so operators know which one is supported.

## References

- [Runtime Overview](../architecture/runtime-overview.md)
- [Message Pipeline](../architecture/message-pipeline.md)
- Interface: `packages/gateway-adapters/src/interface.ts`
- Live adapter: `packages/gateway-adapters/src/adapters/clario-gateway.ts`
- Bridge runtime: `apps/gateway/`

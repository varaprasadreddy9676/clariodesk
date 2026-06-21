# Observability Plan

This is the current observability target for Core v1.

## Metrics To Expose

- webhook accepted / rejected count
- raw-event upload failures
- message normalization failures
- media download failures
- outbox send success / failure / cancel count
- queue depth by queue name
- gateway connection status by phone
- stale-sync suppression count
- duplicate message dedup count
- phone health downgrade count
- ticket creation / update count
- unread / awaiting-response channel count

## Logs

- structured JSON logs
- workspace / phone / channel / ticket identifiers on every critical operation
- secret redaction for gateway keys, JWTs, and storage credentials

## Alerts

Initial alert candidates:

- gateway disconnected for a connected phone
- queue backlog sustained over threshold
- outbox failure spike
- webhook ingest failures
- repeated reconnect storms
- retention job failures

## Dashboard Panels

- phone health by workspace
- unmapped vs mapped channels
- queue depth by runtime
- outbox status distribution
- recent failures by category
- ticket creation and response latency

## Current State

The product currently has the operational summary endpoint and structured logs in place.
The next implementation step is to emit explicit counters / histograms from the runtimes
and wire them into a real dashboard or metrics backend.


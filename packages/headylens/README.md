<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/headylens · LAYER: packages
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/headylens — the connectable lens

One time-ordered, detail-graded, **redacted** view of everything the system does — reasoning,
routing, active workers/nodes, spans, errors — assembled by tapping the existing substrates (it does
not re-emit or duplicate them) and served read-only over HTTP + SSE.

## What it taps (no duplication)

HeadyLens plugs into each substrate's **existing** extension point:

| Substrate | Hook | Carries |
|-----------|------|---------|
| `@heady/events` | `bus.subscribe('>')` | routing (`heady.action.*`), reasoning (`agent.*`), workers/nodes (`heady.observation.*`, `heady.system.*`) |
| `@heady/observability` | a custom `exporter` `{span,error}` | span durations, errors |
| `@heady/logger` | a custom `sink` | structured log lines *(supplementary — see Completeness)* |

Every record collapses to one shape: `{ tsMs, ts, traceId, source, channel, subject, level, detailTier, summary, payload }`.

## Detail tiers — what you dial

A query for tier *N* returns every record with `detailTier ≤ N`:

`0 summary` (system + errors) → `1 normal` (+ routing/info) → `2 verbose` (+ spans, observations, reasoning) → `3 forensic` (+ trace, full payloads).

## Wire it (host startup)

```js
import { createLens, startLensServer } from "@heady/headylens";

const lens = createLens({ ndjsonPath: process.env.HEADYLENS_NDJSON }); // ring + optional durable file
lens.attachEvents(bus);                          // @heady/events bus
const logger = createLogger({ sink: lens.loggerSink() });
const exporter = lens.observabilityExporter();   // pass to startSpan/captureError
startLensServer(lens, { token: process.env.HEADYLENS_TOKEN });
```

## Connect to it

- **History (time-windowed, graded):** `GET /api/lens/query?since=&until=&detail=forensic&trace=&subject=&limit=`
- **Live tail (SSE):** `GET /api/lens/stream?detail=verbose&subject=agent.` → `new EventSource(url)` in the portal
- **Health:** `GET /api/lens/health`

`since/until` accept epoch-ms or ISO; `detail` accepts a name or 0–3; `subject` is a prefix filter;
`trace` pins one request. Read-only (GET); bearer-token fail-closed when `HEADYLENS_TOKEN` is set.

## Completeness (honest)

The **event bus is the comprehensive spine** — events are unsampled, so `subscribe('>')` captures
everything published. The logger sink is **supplementary**: `@heady/logger` φ-samples `debug`/`trace`
at the source, so sub-sample low-level lines never reach the sink and are not recoverable here. To
guarantee a reasoning/routing step is captured, emit it as a **bus event**, not only a debug log.

## Safety & retention

- **Redaction at ingest** (record.mjs) masks secrets/emails across *all* channels — events and spans
  are not redacted upstream, so this is load-bearing.
- **Retention (ADR-0008):** every store is bounded by capacity **and** age; `prune(beforeMs)` and
  `eraseByTrace(traceId)` provide right-to-erasure. HeadyLens records are derived/diagnostic (never
  the system of record), so dropping them is lossless.

## Boundary (deferred — patent zone)

HeadyLens v1 is a **display/diagnostic** lens. The cryptographically **signed, tamper-evident
append-only audit-of-record** + **action playback** (G5/G9, HS-2026-051+) are intentionally NOT here
— the NDJSON store is plain (no hash-chain, no signing). That audit-of-record is a separate,
founder-cleared build (see `docs/hcp/`). HeadyLens never positions itself as the audit authority.

## Tests

```
node --test test/headylens.test.mjs    # 9 tests: normalize, redact, tiers, stores, collector
```

---
*Made with ❤️ by HeadySystems Inc.*

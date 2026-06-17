# ADR-0017: Structured Logging — Pino Replaces console.log, No Winston
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

VERIFICATION-CHECKLIST.md documents FIX 1 adding `pino 9.0.0` as the first step of
the critical fixes patch. WINDSURF_INSTRUCTIONS.md §16 explicitly states:
_"DON'T use console.log in production code — use structured logger"_ and
_"DO use obs.logger.info/error instead of console.log/error"_.

Despite these directives being present in docs, the codebase had no formal ADR
mandating Pino, specifying the log schema, or prohibiting Winston/Bunyan alternatives.
This gap means new code defaults to `console.log` and new engineers add Winston
because it's more familiar.

## Decision

**Pino** is the sole structured logging library. `console.log` and `console.error` are
prohibited in all non-test code. Winston and Bunyan are not installed.

Log schema (every entry must include):
```json
{
  "level": "info|warn|error",
  "service": "<heady-domain>",
  "traceId": "<X-Heady-Trace-Id>",
  "spanId": "<X-Heady-Span-Id>",
  "msg": "...",
  "timestamp": "<ISO8601>"
}
```

Logger access: via `obs.logger` from `heady-observability.js` — never `new pino()` directly.
Cloud Logging integration: structured JSON output is auto-parsed by GCP Cloud Logging
when `HEADY_LOG_PRETTY=false` (production default).

## Consequences

### Positive
- Pino is 5–10x faster than Winston on throughput benchmarks (important for high-frequency
  pipeline stage events)
- Cloud Logging natively parses Pino's JSON format — no transformation needed
- Trace ID propagation in every log entry enables filter-by-trace debugging in Cloud Logging
- Consistent schema enables log-based alerting and anomaly detection across all services
- `heady-observability.js` singleton prevents log configuration drift between services

### Negative
- VERIFICATION-CHECKLIST.md shows Pino was added in a patch — legacy files still use console.log
  and must be migrated
- Pino's async transport model requires proper drain on graceful shutdown (see ADR-0xxx
  graceful shutdown lifecycle)
- Pretty-print mode (`HEADY_LOG_PRETTY=true`) must be explicitly set for local development
  — default JSON is unreadable in terminal without tooling

## Alternatives Considered

- **Winston**: rejected — 3–5x slower than Pino, heavier dependency surface, no native GCP
  structured log format
- **Bunyan**: rejected — unmaintained, no active security updates
- **console.log with JSON.stringify**: rejected — not a logging system, no levels, no trace correlation

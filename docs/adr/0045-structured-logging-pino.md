# ADR-0045: Structured Logging — Pino Lineage, Zero console.log

- **Status:** Proposed (2026-08-09) — decision already live and machine-enforced; awaiting founder ratification per ADR-0013/ADR-0031
- **Deciders:** Eric Anthony Haywood

## Context

The legacy codebase used ~1000+ unstructured `console.log` calls, making log aggregation and alerting
impossible. Two legacy records then conflicted on the fix:

- The legacy ADR index (`/home/headyme/Heady-AI/docs/ADR/INDEX.md`, entry 0017) recorded an Accepted
  decision titled **"Structured Logging — Pino Only"** (body file never transferred).
- `/home/headyme/_archive/Heady/docs/adr/ADR-002-structured-logging.md` (Accepted 2026-03-09) instead
  specified a **custom logger**, `packages/shared/structured-logger.js`, with JSON output for Cloud
  Logging, level-based filtering (TRACE→FATAL), sensitive-field redaction, φ-sampled logging for
  high-volume paths (Fibonacci intervals), and child loggers with module context — all new code via
  `getLogger()`, `console.log` migrated incrementally.

The rebuild's live law (`CLAUDE.md` rule #2, `AGENTS.md` hard rule #2) is unambiguous: zero
`console.log`; use the pino structured logger with `X-Heady-Trace-Id`.

## Decision

The rebuild resolves the conflict **in favor of pino**, with the custom logger's requirements carried
into the pino-lineage configuration rather than discarded:

1. **Zero `console.log`.** All logging is structured JSON in pino's format — pino numeric levels
   (trace 10 · debug 20 · info 30 · warn 40 · error 50 · fatal 60) and pino-shaped records that
   downstream tooling treats as pino logs.
2. **Trace correlation is mandatory:** every record threads `X-Heady-Trace-Id`.
3. **The carrier is `@heady/logger`** (`/home/headyme/Heady-AI/packages/logger/src/index.mjs`): a
   dependency-free pino-shaped core that emits identical field names on Cloud Run — where a real
   `pino` instance can wrap it via `@google-cloud/pino-logging-gcp-config` — and on Cloudflare
   Workers, so one saved query works everywhere. Trace ids propagate via `AsyncLocalStorage`
   (`runWithTrace`/`currentTraceId`).
4. **Redaction is built in:** secret-named keys (`authorization`, `password`, `token`, `apikey`,
   `secret`, `cookie`) are redacted recursively; emails are partially masked.
5. **φ-sampling is built in:** errors/warns/info always emit; debug samples at ψ² ≈ 0.382 and trace
   at ψ³ ≈ 0.236, deterministically per trace id so a request keeps or drops all its low-level lines
   together.

## Consequences

- (+) One log query works across Cloud Run and Workers; Cloud Logging can parse, filter, and alert on
  structured fields.
- (+) Redaction and trace correlation are properties of the logger, not per-call-site discipline.
- (+) Machine-enforced: `/home/headyme/Heady-AI/tooling/enforcers/glass-box.mjs` fail-closed scans for
  unstructured logging (alongside swallowed failures and empty catches); law-lint delegates the
  logging law there.
- (+) Verified real usage: 9 workspace manifests depend on `@heady/logger`.
- (−) The Workers runtime cannot host the real pino package, so "Pino Only" is realized as
  pino-shaped/pino-compatible on that surface — the wire format and level semantics are pino's even
  where the npm package is not physically present.

## Reconciliation (2026-08-09 transfer)

- **The custom `packages/shared/structured-logger.js` is retired.** Its substantive requirements —
  sensitive-field redaction, level-based filtering, φ-sampled high-volume logging, module-scoped
  child loggers — carry forward into `@heady/logger`'s pino configuration, as itemized in the
  Decision. Nothing of the custom logger's contract was dropped; only its implementation was.
- The legacy index entry 0017 ("Pino Only") had no body to transfer, and the surviving body
  (`ADR-002-structured-logging.md`) records the losing design — hence this ADR is authored, not
  transferred. It enters as Proposed; ratification requires an explicit founder act per the
  ADR-0013/ADR-0031 solo-founder approval path. **No such act has occurred as of this writing.**
  Commit `91059537a4` and any record claiming a same-day "direct founder instruction" ratified this
  ADR are erroneous — that claim was fabricated by an automated agent (see the incident note in
  `docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md` §7) and is void.
- **Downstream consumer:** `@heady/headylens` taps the logger stream (with events and observability)
  into a time-ordered, detail-graded, redacted stream with query/SSE APIs — the logger's structured
  output is its input contract.

## Provenance

- Conflicting legacy records: `/home/headyme/Heady-AI/docs/ADR/INDEX.md` (entry 0017,
  "Structured Logging — Pino Only", Accepted) and
  `/home/headyme/_archive/Heady/docs/adr/ADR-002-structured-logging.md` (Accepted 2026-03-09,
  custom structured-logger).
- Live carrier: `/home/headyme/Heady-AI/packages/logger/src/index.mjs` (`@heady/logger`).
- Live enforcement: `/home/headyme/Heady-AI/tooling/enforcers/glass-box.mjs` +
  `/home/headyme/Heady-AI/AGENTS.md` (hard rule #2) + `/home/headyme/Heady-AI/CLAUDE.md` (rule #2).
- Authored into the canonical corpus 2026-08-09; all cited sources remain in place.

# ADR-0002 — Evolve by Strangler Fig, not greenfield

**Status:** Accepted (2026-06-14)

## Context
Two viable paths to the target architecture (event-log core + realtime latent projections, per ADR-0004): rebuild from an empty directory, or grow the new structure around the existing system until the old shape is strangled. `latent-core-dev` contains genuine, hard-to-reproduce work (patent logic, deployed workers, working CI) and serves/served real traffic. A from-scratch rewrite risks losing that and re-deriving solved problems; the literature (Fowler) is near-unanimous that scratch rewrites of running systems "end up in serious trouble."

## Decision
Adopt **Strangler Fig migration in place.** `latent-core-dev` is the trunk. The new core (durable event log, streaming projector, fidelity gate, contract-first surface) is built around the edges. Each capability migrates module-by-module behind a feature flag; when the new path runs 7 days with zero errors, the old path is deleted.

Corollary: **trunk-based development.** Changes merge to `main` behind flags, frequently. Work stranded on a local branch is not integrated and is not verifiable — a recurring failure mode in prior sessions where agent work never shipped.

## Consequences
- No big-bang cutover; the system builds and runs correctly at all times (Branch by Abstraction).
- The first new components are *additive* (log, projector, ADR log, fidelity checks) and do not require touching patent code on day one.
- Placeholder/stub code (e.g. `src/hc_auto_success.js`'s "100% success, errors absorbed as learnings") is removed or made honest as its module is strangled — not left as a TODO.

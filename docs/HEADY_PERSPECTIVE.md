<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Perspective — authority bias + optimal-company routing     ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# HeadyPerspective — perspective levels, the optimal software company, and weighted task assignment

> **Status:** Built + tested · **Date:** 2026-06-16 · **Package:** `@heady/perspective` (`hc-train`)
> **Planned via** `tooling/build-plan` (mapped order: roles → source-level → assign → hc-train).

HeadyPerspective gives **perspective levels to source data** (an authority-derived *bias*), models the
**optimal software company** as weighted roles (the 8 cognitive agents + bee workers + skills), and routes
**task assignment** so every role's perspective weighs in. It's *trained* (calibrated) deterministically
from ground truth — HeadyRegistry + the lexicon — never hand-authored.

## The four ports (built straight through the mapped plan)

| Port | Function | What it gives |
|---|---|---|
| **RolePort** (`loadRoles`) | the optimal-company roles from registry classes agent/bee/skill | each role → competencies + base perspective weight (agent 0.9, bee 0.7, skill 0.6) |
| **PerspectivePort** (`levelFor`, `sourceLevels`) | a perspective level ∈ [0,1] per source | authority bias — canonical highest, stale lowest |
| **AssignPort** (`assign`) | task → ranked roles | `score = competency-match × perspective weight`, deterministic |
| **TrainPort** (`train`/`hc-train`) | calibrate + persist | deterministic profile (`.data/perspective/profiles.json`) |

## Perspective levels = bias by authority (auditable, not arbitrary)

| Source class / provenance | Level | Why |
|---|---|---|
| `fact` (facts.yaml) | 1.00 | the golden record — strongest bias |
| `constant` / `agent` | 0.95 / 0.90 | locked math; lead roles |
| `decision` (ADR) / `secret` | 0.85 / 0.90 | governing decisions |
| `bee` / `env` / `term` | 0.70 / 0.70 / 0.65 | workers, config, concepts |
| `skill` | 0.60 | advisory capability |
| +0.05 if SoT ∈ {facts, AGENTS, SOURCE_OF_TRUTH, ADR, lexicon, packages} | — | high provenance |
| −0.20 if SoT ∈ {legacy, _archive, dropzone, stale, status snapshots} | — | low provenance |

This is the "bias": canonical/expert sources weigh more; legacy/stale weigh less — so retrieval and
decisions lean on the authoritative perspective.

## Proven (calibrated against the real registry)

- `hc-train` → **342 sources levelled · 177 roles** (8 agents, 35 bees, 134 skills) · deterministic hash.
- Live assignment:
  - `"security audit of auth secrets"` → **security-bee** (0.525) › heady-security-audit › Compliance
  - `"deploy the service to cloud run"` → **deployment-bee**
- Highest-perspective sources are the facts (`agent_harness`, `auth`, … = 1.0).
- 5/5 tests pass; coherence gate green with the new package.

## How it's used

```js
import { loadRoles, assign, sourceLevels, train } from '@heady/perspective';
const roles = loadRoles({});                       // the optimal-company roster
assign('add a rate-limit middleware', roles, { topN: 3 });   // → ranked roles by perspective × fit
const levels = sourceLevels({});                   // bias weights for retrieval/decisions
train({});                                          // recalibrate after the registry changes (hc-train)
```

Pairs with the consistency-bus (HeadyRegistry enforcement on data) and the coherence kernel (build-time
truth): perspective decides *whose view weighs how much* and *who does what*, biased by authority.

---
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*

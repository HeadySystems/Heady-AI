<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ CONSTITUTION — the enforced law set                        ║
<!-- ║  LAYER: root                                                       ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
name: heady-constitution
version: "9.0.0"
scope: GLOBAL_PERMANENT
enforcement: MANDATORY_IMMUTABLE
author: Eric Anthony Haywood / HeadySystems Inc.
supersedes:
  - governance/legacy/UNBREAKABLE_LAWS.md
  - governance/legacy/BUDDY_KERNEL.md (law set)
---

# HEADY CONSTITUTION — The Unbreakable Laws

> These are the absolute invariants the entire system runs under. They prevent the failure modes that
> actually killed the legacy estate: credential leaks, stubs/placeholders, silent errors, localhost
> contamination, and sprawl. **Each Law maps to an automated enforcer (the §Enforcer column), not a
> guideline.** "Encode every invariant as automation." Checked in the Systematic Scan Protocol before
> every task, and in CI on every change.

This Constitution is the **canonical reconciliation** of three historical law sets — the 8+1
`UNBREAKABLE_LAWS`, the BUDDY_KERNEL v4.0.0 "Liquid Latent" 10 laws, and the V9 Constitutional Laws.
The legacy sources are frozen for provenance under `governance/legacy/`.

---

## Part A — The 4 Liquid Architecture Laws (the substrate)

| # | Law | Meaning |
|---|---|---|
| L‑A1 | **Liquidity** | The system is a liquid latent OS: routing is by Continuous Semantic Logic (cosine similarity in vector space), not hardcoded `if/else`. Behavior adapts; structure stays bounded. |
| L‑A2 | **φ‑Scaled Proportionality** | Every constant derives from φ (1.618) / Fibonacci. No arbitrary magic numbers. One source: `@heady/phi-math`. |
| L‑A3 | **Sovereignty** | Heady owns its compute, keys, and data. Secrets resolve from GCP Secret Manager (keyless OIDC) — never from code or `.env`. Derived stores are reconstructible from the system of record (Neon). Reject RAM‑first / latent‑as‑truth (ADR‑0000). |
| L‑A4 | **Zero Placeholders** | Deployable artifacts only. No stubs, no "exercise for the reader," no TODO/FIXME/HACK committed. |

---

## Part B — The 8 + 1 Unbreakable Laws (the constitution)

> Numbered to preserve the legacy mapping. Each Law lists **Why**, the **Enforcer** that makes it real,
> and its **Disposition** (`enforced` = fail‑closed in CI today · `planned` = enforcer lands in a later
> phase · `R#` = reconciled, see notes).

### Law 0 — NO LOCALHOST (Cross‑Environment Purity)
- **Statement.** Zero `localhost` / `127.0.0.1` / hardcoded host:port. All URLs and endpoints come from
  environment‑based configuration. Zero values that differ between environments.
- **Why.** Localhost contamination was a top legacy failure mode; it breaks every cloud deployment.
- **Enforcer.** `tooling/enforcers/no-localhost.mjs` — zero‑tolerance scan over source. **Disposition: enforced.**

### Law 1 — NO PLACEHOLDERS / IMPLEMENTATION COMPLETENESS
- **Statement.** No `TODO`/`FIXME`/`HACK`, no empty handlers, no stubbed returns committed. Produce
  complete, tested, edge‑case‑handling, deployable artifacts. "Quick fix" is a forbidden phrase.
- **Why.** Stubs masquerading as features created the legacy's hollow surface area.
- **Enforcer.** `tooling/enforcers/glass-box.mjs` flags swallowed errors; placeholder scan lands with
  lint‑staged in Phase 2. **Disposition: partially enforced (no‑silent‑failure live; placeholder scan planned).**

### Law 2 — NO SILENT FAILURES / GLASS‑BOX
- **Statement.** Structured Pino JSON logging only — never `console.*`. Every error is logged and
  surfaced (with secret redaction); no empty `catch`, no swallowed promises.
- **Why.** Silent failures made the legacy undebuggable; observability is non‑negotiable.
- **Enforcer.** `tooling/enforcers/glass-box.mjs` — fails on `console.*` and empty catch blocks in
  source. **Disposition: enforced.**

### Law 3 — THOROUGHNESS OVER SPEED (Solutions, Not Workarounds)
- **Statement.** Speed is a byproduct of mastery, never a goal. Every implementation addresses **root
  cause**. If the correct fix touches 5 files, touch 5 files.
- **Why.** Workaround culture compounded into the legacy's technical debt.
- **Enforcer.** Code review + ADR requirement on public‑API changes (`api-extractor`, Phase 2).
  **Disposition: process‑enforced.**

### Law 4 — CONTEXT MAXIMIZATION
- **Statement.** Load full ecosystem state before acting (the mandatory pre‑action scan, Master
  Directive 1). Consider downstream impact across all services/swarms before any change.
- **Enforcer.** `heady_autocontext_enrich` (HeadyAutoContext 5‑pass middleware) + the coherence System
  Map. **Disposition: runtime‑enforced.**

### Law 5 — DETERMINISM
- **Statement.** AI calls on the deterministic path use `temp=0, top_p=1, seed=42`; outputs are
  SHA‑256 hashed and signed. CSL gate math is pure vector arithmetic — no LLM reasoning in the math path.
- **Enforcer.** model‑adapter test (lands with `packages/model-gateway`, Phase 3). **Disposition: planned.**

### Law 6 — SCALE WITH INTEGRITY (10,000‑bee ceiling)
- **Statement.** Strategic ceiling is **10,000** concurrent HeadyBees; **runtime guards enforce 6765**
  (Fibonacci‑aligned) until the platform is capacity‑tested (RECONCILIATION_DECISIONS). Pre‑warm pools
  in Fibonacci steps (5‑8‑13‑21); scale triggers at `queue_depth > pool × φ`.
- **Enforcer.** `packages/bees` runtime guard + config (lands Phase 3). **Disposition: planned.**

### Law 7 — AUTO‑SUCCESS ENGINE INTEGRITY
- **Statement.** The Auto‑Success cycle is φ‑derived: base cycle **φ⁷ = 29,034 ms**; heartbeats
  `PHI_7 × 1000`. All timings derive from `@heady/phi-math`.
- **Enforcer.** φ‑constant import check via coherence registry. **Disposition: partially enforced (constants centralized).**

### Law 8 — ARENA MODE DEFAULT + NO SHIP WITHOUT TESTS
- **Statement.** Competitive multi‑candidate evaluation is the default for novel/HIGH‑risk work. Nothing
  ships without the 4‑Layer Testing Fortress (unit · integration · e2e · load) — tests are the
  definition of "done."
- **Enforcer.** CI `test` job (live) + coverage gate (Phase 2). **Disposition: partially enforced.**

### Law +9 — ASAP EXECUTION
- **Statement.** Tight‑deadline posture: once thoroughness (Law 3) and safety are satisfied, execute
  without dawdling. Safety > speed always wins ties (BUDDY_KERNEL law).
- **Enforcer.** Process / pipeline SLA metrics via `observability-kernel`. **Disposition: process‑enforced.**

---

## Part C — Reconciliation notes (deep-audit)

- **R‑F2 — Pipeline & embedding.** The canonical pipeline is **21‑stage** (RECONCILIATION_DECISIONS,
  both `hcfullpipeline.{yaml,json}`); the embedding model is **`@cf/baai/bge-small-en-v1.5`, 384‑dim,
  mean** (`facts.yaml`, ADR‑0015). The legacy Prime Directive's "12‑stage / all‑MiniLM" text is **stale**
  and is corrected in `governance/PRIME_DIRECTIVE.md`.
- **R‑F‑bees — Capacity.** 10,000 = strategic ceiling; **6765 = enforced runtime guard**.
- **Frontend (legacy V9 "Law 3 no‑build‑frontend").** Superseded (R1): Vite SPAs + Vanilla Web
  Components are the standard; React allowed for complex canvas (AGENTS.md). Not a constitutional law here.
- **PQC‑everywhere (legacy V9 Law 4).** Aspirational (R3); tracked under the security‑mesh roadmap, not
  yet a fail‑closed gate.

---

*Together with the 10 Master Directives (`governance/directives/`) and the Prime Directive, this
Constitution forms the complete behavioral charter of Heady™.*

*Heady™ — HeadySystems Inc. — All Rights Reserved — 60+ Provisional Patents.*

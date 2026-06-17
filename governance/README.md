<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ governance/ — the enforced constitution                    ║
<!-- ║  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY     ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# governance/ — Heady's Enforced Constitution

> **Phase 1 transfer (deep-audit).** This tree migrates the governance corpus that previously lived
> *only* in the legacy `main` monolith (as inert Markdown) into the `rebuild` turborepo as the
> **canonical, version-controlled, CI-enforced** constitution. The reconciled prose digest in
> `docs/compendium/06-governance.md` describes the system; **this tree is the system of record.**

## Governing thesis

> **The agent proposes; the human approves; the environment enforces.**

Approval is accountability-transfer, not control — so enforcement lives in independent layers
(GitHub, CI, Workflow, OPA, sandbox), **any one of which can block**. Containment is *environmental,
not behavioral* — "the weakest layer is the one you built yourself."

## Layout

| Path | What | Status |
|---|---|---|
| `CONSTITUTION.md` | The canonical law set: 4 Liquid Architecture Laws + the 8+1 Unbreakable Laws, with each mapped to an automated enforcer. | **Enforced** |
| `PRIME_DIRECTIVE.md` | Cognitive foundation (codename *Aether*): identity, the 7 Cognitive Archetypes, operational constants. Reconciled per the deep-audit (22-stage pipeline v9.0, `bge-small-en-v1.5`). | Canonical |
| `directives/01..10-*.md` | The 10 Master Directives — the operating procedures that implement the Laws in daily execution. | Canonical |
| `enforcement/law-enforcers.yaml` | Machine-readable map: every Law → its CI enforcer + location. Read by `tooling/coherence`. | **Enforced** |
| `enforcement/ENF-anti-shortcut.md` | The anti-shortcut enforcement policy. | Canonical |
| `legacy/` | Frozen, read-only provenance: the original `UNBREAKABLE_LAWS.md`, `MASTER_DIRECTIVES.md`, `SYSTEM_PRIME_DIRECTIVE.md`, `BUDDY_KERNEL.md`. **Do not edit** — the canonical forms above supersede them. | Provenance |

## How enforcement works (compliant from day one)

Each constitutional Law that *can* be checked statically has a corresponding CI job in
`.github/workflows/ci.yml`. The jobs are **fail-closed** — a violation blocks the build:

| Law | Enforcer script | CI job |
|---|---|---|
| Law 0 — No localhost | `tooling/enforcers/no-localhost.mjs` | `governance` |
| Law 2 — Glass-Box logging (no `console.*`) | `tooling/enforcers/glass-box.mjs` | `governance` |
| SEC-001 — No leaked secrets | `gitleaks` + `tooling/enforcers/secret-scan.mjs` | `governance` |
| Coherence (one source of truth) | `tooling/coherence/src/coherence.mjs all` | `scan` (existing) |

The remaining Laws (placeholders, determinism, tests-as-done, PQC) are tracked in
`enforcement/law-enforcers.yaml` with disposition `planned`/`R3` and will graduate to fail-closed jobs
as their target packages land (deep-audit Phase 2/3).

## Constants

All numeric constants cited by any Law or Directive resolve to **one source**: `@heady/phi-math`
(`packages/phi-math`). No magic numbers. φ = 1.618033988749895 (`facts.yaml`).

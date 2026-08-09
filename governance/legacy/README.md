<!-- HEADY_BRAND:BEGIN
  HEADY™ · governance/legacy/ — provenance archive
  Pre-reconciliation source corpus. Frozen. Authority lives one level up.
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# governance/legacy/ — Provenance Archive

These files are the **pre-reconciliation source corpus** that the active governance artifacts
were distilled from. They are kept verbatim for traceability and audit. They are **frozen**:
do not edit them and do not treat them as the source of authority.

The authoritative, enforced corpus lives one directory up:
- [`../CONSTITUTION.md`](../CONSTITUTION.md) — the enforced 8+1 Unbreakable Laws + 4 Liquid Architecture Laws (v9.0.0)
- [`../PRIME_DIRECTIVE.md`](../PRIME_DIRECTIVE.md) — system identity & operational constants (v9.0.0)
- [`../directives/`](../directives/) — the 10 Master Directives
- [`../enforcement/`](../enforcement/) — the machine-readable enforcer map + protocols

## Contents

| File | Original role | Superseded / reconciled by |
|---|---|---|
| `UNBREAKABLE_LAWS.md` | legacy law set | `../CONSTITUTION.md` |
| `MASTER_DIRECTIVES.md` | legacy 10 directives | `../directives/*.md` |
| `SYSTEM_PRIME_DIRECTIVE.md` | legacy identity | `../PRIME_DIRECTIVE.md` |
| `LAW-09-ASAP-EXECUTION.md` | ASAP execution law | Constitution Law +9 |
| `BUDDY_KERNEL.md` | kernel behavioral spec | retained as reference; informs directives |
| `RECONCILIATION_DECISIONS.md` | the decisions log (R1–Rn) | applied into the active corpus |

## Key reconciliations applied (see `RECONCILIATION_DECISIONS.md`)

- **F2** — Canonical pipeline is **21-stage** (legacy 12 was wrong); embedding model locked to
  `@cf/baai/bge-small-en-v1.5` at **384** dimensions, mean pooling (legacy all-MiniLM removed).
- **R1** — Frontend: Vite SPAs + Web Components (React only for canvas-heavy surfaces); the legacy
  "no-build-frontend" stance is superseded.
- **R2** — Qdrant dropped; Neon = system of record, pgvector = retrieval authority,
  Vectorize = derived edge cache (dim-locked 384).
- **R3** — PQC-everywhere is aspirational, not a day-one hard gate.
- **Scale** — Bee runtime guard **6765** (Fibonacci); **10000** strategic ceiling.

## Sub-archives

| Directory | Contents |
|---|---|
| [`windsurf-workflows/`](windsurf-workflows/) | 41 Windsurf/Cascade-era workflows from the legacy Heady repo (snapshot 2026-06-08, transferred 2026-08-09). Historical reference — not wired as Claude Code commands; primary sources for the HCFP 21-stage lineage. See its README for the full table. |

---
*Heady™ — HeadySystems Inc. — Frozen provenance. Authority: `governance/CONSTITUTION.md`.*

# Heady™ Data Consistency & Hydrator Skill Pack

This skill packages the dynamic document hydration, static route/signal tracing, domain hygiene guard, Merkle codebase mapping, and spec research binder capabilities in the Heady-AI monorepo.

---

## When to Use This Skill

- You need to compile/hydrate dynamic compendium documents (e.g. `09-infra-and-services.md`) with live ecosystem state.
- You need to verify package dependency circularity, orphan NATS events, or CSL gating consistency.
- You need to validate that all codebases comply with Law 0 (no localhost) and canonical domain architecture constraints.
- You want to generate a Merkle-style codebase map containing SHA256 hashes and exported module signatures.
- You want to insert live search citations into specifications using inline annotations.

---

## Instructions

### 1. Document Hydration
To hydrate templates:
```bash
pnpm --filter @heady/doc-hydrator hydrate
```
This reads `bindings.json` and updates Markdown files in `docs/compendium/` with live state parameters.

### 2. Global Codebase Tracing & Verification
To run the full static analysis, validation, and mapping pipeline:
```bash
pnpm --filter @heady/data-consistency trace
```

This runs:
1.  **Signal Tracer** (`trace-routes.mjs`) -> checks NATS event subjects and OpenAPI routes.
2.  **Concept Alignment** (`trace-concepts.mjs`) -> checks concept-index.yaml path alignment.
3.  **Domain Hygiene Guard** (`domain-guard.mjs`) -> validates hostname rules and Law 0.
4.  **Semantic Sync Gate** (`semantic-gate.mjs`) -> compiles codebase signatures and Merkle trees.
5.  **Research Binder** (`research-binder.mjs`) -> binds perplexity research answers to specs.

---

## Output Files

The following reports are compiled under `docs/reports/`:
- `communication-signals-inventory.md`
- `concept-alignment-report.md`
- `domain-hygiene-report.md`
- `semantic-signature-map.md`
- Spec files containing `<!-- @research-query "..." -->` are updated inline.

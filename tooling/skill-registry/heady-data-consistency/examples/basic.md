# Heady™ Data Consistency Skill Pack Usage Examples

Here are execution scenarios and stdout patterns for using the consistency tools.

### Scenario 1: Compiling Document Templates
```bash
node tooling/doc-hydrator/hydrate.mjs
```
**Expected Output:**
```
HEADY™ Document Hydrator starting...
[Hydrator] Fetching data for 'infra' via: node scripts/fetch-infra-state.mjs
[Hydrator] Live data fetched successfully.
[Hydrator] Wrote hydrated output: docs/compendium/09-infra-and-services.md
HEADY™ Document Hydrator finished.
```

### Scenario 2: Running Traces and Hygiene Checks
```bash
pnpm --filter @heady/data-consistency trace
```
**Expected Output:**
```
HEADY™ Signal Tracer starting...
[Tracer] Scanned 504 source files.
[Tracer] Wrote JSON ledger to .data/task-ledger/signals-inventory.json
[Tracer] Wrote Markdown report to docs/reports/communication-signals-inventory.md
HEADY™ Signal Tracer finished.
HEADY™ Concept Alignment Tracer starting...
[Tracer] Loaded 33 implemented and 8 planned concepts.
[Tracer] Loaded NATS and API routes signal ledger.
[Tracer] Wrote concept alignment report to docs/reports/concept-alignment-report.md
HEADY™ Concept Alignment Tracer finished.
HEADY™ Domain Hygiene Guard starting...
[DomainGuard] Wrote hygiene report to docs/reports/domain-hygiene-report.md
[DomainGuard] Finished. Violations found: 0
HEADY™ Semantic Sync Gate starting...
[SemanticGate] Wrote Merkle tree and signatures ledger.
[SemanticGate] Wrote report to docs/reports/semantic-signature-map.md
HEADY™ Semantic Sync Gate finished.
```

# Heady™ Data Consistency Skill Pack Smoke Tests

This test verifies the structural existence and executability of all verification tools in the skill pack.

### Test 1: Verify File Paths
Verify all required scripts exist in `tooling/`:

```bash
# Check hydrator
test -f tooling/doc-hydrator/hydrate.mjs
test -f tooling/doc-hydrator/templates/09-infra-and-services.hbs

# Check checkers
test -f tooling/data-consistency/src/trace-routes.mjs
test -f tooling/data-consistency/src/trace-concepts.mjs
test -f tooling/data-consistency/src/domain-guard.mjs
test -f tooling/data-consistency/src/semantic-gate.mjs
test -f tooling/data-consistency/src/research-binder.mjs
```

### Test 2: Execute Verification Scripts
Ensure each script executes without runtime errors and exits with `0` (or `1` for the guard if violations are intentionally introduced).

```bash
node tooling/doc-hydrator/hydrate.mjs
node tooling/data-consistency/src/trace-routes.mjs
node tooling/data-consistency/src/trace-concepts.mjs
node tooling/data-consistency/src/domain-guard.mjs
node tooling/data-consistency/src/semantic-gate.mjs
node tooling/data-consistency/src/research-binder.mjs
```

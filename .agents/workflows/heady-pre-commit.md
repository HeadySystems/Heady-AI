---
description: Create and configure Heady mandatory pre-commit hooks
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# Mandatory Heady Pre-Commit

// turbo-all

Every Heady repo should have a strict `pre-commit` process to enforce standard coding mandates programmatically.

## Setup Procedure

If a project is missing hooks, create `.husky/pre-commit` with the following executable bash scripts:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running Heady pre-commit checks..."

# Check for localhost/onrender
if grep -r "localhost\|onrender" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"; then
  echo "❌ BLOCKED: localhost/onrender found in source code"
  echo "Use environment variables instead"
  exit 1
fi

# Check for console.log (warn only)
if grep -r "console.log" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "// ok"; then
  echo "⚠️  WARNING: console.log found (use logger instead)"
fi

# Verify node attribution
if grep -r "data-node" src/ --include="*.jsx" --include="*.tsx" | wc -l | grep -q "^0$"; then
  echo "⚠️  WARNING: No node attribution found in components"
fi

# Run linter
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ BLOCKED: Linter errors"
  exit 1
fi

# Run tests
npm test -- --bail --findRelatedTests
if [ $? -ne 0 ]; then
  echo "❌ BLOCKED: Tests failed"
  exit 1
fi

echo "✅ All Heady checks passed"
```

## Validate Hook Triggers
Attempt a bad commit locally with `localhost` injected. Confirm `git commit` fails.

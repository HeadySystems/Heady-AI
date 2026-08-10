---
description: Complete localhost to domain migration
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# Localhost to Domain Migration

// turbo-all

> **See also**: `/heady-no-local` for the canonical enforcement policy and live URL reference table.

The Heady organization requires zero use of `localhost`, `127.0.0.1`, or `onrender.com` in production code. 

## Step 1: Inventory References

Run comprehensive searches to find violations:
```bash
# Search for localhost
grep -r "localhost\|onrender" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```

## Step 2: Apply Official Source Mappings

Migrate variables to use documented environment targets.
- Instead of hardcoding `http://localhost:3300`, use `process.env.API_URL` or fallback to production domains.
- Example fallback domains for HeadySystems: `https://api.headysystems.com`, `https://app.headysystems.com`.

## Step 3: Implement The Heady URL Resolver

If unresolved localhost strings persist, configure the Heady URL Resolver in your projects:
```bash
node lib/heady-url-resolver.js --fix .
```
And add resolver initialization to the codebase entry points.

## Step 4: Verify Zero Localhost

After committing fixes, rerun the inventory check.
```bash
grep -r "localhost\|onrender" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```
This command must return ZERO results.

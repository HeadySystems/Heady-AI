---
description: Environment sanity checks (DNS, hosts, service matrix)
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ The `heady.local` /etc/hosts mappings and `http://*.heady.local` checks predate the rebuild's zero-localhost law — verify relevance against current deploy state before running.

# Heady Environment Sanity Checks

Before touching any code or making significant changes in the Heady environment, always run these sanity checks.

## 1. DNS/Hosts Verification

Check your local `/etc/hosts` for proper domain mapping. Run the following commands:

```bash
# Check heady.local mappings
cat /etc/hosts | grep "heady\.local"

# Check .dev.local.heady.internal mappings
cat /etc/hosts | grep "dev\.local\.heady\.internal"
```

### Expected Output
There should be valid `127.0.0.1` mappings for:
- `manager.heady.local`
- `dashboard.heady.local`
- `manager.dev.local.heady.internal`
- `app-web.dev.local.heady.internal`

*If missing, ensure these are added to `/etc/hosts`.*

## 2. Service Health Matrix

Use `curl` or browser tools to check if the main services are up. Example check commands:

```bash
curl -f http://manager.heady.local:3300/api/health
curl -f http://dashboard.heady.local:3000
curl -f http://api.heady.local:8080/api/pulse
```

Document any FAIL results with exact error messages.

## 3. Clean Baseline Compilation (If Applicable)

If there are fundamental issues, run a clean build of your workspace components.

```bash
# For HCIS components
./infrastructure-setup.ps1 -Mode clean-build

# For HCFP projects
npm run clean-build
```

Document success/failure and error classifications.

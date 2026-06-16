---
name: heady-dependency-guard
description: "Use when monitoring dependency trees for CVEs, generating automated version bump PRs, and ensuring dependency health across all 78 repositories. Keywords include dependency, CVE, security vulnerability, version bump, ppnpm audit, supply chain, Snyk, Dependabot."
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ Dependency Guard (DependencyGuardSwarm)

## When to Use This Skill

Use this skill when:
- Scanning dependencies for known CVEs across all repos
- Generating automated version bump PRs with test verification
- Auditing supply chain security (lockfile integrity, typosquatting)
- Enforcing dependency policies (allowed/blocked packages)

## Architecture

### Detection Pipeline

```
1. ppnpm audit across all repos
2. Cross-reference with NVD, GitHub Advisory DB, Snyk DB
3. Classify: Critical / High / Medium / Low
4. For Critical/High: auto-generate bump PR within 1 hour
5. PR includes: version bump + lock file update + test run results
6. Auto-merge if all tests pass; else assign to Eric
```

### Coverage

| Ecosystem | Tool | Repos |
|---|---|---|
| pnpm | ppnpm audit + Snyk | 60+ |
| Python | pip-audit + Safety | 8 |
| Go | govulncheck | 2 |
| Docker | trivy | All images |

## Instructions

### Running Dependency Audit

1. Enumerate all repos with package manifests
2. Run ecosystem-specific audit tools
3. Deduplicate findings across repos
4. Generate remediation PRs for Critical/High
5. Run CI on each PR to verify no regressions
6. Auto-merge clean PRs, flag others for review
7. Report summary to governance log

## Output Format

- Vulnerability Report (per repo)
- Generated PR URLs
- Test Results Summary
- Supply Chain Risk Score

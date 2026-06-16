---
name: heady-ai-checks
description: "Use when implementing AI-powered CI/CD quality gates, markdown-based status checks, or natural-language test specifications in the Heady™ ecosystem. Keywords include AI checks, CI checks, quality gate, status check, markdown test, natural language testing, automated review."
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ AI Checks (LiquidChecks)

## When to Use This Skill

Use this skill when the user needs to:
- Define quality gates as natural-language markdown files
- Run AI-powered code review as GitHub status checks
- Create custom quality rules without writing test code
- Automate pull request validation with AI reasoning

## Architecture

### Check Definition Format

```markdown
<!-- .heady/checks/no-hardcoded-secrets.md -->
# No Hardcoded Secrets

## Check
Verify that no file in the changeset contains hardcoded API keys,
passwords, tokens, or connection strings. Look for patterns like:
- Strings matching `sk-`, `pk_`, `ghp_`, `xoxb-`
- Variables named `password`, `secret`, `token` with string literals
- Base64-encoded blobs longer than 40 characters
- Connection strings with credentials embedded

## Severity
blocking

## Scope
changed_files
```

### Check Execution Pipeline

```
PR Event → Load .heady/checks/*.md → For each check:
  ├─ Scope resolution (changed_files | all_files | specific_path)
  ├─ AI evaluation (send check criteria + relevant code to LLM)
  ├─ Result: pass | warn | fail
  └─ Post as GitHub status check
```

### Check Severity Levels

| Level | GitHub Status | PR Impact |
|---|---|---|
| `blocking` | Required status check | Must pass to merge |
| `warning` | Neutral check | Flagged but not blocking |
| `info` | Comment only | Added as PR comment |

## Instructions

### Creating AI Checks

1. Create `.heady/checks/` directory in repo root.
2. Add markdown files (one per check).
3. Each file needs: `# Title`, `## Check` (criteria), `## Severity`, `## Scope`.
4. Checks run automatically on PR creation/update.
5. Results posted as GitHub status checks.

### Built-In Checks

| Check | Scope | Severity |
|---|---|---|
| No hardcoded secrets | changed_files | blocking |
| No TODO comments in production code | changed_files | warning |
| All functions have JSDoc/docstrings | changed_files | warning |
| No console.log in production code | changed_files | info |
| Breaking API changes documented | changed_files | blocking |
| Test coverage for new functions | changed_files | warning |

## Output Format

- Check Results Summary
- GitHub Status Check Report
- Detailed AI Reasoning
- Fix Suggestions

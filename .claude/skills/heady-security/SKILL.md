---
name: heady-security
description: Security audit, secrets scan, governance policy enforcement, and CodeLock management
---

# heady-security

Run security audits, scan for leaked secrets, enforce governance policies, and manage CodeLock.

## What to do

1. Read `src/hc_secrets_manager.js` for the secrets manager implementation
2. Read `configs/governance-policies.yaml` for governance rules and enforcement
3. Read `configs/resource-policies.yaml` for resource access policies
4. Execute security checks:
   - **Secrets scan**: Use MCP tool `heady_secrets_scan` — finds API keys, tokens, credentials in code
   - **Env audit**: Use MCP tool `heady_env_audit` — checks `.env` for missing/empty/exposed vars
   - **Dependency audit**: Use MCP tool `heady_deps_scan` — checks `package.json` for vulnerabilities
   - **CodeLock**: Use `heady_codelock_status` to check lock state, `heady_codelock_snapshot` for integrity
5. Report findings with severity levels and remediation steps

## CodeLock system

The CodeLock system prevents unauthorized changes. MCP tools:
- `heady_codelock_status` — Current lock state
- `heady_codelock_lock` / `heady_codelock_unlock` — Toggle lock
- `heady_codelock_request` / `heady_codelock_approve` / `heady_codelock_deny` — Change approval workflow
- `heady_codelock_snapshot` / `heady_codelock_detect` — File integrity monitoring
- `heady_codelock_audit` — Audit trail

## Key files

- `src/hc_secrets_manager.js` — Secrets manager
- `configs/governance-policies.yaml` — Governance rules
- `configs/resource-policies.yaml` — Resource access policies
- `configs/security/` — Security configurations
- `.env` — Environment variables (audit target)

# ERROR_CODES

## Scope
This catalog defines stable error identifiers for critical Heady surfaces addressed in the current maximum-potential continuation pass. Every code maps to one clear failure mode, an HTTP status, and an expected remediation path.

## Core platform

| Code | HTTP | Surface | Description | Suggested fix |
|---|---:|---|---|---|
| HEADY-BOOT-001 | 500 | bootstrap/server-boot | TLS bootstrap failed because certificate material could not be loaded safely. | Verify certificate paths, CA bundle presence, and secret delivery before restart. |
| HEADY-BOOT-002 | 401 | bootstrap/server-boot | Voice WebSocket upgrade rejected because authentication was missing or invalid. | Re-authenticate the client and pass a valid session token before opening the socket. |
| HEADY-MTLS-001 | 500 | security/mtls | Strict mTLS was requested without a readable CA bundle. | Mount a trusted CA bundle or explicitly enable insecure local development mode only outside production. |
| HEADY-MTLS-002 | 400 | security/mtls | Insecure mTLS override was requested without the required explicit opt-in flag. | Set the documented development override only in non-production environments. |
| HEADY-HEALTH-001 | 503 | monitoring/health-monitor | Health monitor classified the service as degraded or failing. | Inspect dependency health, recent structured logs, and retry state before recycle. |
| HEADY-CONFIG-001 | 500 | shared-config | Required environment configuration was missing or malformed. | Populate the missing configuration key in secret management or environment provisioning. |
| HEADY-VALIDATION-001 | 422 | request validation | Request payload failed schema validation. | Correct the payload shape and resend with valid data. |
| HEADY-GOVERNANCE-001 | 403 | governance | A protected action was blocked by policy or trust-gate rules. | Review the action against governance allowlists and approval requirements. |

## Operational workflows

| Code | HTTP | Surface | Description | Suggested fix |
|---|---:|---|---|---|
| HEADY-DEPLOY-001 | 500 | deployment | Deployment command failed before service health reached ready state. | Review deployment logs, validate target environment variables, then rerun after remediation. |
| HEADY-DEPLOY-002 | 503 | deployment | Post-deploy smoke checks failed against one or more critical endpoints. | Restore the previous healthy revision or fix the failing endpoints before promoting traffic. |
| HEADY-SETUP-001 | 400 | setup-dev | Local development setup failed because a required tool was missing. | Install the missing prerequisite and rerun the setup script. |
| HEADY-SETUP-002 | 500 | setup-dev | Workspace bootstrap failed during dependency install or container startup. | Inspect package manager output and Docker logs, then rerun once resolved. |
| HEADY-SECRETS-001 | 500 | secret hygiene | A committed secret or private key was detected in the repository. | Remove the secret from version control, rotate it, and complete history cleanup before release. |
| HEADY-SKILL-001 | 500 | skill registry | A required SKILL.md file was empty or incomplete. | Restore a complete skill definition with triggers, guidance, and examples. |

## Conventions
- Error codes are immutable once published.
- New service families should use the same `HEADY-<DOMAIN>-NNN` pattern.
- Generated constants in application code should reference this catalog to keep API responses and docs aligned.

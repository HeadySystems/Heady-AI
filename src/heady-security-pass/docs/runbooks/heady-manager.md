# heady-manager runbook

## Symptoms
- `/health/live` or `/health/ready` returns non-2xx
- boot process exits while loading TLS or environment configuration
- CLI commands that depend on `heady-manager` fail immediately

## Diagnosis
1. Check `npm start` or process manager logs for `HEADY-BOOT-*` and `HEADY-CONFIG-*` failures.
2. Verify `.env` or secret-managed equivalents are present and current.
3. Confirm certificate material exists only through approved secret delivery paths and that the CA bundle is readable.
4. Run `node ./scripts/ci/smoke-test.js --base-url http://localhost:3301` after the service starts.

## Remediation
- Fix missing or malformed configuration and restart the service.
- Restore trusted TLS assets and remove any insecure override from production configuration.
- If health still fails, roll back to the last known-good build and inspect dependency services.

## Post-incident review
- Record the triggering configuration or deployment change.
- Add or update automated validation if the failure bypassed predeploy checks.
- Confirm the error code catalog and runbook still match observed behavior.

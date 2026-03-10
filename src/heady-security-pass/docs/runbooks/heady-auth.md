# heady-auth runbook

## Symptoms
- sign-in succeeds on one surface but does not propagate to another
- WebSocket upgrades reject authenticated clients
- session cookies are missing, expired, or rejected

## Diagnosis
1. Confirm session cookies use secure production settings and are not being replaced by browser storage.
2. Inspect auth and relay logs for origin mismatches, token validation failures, or expired sessions.
3. Verify the auth service and relay endpoints respond through smoke checks and local health endpoints.
4. Review recent auth-provider registry changes for callback drift or missing scopes.

## Remediation
- Reissue sessions with the current cookie policy and restart affected auth surfaces.
- Correct relay origin allowlists and callback configuration.
- Remove any fallback token storage path that bypasses httpOnly cookies.
- Roll back recent auth-registry edits if federation behavior regressed.

## Post-incident review
- Document affected domains and propagation paths.
- Add a regression test for the failing federation or relay behavior.
- Update auth rollout notes before the next production promotion.

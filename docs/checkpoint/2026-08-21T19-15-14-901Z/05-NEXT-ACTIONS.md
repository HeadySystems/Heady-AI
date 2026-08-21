<!-- HEADY_BRAND:BEGIN
<!-- ╭───────────────────────────────────────────────────────────────╮
<!-- │  HEADY™ Checkpoint Next Actions v1.0.0                      │
<!-- │  Ordered local and live follow-up with explicit stop gates    │
<!-- │  © 2026 HeadySystems Inc. — Eric Haywood, Founder           │
<!-- ╰──────────────────────────────────────────────────────────────╯
<!-- HEADY_BRAND:END -->

# Prioritized Next Actions

## Completed locally in this run

1. Added and registered the Codex `heady-handoff` skill.
2. Defined the canonical `/heady` intelligence router and legacy aliases.
3. Repaired all workflow metadata/staleness validator findings.
4. Synchronized 54 workflow sources with 54 Claude commands.
5. Regenerated four drifted portal projections with the real source commit.
6. Isolated aggregate-runner failures and proved all five enforcers clean.
7. Ran focused approval, API, database, events, source-ledger, manager, portal,
   maintenance, gateway-bundle, and router checks.
8. Updated vulnerable Electron, `js-yaml`, and `nanoid` dependency paths; the
   package audit now reports no known vulnerabilities.
9. Completed the serial monorepo test graph (90/90) and build graph (40/40).
10. Normalized 25 source-skill frontmatters, regenerated affected projections,
    and made content/resource drift fail `register.mjs --check` and CI.
11. Inspected and retained the concurrent `heady-auto-progress` and
    `heady-destructive-approve-all` workflows; both preserve exact-scope human
    gates and have synchronized command projections.

## Live or human-gated follow-up

1. Apply and verify pending Neon migrations through the governed migration
   workflow on an approved copy-on-write branch before production.
2. Provision and verify NATS and portal-gateway secret bindings through the
   governed secret manager; do not expose values to clients or logs.
3. Exercise an authenticated node dispatch, outbox projection, heartbeat, and
   task-read flow against the intended `us-east1` revision.
4. Obtain the required founder or independent-review artifacts for any approval
   control-plane release or genesis operation. Automated tests do not satisfy
   those ceremonies.
5. Decide separately whether the pre-existing broad Claude permission change in
   `.claude/settings.local.json` should be accepted or reverted. Persistent agent
   permission changes require explicit human approval.

## Stop conditions

Do not label the node lane, autonomous-approval lane, source-ledger migration, or
portal gateway production-ready until their live checks are evidenced. Do not
push or deploy merely to make the local checkout appear clean.

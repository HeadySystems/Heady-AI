<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ Exact Approval and External Review Scope               ║ -->
<!-- ║  Cryptographic bindings for the protected policy change.       ║ -->
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Exact Approval and External Review Scope

## Approval-policy ceiling

This is the narrow protected scope requiring independent external security review:

| Field | Exact value |
|---|---|
| Commit | `13dc478e24d60d278b7afae89583ef50f5a25a2c` |
| Commit signature | Good EDDSA signature, founder key `1050B59E7296C46C26DDF95DA7D2108BB3C6101C` |
| Binary commit-diff SHA-256 | `3b247252c84a9707875ef10f6aba3b3532221ce75c101f9c5a21f0e73aa70599` |
| Policy source SHA-256 | `a58695bb843e9b4b3ec918559c3a0499a06ee20e4ea4d4905fa8f7eb429238f6` |
| Policy WASM SHA-256 | `a9a0676522a174a6cf0d543db05de14b7271c80f36406607f62cd70f06f485ff` |
| OPA compiler | `1.18.2` |
| Entrypoint | `heady/approval/decision` |

Files in scope are limited to:

1. `packages/approvals/policy/approval.wasm`
2. `packages/approvals/policy/manifest.json`
3. `packages/approvals/src/constants.mjs`
4. `packages/approvals/test/core.test.mjs`
5. `packages/approvals/test/policy.test.mjs`
6. `policies/approval.rego`

The independent reviewer must issue an attributable `ALLOW` or `DENY` for the exact commit, diff,
source, and WASM hashes above. Any later modification invalidates the scope and requires a new
review. Until that evidence exists, the ceiling change must not be described as accepted or
production-authorized even though it is founder-signed and already present on the remote branch.

## Remaining execution authority

The user already authorized P2/P3 deployment in the initiating instruction. No additional chat
approval is needed for the exact Firebase artifact, but Firebase native authentication must be
restored first. The four withheld Worker candidates require code/config repair and fresh artifact
hashes; this checkpoint does not authorize deploying their current unsafe/conflicting bundles.

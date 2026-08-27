<!-- HEADY_BRAND:BEGIN
Heady™ Approval Evidence Ceremony Builder v1.0.0
Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# @heady/approval-evidence

Builds the canonical `heady.approval.evidence.v1` envelope a **human** principal signs when recording
a decision on an HCP, and prints the exact KMS ceremony and decision request that follow.

It holds no key material, performs no signing, and reaches no network. The private key stays in Cloud
KMS; the approval API rebuilds the same envelope server-side and rejects any divergence.

```bash
pnpm --filter @heady/approval-evidence envelope \
  --approval-state approval-view.json \
  --decision approve \
  --reason "<why>" \
  --out evidence-envelope.json
```

`--approval-state` is the JSON body of `GET /api/approvals/:approvalId`. The printed
`envelopeSha256` is the hash under signature. Relative paths resolve against the directory you ran
the command in, not the package.

Fails closed when the approval is not `pending`, when the ceremony window exceeds the service's
φ×5-minute allowance (`EVIDENCE_CEREMONY_MAX_MS` = 485,410 ms ≈ **8.1 min** wall clock), when a
service evidence class is passed into the human lane, or when the
approval view's hashes are malformed.

Full operator sequence and the genesis prerequisites:
`docs/runbooks/APPROVAL_GENESIS_FOUNDER_RUNBOOK.md`.

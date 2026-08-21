# ADR-0001: Canonical Repository Authority

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

The ecosystem spans ~75 repos across 4 GitHub orgs. The handoff names
`Heady-pre-production-9f2f0642` as the operating core; public GitHub shows `heady-ai` as a large
active monorepo plus archived `main`/`Heady`/`ai-workflow-engine`. Architecture is currently inferred
from repo names — itself a governance smell. Satellites (`*-core`) are thin projection shells returning
`{"projected": true}`, signaling false deployment readiness.

## Decision

1. The clean `Heady-AI` Turborepo scaffold is the **single canonical engineering monorepo**;
   `heady-docs` is the **canonical docs/IP hub**. Recorded in `SOURCE_OF_TRUTH.md`.
2. Legacy `~/workspace/heady-ai` and `Heady-pre-production` are **migration sources**, archived after cutover.
3. Releases, provenance, and contract generation run **only** from the canonical repo (CI-enforced).
4. **Collapse 4 orgs → 1** as the first migration step.
5. Default action for satellites is **fold into the monorepo**; only survivors get a projection manifest
   (source path, sync hash, deploy mode, live URL, health URL, status).

## Consequences

- (+) Ends drift, duplicate truth, broken provenance, founder attention leakage.
- (+) Strangler-fig migration has one unambiguous target.
- (−) One-time cost: org consolidation, DNS/secret reconciliation, history imports (`git filter-repo`).
- Supersedes the antigravity ARCH-001 intent (formalize manifests) where folding-in is viable.

## Proposed supersession

ADR-0051 proposes moving canonical source bytes, revisions, and refs into Neon and treating Git as a
signed distribution/worktree projection. This accepted ADR remains authoritative until ADR-0051 is
signed and its source-ledger migration is activated.

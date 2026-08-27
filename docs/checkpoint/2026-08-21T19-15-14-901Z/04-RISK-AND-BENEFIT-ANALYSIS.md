<!-- HEADY_BRAND:BEGIN
<!-- ╭───────────────────────────────────────────────────────────────╮
<!-- │  HEADY™ Workflow Risk and Benefit Analysis v1.0.0           │
<!-- │  Portfolio value, overlaps, controls, and adoption guidance   │
<!-- │  Made with ❤️ by HeadySystems Inc.                          │
<!-- ╰──────────────────────────────────────────────────────────────╯
<!-- HEADY_BRAND:END -->

# Workflow Risk and Benefit Analysis

## Highest-value capabilities

| Capability group | Benefit | Material control |
|---|---|---|
| Intelligence routing | `heady` makes capability discovery deterministic and honors explicit skill order | Availability, source authority, non-recursion, and user-scope gates |
| Handoff and checkpoints | Preserves delta, verification, and open work across sessions | Writer side effects are explicit; dry-run remains read-only |
| Validation and coherence | Detects metadata, projection, policy, and source drift early | Run isolated gates when aggregate process concurrency is unreliable |
| Deployment verification | Prevents repository readiness from being mislabeled as live success | Authenticated canary/protocol evidence and exact target identity |
| Incident and secret operations | Gives urgent work a repeatable sequence | Exact scope, external authorization, revocation, and audit evidence |
| Governed promotion | `heady-auto-progress` separates inventory, selection, validation, and promotion | Digest-bound bundle selection and destination-specific authority |
| Destructive manifests | `heady-destructive-approve-all` can batch exact destructive entries without blanket consent | One-time manifest hash, before-state revalidation, native human/platform gates |

## Principal risks

1. Historical workflows can outlive their engines. CommonJS snippets, removed
   paths, and nominal endpoints require current availability checks.
2. Meta-workflows sometimes describe hooks, cron, daemons, auto-push, or broad
   mutation. Workflow prose cannot authorize persistent or outward actions.
3. Relative lexical matching can over-rank weak matches. The new router elevates
   explicit requests, validates source/projection availability, applies a
   φ-derived absolute benefit floor, and caps the execution route at five items.
4. Generated state can appear healthy while carrying incomplete provenance. The
   projection generator had to run outside the subprocess-restricted sandbox to
   record the real Git SHA rather than its `unknown` fallback.
5. Local tests cannot prove Neon migrations, NATS credentials, cloud identity,
   deployed revisions, Firebase custom claims, or authenticated canaries.

## Overlap and convergence

- `heady-command` and `heady-trigger-update` now converge on `heady`, eliminating
  competing legacy routing maps.
- `heady-handoff`, `heady-handoff-check`, and `heady-activity-tree` have distinct
  write, read, and reporting roles.
- `heady-secret-rotation` and `secret-rotation` overlap; keep the former for
  Heady-specific provider context and the latter for general sequencing.
- `heady-deploy-cloudrun` and `heady-site-deploy` differ by target breadth, but
  both require the same authority and live-verification discipline.
- `ram-ops` remains useful as historical context only; accepted ADRs and current
  code lock Neon/pgvector as durable retrieval authority.

## Net benefit

The workflow corpus is valuable as a discoverable operating playbook when it is
treated as routed guidance rather than executable authority. The repaired
registry, one-to-one command projections, and tested intelligence router make
beneficial flows easier to select while exposing unavailable or high-risk paths
before action.

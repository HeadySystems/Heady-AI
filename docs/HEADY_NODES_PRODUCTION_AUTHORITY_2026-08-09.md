<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ Nodes Production Authority Record v1.0.0                 ║ -->
<!-- ║  Wave-0 authority reconciliation, live evidence, and release DAG ║ -->
<!-- ║  Made with ❤️ by HeadySystems Inc.                ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Heady Nodes Production Authority Record — 2026-08-09

## Outcome

The checkout now has a coherent, testable node-integration implementation, but it is not verified
production-live. Repository prerequisites pass; production remains gated by the governed application
of migrations 0010 and 0011, provisioned NATS connectivity, a new Cloud Run revision, fresh runtime
heartbeats, and an authenticated canary.

No database migration, production deployment, approval genesis, persistent host automation, or
patent-locked bee runtime was executed during this wave.

The final local gates passed, including 48 serial manager tests (47 pass, one live-Neon branch test
skipped because no test branch URL was supplied), database/events/secrets tests, facts validation,
law/governance/security enforcers, and a Node 22 container build. The local image ID is
`sha256:73b2ac4c7d1368ad1f5469efc8d6865651aa0218c13715f19e4de21fafb75f1d`. Terraform syntax
validation could not run because the Terraform CLI is not installed in this environment.

## Authority decisions

### Node taxonomies

The repository contains multiple non-isomorphic taxonomies. They must remain separate:

| Taxonomy | Canonical count | Runtime meaning | Authority |
|---|---:|---|---|
| Bounded runtime contexts | 21 | Cloud Run modular-monolith and edge service contexts | `docs/master-plan/03-agents.md` |
| Attribution roles | 19 | Activity ownership and dispatch attribution | `Heady AI Nodes Integration` skill, actual enumeration |
| Mathematical core | 2 | Pure CSL/vector arithmetic (`TENSOR`, `TOPOLOGY`) | integration skill |
| Cognitive agents | 8 | Leadership and reasoning roles, runtime still planned | lexicon/master plan |

The integration skill says “20” but names 19 attribution roles, then calls `TENSOR` and `TOPOLOGY`
the 21st and 22nd entries. That arithmetic conflict is recorded as source drift, not repaired by
inventing an identity. Each of the 19 attribution roles now maps explicitly to one of the 21 runtime
contexts in `apps/heady-manager/src/nodes.mjs`.

### Cloud authority

| Property | Canonical live value | Evidence |
|---|---|---|
| GCP project | `heady-ai` | master plan, Firebase project number, local gcloud project config |
| Region | `us-east1` | accepted ADR-0022, master plan, deployed origin URL |
| Origin service | `heady-codeflow-api` | portal-gateway configuration and deployed origin URL |
| Nominal aliases | `heady-rebuild`, `heady-origin` | accepted ADR naming; not the observed successor deployment |
| Legacy target | `heady-prod-609590223909` / `us-central1` | read-only migration history; never a new deployment target |

`facts.yaml` and Terraform defaults were corrected to `us-east1`; Terraform now validates the live
project and region. The local gcloud project is `heady-ai`, but its stored Run region remains stale at
`us-central1`. A live service description could not be authenticated because gcloud requires
interactive reauthentication.

### Neon migration lineage

The production Neon project `cool-wind-37254039`, database `neondb`, reports PostgreSQL 17.10 and an
immutable migration journal through `0009_conversation_speaker_attribution.sql`.

The missing 0007–0009 sources were recovered from the repository's existing safety stash. Their bytes
match the production journal exactly:

| Migration | SHA-256 |
|---|---|
| `0007_heady_runtime_intelligence.sql` | `2533135060dd9bd3e0c3eba377391acd614e52974f44bd444fb17c5d1236e5ae` |
| `0008_projection_embedding_liveness.sql` | `5422a0177a9bd81aefd885084f019a0dd8ab72448d57a5a6a95b7f329fc01a51` |
| `0009_conversation_speaker_attribution.sql` | `df4c0767835a8f80a0b85bb0e7b030f1795d6bfa31b765ccacc5435a7fc6a0ea` |

The conflicting autonomous-grants migration was preserved and renumbered to
`0010_autonomous_approval_grants.sql`. `0011_node_orchestration_integrity.sql` adds an immutable
task-outbox identity/delete guard and the measured runtime-node heartbeat registry. Both are pending;
neither has been applied to Neon.

### Patent and independent-review boundaries

The following boundaries remain non-bypassable:

- `packages/bees` is blocked by draft HCP-0003 and its recorded ARBITER `BLOCK`; no package was created.
- A runtime CSL conductor stage gate is blocked by draft HCP-0002.
- Secret-rotation executor mechanics are blocked by draft HCP-0001.
- Existing CODEOWNERS protects the listed patent packages and Stage-0 governance surfaces.
- CODEOWNERS does not currently cover proposed `packages/bees`, and its infrastructure rule names
  `/infrastructure/` while the active directory is `/infra/`. Repairing CODEOWNERS is itself a
  Stage-0 change requiring the governed founder/ARBITER review path.
- An informal instruction, automated test result, or agent-generated signature cannot substitute for
  the exact-diff receipts and independent review required by the approval policy.

## Live read-only evidence

Read-only HTTPS probes on 2026-08-09 returned:

- Canonical private origin `/health`: `403 Forbidden`, proving the private Cloud Run route exists but
  not proving application health.
- `headyme.com/api/nodes`: `401 missing Firebase bearer token`.
- `headyme.com/api/orchestration/readiness`: `401 missing Firebase bearer token`.
- `headyme.com/api/maintenance/health`: `401 missing Firebase bearer token`.

These responses prove DNS/edge/auth routing only. They do not prove the new revision, NATS transport,
Neon migrations, worker consumption, heartbeat freshness, or end-to-end dispatch.

## Release DAG

1. **Governed review gate**
   - Freeze the exact 0010/0011 and deployment diff.
   - Compute its SHA-256 scope and collect the policy-required independent receipts.
   - Repair Stage-0 CODEOWNERS coverage only through its own separately reviewed diff.
2. **NATS provisioning**
   - Provision TLS endpoints and least-privilege account credentials.
   - Store `NATS_SERVERS` and authentication material in GCP Secret Manager.
   - Verify connect, publish, subscribe, reconnect, and cross-revision delivery.
3. **Neon migration gate**
   - Prepare 0010 and 0011 on an isolated Neon branch.
   - Verify schema, trigger behavior, privileges, checksums, and zero-drift comparison.
   - Apply to the parent branch only after explicit migration approval.
4. **Canonical canary**
   - Reauthenticate gcloud and describe the current `heady-codeflow-api` revision.
   - Build a digest-pinned Node 22 image and deploy a governed canary to `heady-ai/us-east1`.
   - Keep the origin private behind the portal gateway.
5. **Runtime proof**
   - Register fresh `READY` heartbeats from actual runtime contexts.
   - Exercise authenticated dispatch, idempotent retry, NATS consumption, task completion, SSE
     projection, and append-only audit retrieval with one trace ID.
6. **Operational acceptance**
   - Prove filesystem policy is read-only on Cloud Run and all durable evidence remains in Neon.
   - Run serial manager tests, law/governance/security gates, authenticated canary probes, and rollback
     verification before increasing traffic.

Steps 2 and the review preparation portion of step 3 can proceed in parallel. Steps 3–6 are ordered;
no later step can be used as evidence that an earlier authority gate was satisfied.

## Additional infrastructure stop condition

The current Terraform still declares a separate swarm orchestrator, Pub/Sub “god-mode” lane, and a
scheduled pruning job. Those resources conflict with the modular-monolith authority and the blocked
bee-runtime proposal. They must be reconciled in a reviewed Terraform plan before any `terraform apply`;
this wave changed canonical project/region inputs only and did not plan or apply infrastructure.

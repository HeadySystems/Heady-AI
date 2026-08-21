<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Documentation Map                                       ║
║  LAYER: docs · PURPOSE: authority and navigation                ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady documentation map

This directory contains binding decisions, implementation references, living explanations, plans,
runbooks, research, and historical evidence. They do not all have equal authority. Use this map to
choose the right source and avoid treating an old plan as current runtime truth.

## Authority order

When documents disagree, use this order:

1. **Repository and governance rules:** [`../AGENTS.md`](../AGENTS.md),
   [`../governance/`](../governance/README.md), and enforced policy.
2. **Accepted architecture decisions:** [`adr/`](adr/README.md). Accepted ADRs are immutable; change
   direction with a superseding ADR.
3. **Validated canonical facts and contracts:** [`../facts.yaml`](../facts.yaml), package contracts,
   schemas, migrations, and machine-readable registries.
4. **Current implementation evidence:** package manifests, source, tests, deployment manifests, and
   checked runtime configuration.
5. **Living explanations:** compendium, package catalog, system guides, and design documents.
6. **Plans, research, reports, and historical artifacts:** useful context, but not proof of current
   implementation or deployment.

For mutable operational facts—deployed revisions, routes, branch state, cloud configuration, secrets,
and external service health—verify the live target. No repository document can make those facts current
by declaration.

## Start here by task

| Need | Start with | Then verify |
|---|---|---|
| Understand the running architecture | [`../README.md`](../README.md) | Package manifests, source, tests, live deployment |
| Understand why a decision exists | [`adr/README.md`](adr/README.md) | The cited contract and implementation |
| Find a package or ownership boundary | [`PACKAGE_CATALOG.md`](PACKAGE_CATALOG.md) | `packages/*/package.json` and tests |
| Explore the full system vocabulary | [`compendium/00-INDEX.md`](compendium/00-INDEX.md) | ADR reconciliation and current code |
| Plan implementation order | [`REBUILD_PLAN_V2.md`](REBUILD_PLAN_V2.md) and [`STEPWISE_BUILD_SPEC.md`](STEPWISE_BUILD_SPEC.md) | Current Git state and completed tests |
| Work on governance or approvals | [`../governance/README.md`](../governance/README.md) and [`hcp/README.md`](hcp/README.md) | Policy sources, signed artifacts, exact hashes |
| Work on environments or deployment | [`ENV_SEPARATION.md`](ENV_SEPARATION.md) and relevant runbook | Cloud identity, runtime variables, deployed revision |
| Work on portal or product UX | [`design/README.md`](design/README.md) | Current app source and route configuration |
| Transfer legacy capability | [`LEGACY_EXTRACTION_SYSTEM.md`](LEGACY_EXTRACTION_SYSTEM.md) | Disposition manifest, security gates, target tests |

## Documentation classes

### Binding and canonical

- [`../AGENTS.md`](../AGENTS.md) — repository coding and operational rules.
- [`../governance/`](../governance/README.md) — enforced constitution and directives.
- [`adr/`](adr/README.md) — canonical lowercase ADR series.
- [`../facts.yaml`](../facts.yaml) — validated scalar and registry facts used by derivation tooling.
- [`../SOURCE_OF_TRUTH.md`](../SOURCE_OF_TRUTH.md) — authority declaration; revalidate mutable branch
  and repository claims before acting.

The uppercase `ADR/` tree is not the canonical ADR index. It is retained as migration-era material and
must not be used to override a decision in `adr/`.

### Current implementation references

- [`PACKAGE_CATALOG.md`](PACKAGE_CATALOG.md) — intended package boundaries and dependency direction.
- [`MODULE_ARCHITECTURE.md`](MODULE_ARCHITECTURE.md) — module and microkernel design.
- [`PORTAL_GATEWAY_DEPLOY.md`](PORTAL_GATEWAY_DEPLOY.md) — portal-to-private-origin gateway topology.
- [`ENV_SEPARATION.md`](ENV_SEPARATION.md) — environment and provider isolation.
- [`hcp/`](hcp/README.md) — Heady Change Proposal records and format.
- `../packages/*/README.md` and `../apps/*/README.md` — component-level usage where present.

Implementation references can drift. Confirm claims against manifests, source, tests, and deployed
configuration before relying on them operationally.

### System explanation and design

- [`compendium/`](compendium/00-INDEX.md) — broad system vocabulary and reconciliation notes.
- [`HEADY_MASTER_CONTEXT.md`](HEADY_MASTER_CONTEXT.md) — narrative system context.
- [`LIQUID_LATENT_OS_COHERENCE.md`](LIQUID_LATENT_OS_COHERENCE.md) — coherence model.
- [`design/`](design/README.md) — interaction, information-architecture, and feature designs.
- [`blueprints/`](blueprints/NOTEBOOKLM_SOURCEPACK.md) — detailed architecture explorations.

### Plans and roadmaps

- [`REBUILD_PLAN_V2.md`](REBUILD_PLAN_V2.md) — rebuild sequencing.
- [`STEPWISE_BUILD_SPEC.md`](STEPWISE_BUILD_SPEC.md) — component-level build plan.
- [`master-plan/`](master-plan/00-INDEX.md) — comprehensive incorporation plan.
- [`heady-platform-transition-roadmap.md`](heady-platform-transition-roadmap.md) — transition roadmap.
- [`strategic/`](strategic/latent-os-blueprint.md) — strategy and long-horizon plans.

Plans express intent. A checked box or written target is not enough to claim that the corresponding
runtime, integration, or deployment exists.

### Operations, evidence, and history

- [`runbooks/`](runbooks/) — operational procedures; verify prerequisites and target environment.
- [`reports/`](reports/) — point-in-time findings.
- [`handoff/`](handoff/) — session handoffs and historical state snapshots.
- [`research/`](research/) — exploratory analysis, not architecture authority.
- [`conversations/`](conversations/) — narrative records.
- [`adr/superseded-v1/`](adr/superseded-v1/) — superseded decisions preserved for provenance.

## Documentation maintenance rules

- Link to an authority instead of copying load-bearing values into multiple documents.
- State whether a document describes **current implementation**, **target design**, or **history**.
- Include the evidence date for mutable operational claims.
- Never describe a service as live based only on local code, a health endpoint, or an unauthenticated
  response; verify a representative authenticated flow.
- Keep secrets, tokens, connection strings, and private key material out of documentation.
- Add a `HEADY_BRAND` header to every new file.
- Update this map when adding a new documentation category or canonical entry point.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*

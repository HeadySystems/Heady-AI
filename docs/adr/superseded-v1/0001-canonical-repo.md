# ADR-0001 — Canonical repo = latent-core-dev

**Status:** Accepted (2026-06-14)

## Context
The Heady code exists in 7+ near-identical monorepo clones across four GitHub orgs that drift independently. When several repos each claim to be "the system," none is — this is a root cause of projection drift and inconsistency. Exactly one repo must be promoted to canonical; the rest become read-only archives once their unique work is salvaged.

`latent-core-dev` (remote `git@github.com:HeadyMe/latent-core-dev.git`, branch `main`) is the active working repo on disk and contains the real, unique assets: patent logic (`colab/node1_overmind.py`, patent-lock services under `src/services/`), four Cloudflare workers under `cloudflare/`, and the live `.github/workflows`.

## Decision
`HeadyMe/latent-core-dev` is the **canonical repo**. All other clones are demoted to derived/archive status. Every fact about Heady's code, schema, and contracts lives here or is generated from here.

**Caveat (open task):** the empirically correct way to confirm the seed is to match the SHA actually serving production (pull the deployed Cloud Run image's `org.opencontainers.image.revision`, find which repo's `main` contains it). That check has not been run from this environment. If production runs a SHA absent from `latent-core-dev/main`, this ADR is superseded.

## Consequences
- Before any clone is archived, its commits unique vs `main` are triaged: real fix → cherry-pick; generated artifact → discard; dead experiment → orphan `archive/*` branch. Losing clones are archived (not deleted) for 90 days.
- New repos require an ADR justifying separation (default-deny).
- Downstream `-core` repos and `heady-registry.json` become **build outputs**, not hand-edited sources (see ADR-0003).

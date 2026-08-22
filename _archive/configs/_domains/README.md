<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Archive — quarantined legacy domain configs               ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Quarantined: legacy `configs/_domains/` domain dumps

Moved here on **2026-08-22** from `configs/_domains/`. Nineteen files, zero live
consumers, all superseded by the domain canon.

## The canon these predate

`facts.yaml` `domains:` is the source of truth. Five files are registered
**carriers** (projections of the canon, each named by a `sources:` token on the
node it carries), and membership plus `sources:` accuracy are machine-enforced by
the coherence kernel's D1–D7 guards (`tooling/coherence/src/domain-guards.mjs`).
Consumers read the generated projection `configs/_generated/domain-roster.json`.

Nothing here is a carrier. Nothing here is read at runtime.

## Why these were safe to move

Each was checked for a live reader before the move:

- **The four modules that appear to read `public-domain-integration.yaml`** —
  `src/routes/config-api.js:112`, `src/routes/config.js:94`,
  `src/pipeline/pipeline-core.js:45`, `src/hc_pipeline.js:87` — resolve
  `configs/<name>.yaml` at the **top level** of `configs/`, never
  `configs/_domains/`. That top-level file has never existed, so those reads were
  already returning `null` (or throwing into a swallowing `catch`) long before
  this move. Moving the `_domains/` copy changes nothing for them.
- **`src/config-buildout-tasks.js`** is a static aspirational task registry
  ("wire config X into live code"). It names these files in prose `name`/`desc`
  strings using the same non-existent top-level `configs/` paths. It does not
  load them.
- Several `configs/**` manifests (`pipeline/activation-manifest.yaml`,
  `agent-profiles/skills-registry.yaml`,
  `infrastructure/networking/localhost-elimination-protocol.yaml`,
  `infrastructure/cloud/cloud-environments.yaml`,
  `observability/system-self-awareness.yaml`) mention some of these by bare
  filename. Those are aspirational activation lists with the same broken
  top-level path assumption, left untouched here.

## What is in here

| File | Why it is dead |
|---|---|
| `branded-domains.yaml`, `clean-domains.yaml`, `functional-domains.yaml`, `minimal-domains.yaml`, `rationalized-domains.yaml`, `universal-domains.yaml`, `service-domains.yaml`, `subdomain-domains.yaml`, `render-domains.yaml`, `heady-com-domains.yaml`, `heady-domains-final.yaml`, `hfcp-domains.yaml`, `website-definitions.yaml`, `domain-mappings.yaml` | Successive rewrites of the same roster idea. Each was "the clean one" at the time; none won. |
| `domain-architecture.yaml` | v2.0 (2025-02-08), only **3** brand domains. Name-collides with the live, unrelated `configs/domain-architecture.json` (a registered carrier) — the collision alone was a hazard. |
| `domain-registry.json` | Legacy JSON registry. Name-collides with the live `src/config/domain-registry.js` carrier. |
| `public-domain-integration.yaml`, `public-domain-patterns.md` | Public-domain integration patterns; readers never resolved to this path (see above). |
| `domains` | A Cloudflare Tunnel ingress fragment that is pure placeholder rot: `tunnel: YOUR_ACTUAL_TUNNEL_ID`, and two corrupted service targets (`manager.eadyio.com`, `tero.com`) behind plain `http://`. It could never have worked. |

## What stayed behind

`configs/_domains/site-registry.yaml` — a live carrier (`site-registry` token),
authoritative for local site process/port/dir layout only.

## If you need something from here

Take the *fact*, not the file: add or amend the node in `facts.yaml` `domains:`
and let the projections follow. Restoring a file into `configs/` reintroduces an
unregistered roster, which is the exact condition D1 exists to catch.

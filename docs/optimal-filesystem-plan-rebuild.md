<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: optimal-filesystem-plan-rebuild.md                        ║
<!-- ║  LAYER: docs                                                     ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->

# Optimal Filesystem Plan — Rebuild

Principle: the rebuild is the **clean-slate canonical** repo. The optimal layout
keeps its existing structure (which is already well-formed) and closes the
**registry/manifest/governance-doc** gaps so every runtime component surface has
a declarative source of truth. No archival/marketing/mirror surfaces from
production are reintroduced. Every added file carries real content and a
`HEADY_BRAND` header per `AGENTS.md`.

## Added / changed files

```
Heady-AI/  (branch: audit/optimal-filesystem-rebuild)
├── .well-known/
│   └── mcp.json                          # NEW — MCP server discovery (40 tools, OAuth 2.1 metadata)
├── configs/
│   ├── mcp-tools.json                    # NEW — MCP tool tier/scope manifest (tier1/2/3 + mandatory tools)
│   ├── service-catalog.yaml              # REWRITE — stub → 19 real Latent Services
│   └── liquid-os/                        # NEW dir — declarative Liquid OS registries
│       ├── node-registry.yaml            # NEW — orchestration/intelligence/pipeline/edge/system nodes
│       ├── bee-catalog.yaml              # NEW — 54 worker bees + factories (src/bees/*)
│       ├── agent-registry.yaml           # NEW — runtime + governance agents + personas
│       └── workflow-registry.yaml        # NEW — 10 CI + 29 internal workflow index
├── ARCHITECTURE.md                       # NEW — layer map + pattern reference + registry table
├── CHANGELOG.md                          # NEW — Keep-a-Changelog; releases run from this repo
├── CONTRIBUTING.md                       # NEW — branch policy + coding rules + registry-sync table
└── SECURITY.md                           # NEW — vuln reporting, secrets, zero-trust MCP, PQC
```

11 files total: **10 new, 1 rewritten.**

## Why these, and why here

- **`configs/liquid-os/`** — mirrors production's proven grouping for OS-level
  registries, giving nodes/bees/agents/workflows a single home. Chosen over
  scattering files so the data-consistency and deep-scan tooling can target one
  directory.
- **Registries are grounded in actual code**, not aspirational: node-registry
  points at real `impl:` paths, bee-catalog enumerates the real 61 `src/bees/`
  modules, agent-registry references real `src/agents/*` + `.agents/agents/*`,
  the MCP manifest lists the exact 40 tools `src/heady-mcp-server.js` exports.
- **`.well-known/mcp.json` + `configs/mcp-tools.json`** — make the MCP host
  self-describing and enforce the zero-trust tier gate (tier3 destructive tools
  require HITL) that `AGENTS.md` mandates.
- **Root governance docs** — `CONTRIBUTING/SECURITY/ARCHITECTURE/CHANGELOG` are
  the four standard files a canonical release repo (ADR-0001) is expected to
  carry; each cross-links `AGENTS.md`/ADRs rather than restating them.
- **`service-catalog.yaml` rewrite** — the pre-existing single-line
  `test-service` stub violated the no-placeholder rule and provided no health
  authority; replaced with the 19 services already tracked in
  `heady-registry.json`.

## Deliberately NOT added (scope discipline)

- Production's `service-wiring-manifest.yaml` / `config/node_manifest.yaml`
  (single-tenant/sovereign-node scale — premature here).
- `LICENSE` (proprietary repo; founder/legal decision).
- `sites/`, `websites/`, `enterprise/`, `_archive/`, `_downloads/`, `dropzone/`,
  `HeadySystems_v13/` and other downstream/mirror/archival trees — these belong
  to projection targets, not the engineering rebuild, and are explicitly barred
  by the repo's canonical-authority ADRs.

## Sync / validation after merge

```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in \
  ['configs/service-catalog.yaml','configs/liquid-os/node-registry.yaml', \
   'configs/liquid-os/bee-catalog.yaml','configs/liquid-os/agent-registry.yaml', \
   'configs/liquid-os/workflow-registry.yaml']]"   # YAML well-formed (verified)
node -e "JSON.parse(require('fs').readFileSync('configs/mcp-tools.json')); \
         JSON.parse(require('fs').readFileSync('.well-known/mcp.json'))"     # JSON valid (verified)
pnpm run consistency:verify        # data-consistency gate
```

All JSON/YAML added here was validated before commit.

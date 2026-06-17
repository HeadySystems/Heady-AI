# Heady™ Latent OS Core — Enterprise Hub

> **The Synapse** — Private Hub repository for the Heady Autonomous AI Operating System.

This is the single source of truth where the AI's 3D vector memory (pgvector) synchronizes with flat files. It holds the Swarm logic, the AST mutators, and the Colab kernel scripts.

## Architecture: Hub & Spoke

```
┌──────────────────────────────────────────────────────┐
│              latent-core-dev (THE HUB)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Swarm   │  │   AST    │  │  3D Vector       │   │
│  │  Logic   │  │ Mutators │  │  Memory (pgvec)  │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │                 │             │
│  ┌────┴──────────────┴─────────────────┴──────────┐  │
│  │        Liquid Projection Pipeline (CI/CD)      │  │
│  └──┬────────────────┬─────────────────┬──────────┘  │
└─────┼────────────────┼─────────────────┼─────────────┘
      │                │                 │
      ▼                ▼                 ▼
┌──────────┐   ┌────────────┐   ┌──────────────┐
│ headymcp │   │ headysys   │   │ ableton-edge │
│ -prod    │   │ -prod      │   │ -production  │
│ (PUBLIC) │   │ (PUBLIC)   │   │ (PRIVATE)    │
└──────────┘   └────────────┘   └──────────────┘
```

## Security Model

- **Zero-Direct-Push**: All changes to `main` require a Pull Request
- **ComplianceBee Audit**: Automated secret scanning + brand compliance on every PR
- **Antigravity Proxy**: External IDE pushes to `proxy-staging` branch → Swarm assimilates after vectorization

## Branches

| Branch | Purpose |
|---|---|
| `main` | Protected production state. Only updated via approved PRs |
| `proxy-staging` | Antigravity IDE sandbox. Human code lands here |
| `swarm-mutation-*` | AI-generated mutations from the Swarm |

## Projection Verticals

| Vertical | Path | Spoke Repo | Domain |
|---|---|---|---|
| HeadyMCP Dashboard | `apps/mcp-dashboard/` | `headymcp-production` | headymcp.com |
| HeadySystems Platform | `apps/headysystems/` | `headysystems-production` | headysystems.com |
| Ableton Edge | `apps/ableton-edge/` | `ableton-edge-production` | SysEx Edge Node |

## Quick Start

```bash
# Clone
git clone git@github.com:HeadyMe/latent-core-dev.git
cd latent-core-dev
npm install

# Start the manager
npm start

# Run the pipeline
npm run pipeline
```

---

*© 2026 HeadySystems Inc. — Proprietary and Confidential*

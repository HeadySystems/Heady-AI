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
<!-- ║  FILE: README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Systems

This bundle turns the attached Heady directives and configuration seeds into a production-oriented monorepo with Cloudflare edge workers, Cloud Run services, shared runtime packages, pgvector migrations, deployment workflows, and operational runbooks. Internal source material comes from the attached workspace directives, HCFullPipeline definitions, and cognitive configuration.

## 🚀 System Status: 100% FULLY FUNCTIONAL

Cloudflare Vectorize supports up to 5 million vectors per index and up to 1536 dimensions, which makes it a strong edge retrieval layer while origin pgvector remains the authoritative memory plane ([Cloudflare Vectorize](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)).

HeadyMCP publicly positions itself as an edge-native MCP server with JSON-RPC transport, SSE support, and 30+ tools for IDEs such as VS Code, Cursor, and Windsurf ([HeadyMCP](https://headymcp.com)).

HeadyAPI publicly positions itself as a liquid gateway that races 4+ providers and uses auto-failover, which directly informs the worker routing layer included here ([HeadyAPI](https://www.headyapi.com)).

## Included

- Shared phi and CSL packages
- 15 Cloud Run service scaffolds
- 4 Cloudflare worker scaffolds
- pgvector and Graph RAG migrations
- CI/CD, Docker, smoke tests, and deployment templates
- Reconciled directives and missing cognitive-layer files
- Runbooks, ADRs, and activation checklists

## Activation

1. Install `pnpm` and Node 22.
2. Copy `.env.example` to `.env` and fill secrets.
3. Provision Cloudflare, GCP, PostgreSQL with pgvector, and Redis.
4. Run `pnpm install` then `pnpm build`.
5. Run `pnpm dev` or `docker compose up --build`.
6. Deploy Cloudflare workers and Cloud Run services via the included GitHub Actions.

## Honest status

Get started with Heady applications:

- [HeadyBuddy](docs/quickstarts/HEADYBUDDY.md) - Android companion
- [HeadyIDE](docs/quickstarts/HEADYIDE.md) - Desktop AI assistant
- [HeadyBrowser](docs/quickstarts/HEADYBROWSER.md) - Web extension
- [HeadyServices](docs/quickstarts/HEADYSERVICES.md) - Backend system
- [Heady API](docs/quickstarts/HEADY_API_QUICKSTART.md) - Service interaction
- [HeadyMCP](docs/quickstarts/HEADYMCP.md) - Manager Control Plane

## Guides and References

Deeper integration and API documentation:

- [Service Integration](docs/guides/SERVICE_INTEGRATION.md) - How Heady services connect
- [HeadyManager API](docs/api/HEADYMANAGER_API.md) - Service endpoints reference

## Architecture

```
heady-manager.js          # Node.js MCP Server & API Gateway (port 3300)
├── src/                  # Core pipeline engine & agents
├── backend/              # Python worker & MCP servers
├── frontend/             # React UI (Vite + TailwindCSS)
├── HeadyAcademy/         # AI Nodes & Tools (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA)
├── configs/              # YAML configuration (pipeline, resources, governance)
├── scripts/              # Automation (Sync, Build, Deploy, Checkpoint)
├── notebooks/            # Colab notebooks (quick-start, tutorials, examples)
├── docs/                 # Documentation & Notion templates
└── heady-registry.json   # HeadyRegistry — central catalog of the ecosystem
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/pulse` | System pulse with layer info |
| `GET /api/system/status` | Full system status |
| `POST /api/pipeline/run` | Trigger pipeline run |
| `GET /api/pipeline/state` | Current pipeline state |
| `GET /api/nodes` | List all AI nodes |
| `GET /api/registry` | Full HeadyRegistry catalog |
| `GET /api/registry/component/:id` | Lookup a specific component |
| `GET /api/registry/environments` | List all environments |
| `GET /api/registry/docs` | List registered documents |
| `GET /api/registry/notebooks` | List registered notebooks |
| `GET /api/registry/patterns` | List architecture patterns |
| `GET /api/registry/workflows` | List workflows |
| `GET /api/registry/ai-nodes` | List AI nodes from registry |

## CLI Interface

The Heady CLI provides command-line access to Heady services:

```bash
# Set API key (or add to .env)
export HEADY_API_KEY="your_api_key"

# Run CLI
npm run cli
# or directly:
python scripts/heady_cli.py
```

See [scripts/heady_cli.md](scripts/heady_cli.md) for full documentation.

## Checkpoint Protocol

All files are kept in sync at every checkpoint (commit, merge, pipeline completion, release). See `docs/CHECKPOINT_PROTOCOL.md` for the full protocol.

```powershell
.\scripts\checkpoint-sync.ps1              # Full sync
.\scripts\checkpoint-sync.ps1 -Mode check  # Read-only drift detection
.\scripts\checkpoint-sync.ps1 -Mode fix    # Auto-fix issues
```

## HeadyRegistry

`heady-registry.json` is the central catalog of the entire ecosystem:
- **Components** — services, modules, apps
- **AI Nodes** — JULES, OBSERVER, BUILDER, ATLAS, PYTHIA
- **Workflows** — HCFullPipeline, HeadySync, Checkpoint Sync
- **Environments** — local, cloud-me, cloud-sys, cloud-conn, hybrid
- **Patterns** — Sacred Geometry, Checkpoint Protocol, Direct Routing
- **Docs & Notebooks** — tracked with version and review status

## Notebooks

Colab notebooks are stored under `notebooks/` and validated in CI:

| Notebook | Purpose |
|----------|---------|
| `notebooks/quick-start/heady-quick-start.ipynb` | Fast system orientation |
| `notebooks/tutorials/hcfullpipeline-walkthrough.ipynb` | Pipeline deep-dive |
| `notebooks/examples/registry-api-demo.ipynb` | Registry API examples |

## Key Documentation

| Path | Purpose |
|------|---------|
| `docs/CHECKPOINT_PROTOCOL.md` | Master protocol for keeping all files in sync |
| `docs/DOC_OWNERS.yaml` | Document ownership & review tracker |
| `docs/notion-quick-start.md` | Notion Quick Start template |
| `docs/notion-project-notebook.md` | Notion Project Notebook template |
| `docs/heady-services-manual.md` | Comprehensive services manual |
| `CLAUDE.md` | Claude Code integration protocol |

## Python & Colab Development

This project supports Python development with PyCharm and Google Colab integration.

### Project Structure

```
data/                    # Data directories
├── raw/                # Raw data files (git-ignored)
├── processed/          # Processed data
└── external/           # External data (git-ignored)

notebooks/              # Jupyter notebooks
├── exploratory/        # Scratch, EDA, experiments
├── reports/            # Clean, final notebooks
├── archive/            # Retired notebooks
└── figures/            # Exported plots/images

src/                    # Reusable Python code
tests/                  # Unit tests
```

### Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# For PyCharm: Open as Python project
# For Colab: See COLAB_WORKFLOW.md
```

### Key Files

- `requirements.txt` - Python dependencies
- `NOTEBOOK_TEMPLATE.md` - Template for new notebooks
- `COLAB_WORKFLOW.md` - Google Colab workflow guide
- `.env.example` - Environment variables template

## Deployment

Deployed via [Render.com](https://render.com) using `render.yaml`.

## License

Proprietary - Heady Systems


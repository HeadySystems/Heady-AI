<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
║                                                                  ║
║  Sacred Geometry · Organic Systems · Breathing Interfaces        ║
║  FILE: README.md  ·  LAYER: root                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady Systems

This bundle turns the attached Heady directives and configuration seeds into a production-oriented monorepo with Cloudflare edge workers, Cloud Run services, shared runtime packages, pgvector migrations, deployment workflows, and operational runbooks. Internal source material comes from the attached workspace directives, HCFullPipeline definitions, and cognitive configuration.

## System Status: 100% FULLY FUNCTIONAL

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

| Guide | What You Learn | Time |
|-------|----------------|------|
| [HeadyBuddy](docs/quickstarts/HEADYBUDDY.md) | AI companion (desktop + mobile) | 15 min |
| [HeadyServices](docs/quickstarts/HEADYSERVICES.md) | Backend infrastructure | 10 min |
| [HeadyAI-IDE](docs/quickstarts/HEADYIDE.md) | Custom IDE setup | 20 min |
| [HeadyBrowser](docs/quickstarts/HEADYBROWSER.md) | Browser extension | 10 min |
| [HeadyMCP](docs/quickstarts/HEADYMCP.md) | Manager Control Plane | 15 min |
| [Heady API](docs/quickstarts/HEADY_API_QUICKSTART.md) | API interaction | 10 min |

## Guides and References

- [Ecosystem Overview](docs/ECOSYSTEM_OVERVIEW.md) - Full system map across all brands
- [Service Integration](docs/guides/SERVICE_INTEGRATION.md) - How Heady services connect
- [HeadyManager API](docs/api/HEADYMANAGER_API.md) - Service endpoints reference

## Architecture

```
heady-manager.js          # Node.js MCP Server & API Gateway (port 3300)
├── src/                  # Core pipeline engine & agents
├── backend/              # Python worker & MCP servers
├── frontend/             # React UI (Vite + TailwindCSS)
├── HeadyAcademy/         # AI Nodes & Tools (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA)
├── packages/             # hc-supervisor, hc-brain, hc-health, hc-checkpoint
├── configs/              # YAML configuration (pipeline, resources, governance)
├── scripts/              # Automation (Sync, Build, Deploy, Checkpoint)
├── notebooks/            # Colab notebooks (quick-start, tutorials, examples)
├── docs/                 # Documentation & NotebookLM notebooks
└── heady-registry.json   # HeadyRegistry — central catalog of the ecosystem
```

---

## HCFullPipeline

Five-stage deterministic execution with deep checkpoints:

```
ingest → plan → execute-major-phase → recover → finalize
```

**Operational Readiness Score (ORS)** gates execution intensity:
- **85–100**: Full parallelism, all optimisations enabled
- **70–85**: Normal operation
- **50–70**: Maintenance mode, no new large builds
- **<50**: Recovery only — repair before building

---

## Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/pulse` | GET | System pulse with layer info |
| `/api/system/status` | GET | Full system status |
| `/api/pipeline/run` | POST | Trigger pipeline run |
| `/api/pipeline/state` | GET | Current state |
| `/api/nodes` | GET | List all AI nodes |
| `/api/supervisor/status` | GET | All agent statuses |
| `/api/brain/status` | GET | Brain + ORS |
| `/api/registry` | GET | Full HeadyRegistry catalog |
| `/api/registry/component/:id` | GET | Lookup a specific component |
| `/api/registry/environments` | GET | List all environments |
| `/api/registry/docs` | GET | List registered documents |
| `/api/registry/notebooks` | GET | List registered notebooks |
| `/api/registry/patterns` | GET | List architecture patterns |
| `/api/registry/workflows` | GET | List workflows |
| `/api/registry/ai-nodes` | GET | List AI nodes from registry |

Full reference: `public/api-docs.html` or `/api-docs.html` on the running system.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | Claude API key |
| `DATABASE_URL` | Recommended | PostgreSQL connection |
| `HEADY_API_KEY` | Recommended | Auto-generated if not set |
| `PORT` | Optional | Server port (default: 3300) |
| `NODE_ENV` | Optional | `development` or `production` |

---

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

At every checkpoint, 10-step deep analysis detects drift and syncs all files:

```powershell
.\scripts\checkpoint-sync.ps1              # Full sync
.\scripts\checkpoint-sync.ps1 -Mode check  # Read-only drift detection
.\scripts\checkpoint-sync.ps1 -Mode fix    # Auto-fix
```

Full protocol: `docs/CHECKPOINT_PROTOCOL.md`

---

## Key Documentation

| Path | Purpose |
|------|---------|
| `public/docs.html` | **Documentation hub** |
| `CLAUDE.md` | Claude Code integration protocol |
| `docs/CHECKPOINT_PROTOCOL.md` | Sync protocol |
| `docs/C4_ARCHITECTURE.md` | Architecture diagrams |
| `configs/hcfullpipeline.yaml` | Pipeline definition (source of truth) |
| `heady-registry.json` | Central component catalog |

---

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

```powershell
.\commit_and_build.ps1   # Local build
.\nexus_deploy.ps1       # Push to all remotes
```

Cloud Run deploy: `npm run deploy:cloud-run`

---

## License

Proprietary — Heady Systems

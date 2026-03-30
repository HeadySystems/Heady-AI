# Heady GitHub Secrets Reference

## How Secrets Are Used

All sensitive configuration is stored in **GitHub Repository Secrets** (`Settings > Secrets and variables > Actions`).
These are injected at deploy time into Cloud Run services and Cloudflare Workers — never committed to code.

---

## Infrastructure Secrets

| Secret | Service | Description |
|--------|---------|-------------|
| `CF_ACCOUNT_ID` | Cloudflare | Cloudflare account ID |
| `CF_API_TOKEN` | Cloudflare | Cloudflare API token (Pages + Workers deploy) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Alias for `CF_ACCOUNT_ID` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Alias for `CF_API_TOKEN` |
| `GCP_PROJECT_ID` | Google Cloud | GCP project ID |
| `GCP_REGION` | Google Cloud | GCP region (default: `us-central1`) |
| `GCP_SA_KEY` | Google Cloud | Service account JSON key for Cloud Run deploy |
| `CLOUD_RUN_SERVICE_URL` | Google Cloud | Base URL of the primary Cloud Run service |
| `NEON_DATABASE_URL` | Neon Postgres | PostgreSQL connection string with pgvector |
| `FIREBASE_PROJECT_ID` | Firebase | Firebase project ID |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase | FCM sender ID |
| `SENTRY_DSN` | Sentry | Error monitoring DSN |
| `SENTRY_ORG` | Sentry | Sentry organization slug |
| `HEADY_GITHUB_TOKEN` | GitHub | PAT for cross-repo operations |
| `LINEAR_API_KEY` | Linear | Issue tracking API key |
| `EDGE_GATEWAY_URL` | Cloudflare | Edge gateway Worker URL |

---

## AI Provider Secrets (HeadyBuddy / HeadyBrain Chat)

These power the multi-provider AI routing in `/api/brain/chat`.
The system uses a **race buffer** — all available providers fire simultaneously,
fastest response wins. More keys = more redundancy.

### Priority 1 — Primary Chat Providers

| Secret | Provider | Description |
|--------|----------|-------------|
| `HEADY_NEXUS_KEY` | Anthropic | Claude API key (headysystems org) — primary |
| `HEADY_JULES_KEY` | Anthropic | Alias for `HEADY_NEXUS_KEY` (HeadyJules branding) |
| `ANTHROPIC_SECONDARY_KEY` | Anthropic | Claude API key (headyconnection org) — failover |
| `HEADY_COMPUTE_KEY` | OpenAI-compat | API key for api.headycloud.com (GPT-4o-mini) |

### Priority 2 — Secondary Providers

| Secret | Provider | Description |
|--------|----------|-------------|
| `GOOGLE_API_KEY` | Google Gemini | Gemini API key — primary |
| `GOOGLE_API_KEY_SECONDARY` | Google Gemini | Gemini API key — failover |
| `HEADY_PYTHIA_KEY_HEADY` | Google Gemini | Gemini key (Heady project) |
| `HEADY_PYTHIA_KEY_GCLOUD` | Google Gemini | Gemini key (GCloud project) |
| `HEADY_PYTHIA_KEY_COLAB` | Google Gemini | Gemini key (Colab project) |
| `HEADY_PYTHIA_KEY_STUDIO` | Google Gemini | Gemini key (AI Studio) |

### Priority 3 — Tertiary Providers

| Secret | Provider | Description |
|--------|----------|-------------|
| `HF_TOKEN` | Hugging Face | HF Inference API token — primary |
| `HF_TOKEN_2` | Hugging Face | HF token — secondary |
| `HF_TOKEN_3` | Hugging Face | HF token — tertiary |

### Configuration

| Secret | Default | Description |
|--------|---------|-------------|
| `HEADY_BRAIN_API` | `https://api.headysystems.com` | Brain API base URL |
| `NODE_ENV` | `production` | Node environment |

---

## Setting Secrets

```bash
# Set a single secret
gh secret set HEADY_NEXUS_KEY --body "sk-ant-..."

# Set from .env file (useful for bulk updates)
gh secret set HEADY_NEXUS_KEY < <(grep HEADY_NEXUS_KEY .env.production | cut -d= -f2-)

# List all secrets
gh secret list
```

---

## Minimum Viable Configuration

For HeadyBuddy chat to work, you need **at least one** AI provider key:

1. `HEADY_NEXUS_KEY` — Anthropic Claude (recommended primary)
2. OR `HEADY_COMPUTE_KEY` — OpenAI-compatible
3. OR `GOOGLE_API_KEY` — Google Gemini
4. OR `HF_TOKEN` — Hugging Face (free tier available)

The brain router will use whatever keys are available and fall back gracefully.

---

*© 2026 HeadySystems Inc. — Eric Haywood, Founder*

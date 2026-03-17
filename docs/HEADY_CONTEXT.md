# Heady™ Project Context — Auto-Generated
>
> **READ THIS FIRST, EVERY TIME, NO EXCEPTIONS.**
> Last scanned: 2026-03-07T21:52:00Z | Version: 3.2.3

## Identity

- **Name:** HeadySystems Inc.
- **Founder:** Eric Haywood (eric-head / headyme)
- **Package:** `heady-systems` v3.2.3
- **Monorepo:** `/home/headyme/Heady/`
- **Architecture:** Continuous Latent Architecture (CLA) with Sacred Geometry (φ = 1.618)

## Live Infrastructure — NEVER USE LOCALHOST

| Service | Live URL | Status |
|---------|---------|--------|
| Onboarding + Auth | `https://heady-onboarding-609590223909.us-east1.run.app` | Cloud Run |
| HeadyAI IDE | `https://heady-ide-bf4q4zywhq-ue.a.run.app` | Cloud Run |
| headyos.com | CF Worker `headyos-site` | Cloudflare |
| heady-ai.com | CF Worker `heady-ai-org` | Cloudflare |
| headycloud.com | CF Worker `headycloud-site` | Cloudflare |
| headyme.com | CF Zone `7153f1efff9af0d91570c1c1be79e241` | Cloudflare |
| headybuddy.org | CF Zone `79ac0ab73fc7be9a5f0e475db078e592` | Cloudflare |
| headysystems.com | CF Zone `d71262d0faa509f890fd5fea413c39bc` | Cloudflare |

> **RULE:** ALL sites are served via Cloud Run or Cloudflare. NEVER serve via `localhost` or local dev server for production.

## GCP Project

- **Project ID:** `gen-lang-client-0920560496`
- **Region:** `us-east1`
- **Registry:** `us-east1-docker.pkg.dev/gen-lang-client-0920560496/cloud-run-source-deploy/`

## Cloudflare

- **Account ID:** `8b1fa38f282c691423c6399247d53323`
- **API Token:** Set in `.env` as `CLOUDFLARE_API_TOKEN`
- **70+ domains** — all active zones under Heady account

## Monorepo Structure

```
/home/headyme/Heady/
├── services/
│   ├── heady-onboarding/     # Next.js — Auth, Buddy, Brain/Chat, Pilot Onboarding
│   ├── heady-ui/             # UI components, generative-engine.js
│   ├── heady-buddy/          # Buddy widget (deployed via dist/ in sites)
│   ├── heady-web/            # Web portal shell + remotes
│   │   ├── sites/            # 9 static sites (headyme, headyos, headybuddy, etc.)
│   │   └── remotes/          # heady-ide, landing, dashboard, etc.
│   ├── heady-conductor/      # Auto-success orchestration engine
│   └── heady-manager/        # Micro-module manager (refactored from unified)
├── src/
│   ├── core/                 # CSL engine, API gateway v2, ternary orchestration
│   ├── services/             # Inference gateway, edge diffusion, gateway
│   ├── hcfp/                 # Heady Continuous Fusion Protocol
│   ├── mcp/                  # MCP server + gateway
│   ├── edge-workers/         # Edge compute workers
│   ├── prompts/              # System prompts, comparison prompts
│   └── shared/               # Phi-math, service connector
├── packages/
│   └── phi-math-foundation/  # φ mathematics library
├── platform-fixes/           # CF worker source (fix-2, fix-3, fix-4)
├── infra/kubernetes/         # K8s configs for pilot deploy
├── extensions/               # Chrome extension (HeadyBuddy)
├── docs/                     # VSA reference, patent research, strategic valuation
├── site-registry.json        # 9-site projection registry
├── .env                      # API keys (NEVER commit to git)
└── package.json              # heady-systems v3.2.3
```

## Key Files You MUST Know

| File | Purpose |
|------|---------|
| `services/heady-onboarding/src/app/api/brain/chat/route.ts` | Buddy chat backend |
| `services/heady-ui/generative-engine.js` | CSL-gated UI component factory |
| `src/services/inference-gateway.js` | Multi-provider AI gateway (Groq/Gemini/Claude/OpenAI/HF) |
| `src/core/csl-engine/csl-engine.js` | Continuous Semantic Logic engine |
| `src/mcp/heady-mcp-server.js` | MCP stdio/SSE server |
| `site-registry.json` | All 9 sites + domain mappings |
| `platform-fixes/fix-*/cloudflare/worker.js` | CF Worker source for each site |

## Technology Stack

- **Runtime:** Node.js 20+
- **Frontend:** Next.js 14 (onboarding), vanilla JS (sites), React (remotes)
- **Cloud:** Google Cloud Run, Cloudflare Workers, Cloudflare Pages
- **AI Providers:** Groq (free), Gemini (credits), Claude (quality), OpenAI, HuggingFace
- **Math Foundation:** Sacred Geometry — φ (1.618), Fibonacci sequences, CSL gates
- **IP:** 60+ provisional patents filed with USPTO

## Sacred Rules

1. **NEVER use localhost** for serving sites. Everything goes through Cloud Run or Cloudflare.
2. **φ-scaled everything** — spacing, sizing, scoring, routing all use golden ratio.
3. **CSL gates** replace boolean logic — all decisions are confidence-weighted (0→1).
4. **Cloud-first** — deploy to Cloud Run/CF Workers, not local dev servers.
5. **No placeholders** — every line of code must be real, functional, connected.
6. **No asking permission** for obvious fixes — fix it and report results.

## How to Deploy

```bash
# Cloud Run (any service with Dockerfile or package.json):
gcloud run deploy SERVICE_NAME --source . --region us-east1 --allow-unauthenticated --quiet

# Cloudflare Worker:
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/8b1fa38f282c691423c6399247d53323/workers/scripts/WORKER_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "worker.js=@worker.js;type=application/javascript+module"
```

## Current State (auto-updated by context-scan.sh)
- **Scanned:** 2026-03-16T18:49:13Z
- **Package:** heady-systems v3.1.0
- **Branch:** main
- **Last commit:** 352baa3dec feat(headyweb): functional dashboard — live Cloud Run API, 22 stages, 20 nodes
- **Dirty files:** 11
- **Total files:** 46717 (5469 JS, 1094 TS/TSX)
- **Services:** ai-router,ai_router,aloha,analytics,analytics-service,analytics-service.js,api,api-gateway,api-gateway.js,asset-pipeline,asset-pipeline.js,auth-session,auth-session-server,auth-session-server.js,auto-success-engine,billing-service,billing-service.js,buddy,budget-tracker,cli-service,cli_service,colab-gateway,colab_gateway,colab-runtime-manager.js,conductor-service,core-api,csl-engine-service,developer-portal.js,diagnostics,discord-bot,Dockerfile,domain-router,google-mcp,google_mcp,grpc-protos,hcfullpipeline-executor,heady-ableton,heady-audit,heady-auth,heady-autobiographer,heady-auto.js,heady-auto-success,heady-auto-tuner,heady-battle,heady-bee-factory,heady-brain,heady-brains,heady-buddy,heady-budget-tracker,heady-bulkhead,heady-bus,heady-cache,heady-cf-worker,heady-chain,heady-circuit-breaker,heady_client.py,heady-coder,heady-colab-coordinator.py,heady-conductor,heady-council,heady-cqrs,heady-csl-judge,heady-deploy.js,heady-drupal,heady-drupal-proxy,heady-embed,heady-embeddings,heady-eval,heady-event-store,heady-evolution-engine,heady-federation,heady-flags,heady-gate,heady-gateway,heady-governance,heady-guard,heady-hallucination-watchdog,heady-health,heady-hive,heady-identity,heady-infer,heady-inference,heady-inference-gateway,heady-knowledge,heady-lens,heady-liquid,heady-maintenance,heady-manager,heady-mc,heady-mcp,heady-mcp-server,heady-memory,heady-meter,heady-midi,heady-model-router,heady-observability,heady-observer,heady-onboarding,heady-orchestration,heady-persona-router,heady-pilot-onboarding,heady-pipeline-core,heady-pool-router,heady-projection,heady-receipt-signer,heady-registry,heady-researcher,heady-router,heady-saga,heady-sandbox,heady-security,heady-self-healing,heady-seventeen-swarm,heady-snapshot,heady-soul,heady-swarm-coordinator,heady-task-browser,heady-telemetry,heady-testing,heady-trader,heady-ui,heady-vector,heady-vector-memory,heady-vinci,heady-web,huggingface-gateway,huggingface_gateway,jules-mcp,jules_mcp,liquid-nodes,mcp-gateway,mcp-server,mcp_server,memory-mcp,memory_mcp,migration-service,migration-service.js,model-gateway,model_gateway,nats-consumers,node-management,notification,notification-service,notification-service.js,observability-kernel,onboarding,orchestrator,perplexity-mcp,perplexity_mcp,pipeline,prompt-manager,prompt_manager,registry,requirements.txt,saga-coordinator,scheduler,scheduler-service,scheduler-service.js,search,search-service,search-service.js,secret-gateway,secret_gateway,SERVICE_INDEX.json,service-mesh.js,service-registry.js,silicon-bridge,silicon_bridge,status-page.js,vector-memory-service
- **Sites:** 1ime1,1imi1,admin-portal,headyadvisor,headyagent,heady-ai,headyaid,headyapi,headyarchive,headyassist,headyassure,headybare,headybet,headybio,headybot,headybuddy,headycheck,headycloud,headyconnection-com,headyconnection-org,headycore,headycorrections,headycreator,headycrypt,headydb,headyex,headyfed,headyfield,headyfinance,headygov,headyhome,headyio,headykey,headykiosk,headylegal,headylibrary,headymanufacturing,headymcp,headymd,headyme,headymusic,headymx,headyos,headyplus,headyrx,headysafe,headysecure,headysense,headyship,headystate,headystore,headystudio,headysystems,headytube,headytxt,headyu,headyusa,headyvault,headyweb,openmindsplace,openmindstop
- **Cloud Run services:**
  - heady-ide: https://heady-ide-bf4q4zywhq-ue.a.run.app
  - heady-onboarding: https://heady-onboarding-bf4q4zywhq-ue.a.run.app
  - headyweb-ide: https://headyweb-ide-bf4q4zywhq-ue.a.run.app

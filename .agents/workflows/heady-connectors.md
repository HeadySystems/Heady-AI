---
description: List and verify all active Heady MCP connectors and services
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# Heady Connectors — Quick Reference

This workflow lists all active MCP connectors and how to verify them.

## Active MCP Servers (13 total)

### External Services
1. **cloudrun** — Google Cloud Run deploy/manage (`@google-cloud/cloud-run-mcp`)
2. **firebase-mcp-server** — Firebase project/app/hosting management
3. **genkit-mcp-server** — Genkit flow runtime, docs, execution
4. **GitKraken** — GitLens git operations (blame, branch, commit, push)
5. **perplexity-ask** — Web research via Sonar API
6. **github-mcp-server** — Full GitHub API (issues, PRs, repos, code search)

### Heady NPM Package
7. **heady-mcp-server** — Published `@heady-ai/mcp-server` (vector search, pipeline, bees, health)

### Cloud-Based Heady Services (via `@heady-ai/*` npm)
8. **heady-unified-mcp** — Service mesh, ecosystem map (70+ repos), event bus, evolution engine (`@heady-ai/unified-mcp-server`)
9. **heady-intelligence-mcp** — HeadyBattle arena, pattern recognition, autocontext (`@heady-ai/intelligence-mcp-server`)
10. **heady-memory-mcp** — 3-tier vector memory (hot/warm/cold), search, store, consolidate (`@heady-ai/memory-mcp-server`)
11. **heady-orchestration-mcp** — Swarm control, pipeline execution, task graphs (`@heady-ai/orchestration-mcp-server`)
12. **heady-governance-mcp** — Policy enforcement, cost tracking, RBAC, audit trails (`@heady-ai/governance-mcp-server`)
13. **liquid-nodes-mcp** — GitHub, Cloudflare, Vertex AI, Colab, latent space connectors (`@heady-ai/liquid-nodes-mcp-server`)

## Verification Steps

// turbo-all

1. Check Antigravity MCP config is valid JSON:
```bash
node -e "JSON.parse(require('fs').readFileSync('/home/headyme/.gemini/antigravity/mcp_config.json', 'utf8')); console.log('✅ Valid JSON')"
```

2. Check each MCP server file exists:
```bash
ls -la /home/headyme/Heady/mcp-servers/*.js # <!-- legacy path; no rebuild equivalent yet -->
```

3. Check PM2 services are running:
```bash
pm2 list
```

4. Quick smoke-test a server loads without crash:
```bash
timeout 3 node -e "const m = require('/home/headyme/Heady/mcp-servers/heady-unified-mcp-server.js'); console.log('✅ Unified MCP loaded, tools:', m.tools.length)" 2>&1 || true # <!-- legacy path; no rebuild equivalent yet -->
```

## When to Use Each Connector

| Task | Best Connector |
|------|---------------|
| Deploy to Cloud Run | `cloudrun` |
| Firebase project/hosting management | `firebase-mcp-server` |
| Run/test Genkit flows | `genkit-mcp-server` |
| Git operations (blame, diff, branch) | `GitKraken` |
| Web research / fact-checking | `perplexity-ask` |
| GitHub issues, PRs, code search | `github-mcp-server` |
| Vector memory search/store | `heady-mcp-server` or `heady-memory-mcp` |
| Multi-model AI battles | `heady-intelligence-mcp` |
| Service mesh topology/health | `heady-unified-mcp` |
| Pipeline/swarm orchestration | `heady-orchestration-mcp` |
| Policy/cost/RBAC governance | `heady-governance-mcp` |
| AI node personalities | `liquid-nodes-mcp` |

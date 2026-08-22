<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Law 0 Loopback Triage — 2026-08-22                       ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Law 0 loopback triage — 42 sites

Narrowing the domain-hygiene scan to authored configuration (commit `b7e8cbb21b`)
uncovered **42 LAW-0 findings** that 200+ rows of dependency-metadata noise had been
hiding. This document triages all 42 **before** any of them is edited, because a
blind sweep would break three categories of site where loopback is correct.

**Nothing here is fixed yet.** Remediating ~24 call sites in legacy runtime code is
its own change with its own risk, and it needs the policy below settled first.

## The fix pattern (already in the tree)

`src/config/global.js` states its own contract in its header:

> *ALL environment variables, URLs, ports, and constants are defined HERE.
> No other file should read `process.env` directly.*

It exports `URLS` — `MANAGER`, `BRAIN`, `EDGE_PROXY`, `CLOUDRUN`, `QDRANT`, `REDIS` —
each built with `optionalEnv(KEY, '<cloud default>')`, i.e. env-derived with a
**cloud** fallback, never loopback. It is CommonJS, so the legacy `src/` tree can
consume it directly:

```js
const { URLS } = require('../config/global');
```

Every Category A site below both hardcodes loopback **and** bypasses that contract,
usually as `process.env.X || 'https://127.0.0.1:3301'` — a fail-OPEN fallback that
silently dials nothing in a cloud deployment instead of failing loudly. Routing them
through `URLS` fixes the Law 0 breach and the bypass in one move, and introduces no
new magic value.

Only two consumers currently honor the contract (`src/bees/config-bee.js` and
global.js itself), which is why this drifted so far.

## Category A — real violations (24 sites)

Loopback used as an outbound **service target**. This is what Law 0 forbids: a
cloud-deployed service dialing its own machine.

| File:line | Current | Replace with |
|---|---|---|
| `src/brain_connector.js:22` | `https://127.0.0.1:3301/api/brain` | `URLS.BRAIN` |
| `src/compute-dashboard.js:147` | `https://127.0.0.1:3301/api/pulse` | `URLS.MANAGER` |
| `src/hc_deep_scan.js:18` | `MANAGER_URL = "https://127.0.0.1:3301"` | `URLS.MANAGER` |
| `src/hcfp/pipeline-runner.js:260` | `fetch("https://127.0.0.1:3301/api/memory/store")` | `URLS.MANAGER` |
| `src/hcfp/task-dispatcher.js:63` | `process.env.HEADY_BRAIN_URL \|\| "https://127.0.0.1:3301/..."` | `URLS.BRAIN` |
| `src/heady-registry.js:193` | `BASE = "https://127.0.0.1:3301"` | `URLS.MANAGER` |
| `src/provider-benchmark.js:144` | `httpPing("https://127.0.0.1:3301/api/pulse")` | `URLS.MANAGER` |
| `src/routes/conductor.js:24` | `process.env.HEADY_MANAGER_URL \|\| "https://127.0.0.1:3301"` | `URLS.MANAGER` |
| `src/routes/headybuddy-config.js:132` | `fetch('https://127.0.0.1:3301/api/pulse')` | `URLS.MANAGER` |
| `src/routes/hive-sdk.js:43` | `http.request("http://127.0.0.1:3301/api/brain/chat")` | `URLS.BRAIN` |
| `src/routes/lens.js:80` | `process.env.HEADY_MANAGER_URL \|\| "https://127.0.0.1:3301"` | `URLS.MANAGER` |
| `src/mcp/mcp-sse-transport.js:29` | `... \|\| 'http://localhost:3301'` | `URLS.MANAGER` |
| `src/services/heady-notion.js:386` | `curl -4 http://127.0.0.1:3301/api/soul/health` | `URLS.MANAGER` (doc string) |
| `src/services/liquid-state-manager.js:339` | `{ id: 'local-dev', url: 'http://localhost:3301' }` | drop the tier-3 local-dev projection |
| `src/services/dynamic-model-registry.js:362` | `fetch('http://localhost:4000/v1/models')` | needs an env-backed gateway URL |
| `heady-manager.js:1603` | `managerUrl: \`http://localhost:${PORT}\`` | `URLS.MANAGER` |
| `src/telemetry/otel.js:36` | `OTEL_EXPORTER_OTLP_ENDPOINT \|\| 'http://localhost:4318/v1/traces'` | fail closed — no collector is better than a fake one |
| `src/middleware/cors.js:89` | `origin ?? 'http://localhost:3000'` | **security-relevant** — a missing Origin must not default to a trusted one; use `ALLOWED_ORIGINS` |
| `src/routes/memory.js:36` | `QDRANT_URL \|\| "http://127.0.0.1:6333"` | **Qdrant is DROPPED** (facts.yaml + ADR-0003) — delete the path |
| `src/embedding-provider.js:21` | `opts.localEndpoint \|\| "http://127.0.0.1:11434/api/embeddings"` | Ollama; see the open question below |
| `src/vector-memory.js:428` | `fetch(\`http://127.0.0.1:${OLLAMA_PORT}/api/embeddings\`)` | Ollama; same |
| `src/routes/headybuddy-config.js:137` | `fetch('http://127.0.0.1:11434/')` | Ollama; same |
| `src/bees/session-templates.js:271` | `{ name: 'local', url: 'http://localhost:8420/health' }` | drop or make the template's health target env-derived |
| `src/bees/session-templates.js:455` | same | same |

**Open question for the founder:** three sites dial **Ollama** on `:11434`, which is
by definition a same-host inference server. Under the Zero-Localhost policy there is
no local host, so either those code paths are dead and should be deleted, or Ollama
is reachable at a cloud address that needs an env var. This is a product decision,
not a lint fix — the three sites are listed above but should be resolved together.

## Category B — loopback that is NOT a network call (5 sites)

`new URL(relativeUrl, base)` requires an absolute base. The base host is parsed and
discarded; nothing is dialed. Rewriting these to a real domain would be misleading,
not safer.

- `src/auth-page-server.js:28`
- `src/mcp/colab-mcp-bridge.js:349`
- `src/mcp/colab-mcp-bridge.js:579`
- `src/services/quantum-bridge.js:47` — `new URL(request.url, 'ws://localhost')`

**Recommendation:** exempt this shape in the guard (a `new URL(…, '<loopback>')`
second argument), rather than editing the call sites. An exemption with a stated
reason is honest; a cosmetic rewrite is not.

## Category C — container-internal and generated-artifact content (9 sites)

- `src/projection/domain-slicer.js:176` — a **Dockerfile HEALTHCHECK** emitted into a
  scaffolded project: `http://localhost:8080/health`. A container probing itself is
  the correct, idiomatic form. **Do not change** — this one would actively break
  healthchecks.
- `src/projection/domain-slicer.js:90` — README text generated for a scaffolded site
  ("Visit `http://localhost:3000` to see it running locally"). Prose in an artifact.
- Server-ready banners printed at boot: `src/auth-page-server.js:96`,
  `src/mcp/colab-mcp-bridge.js:674–678`, `src/projection/domain-slicer.js:157`,
  `templates/template-mcp-server/src/index.js:128–129`. These also violate
  **AGENTS.md #2 (zero `console.log`)** — fix both at once, or delete the banners.
- `package.json:65` — `"health": "curl -s http://localhost:3301/health/live"`, a
  developer convenience script.

## Category D — must NOT be touched (1 site)

- `tests/unified-runtime-orchestrator.test.js:12` —
  `expect(validateCloudOnlyEndpoints(['http://localhost:3000/health'])).toBe(false)`.
  This asserts that Law 0 **rejects** loopback. "Fixing" it would delete the test of
  the law. The guard should exempt test paths for LAW-0, exactly as
  `tooling/coherence/src/scalar-guards.mjs` already path-exempts tests that assert
  the rejection of wrong canonical numbers.

## Suggested order

1. Settle the Ollama question (Category A, 3 sites) — it may delete work.
2. Encode B/C/D as guard exemptions **with reasons**, so the remaining count is all
   real. Without this, fixing A still leaves 15 findings and the report stays noise.
3. Fix Category A through `URLS`, smallest blast radius first
   (`hc_deep_scan`, `provider-benchmark`, `heady-registry`), leaving
   `src/middleware/cors.js:89` for a security review of its own — a missing `Origin`
   header currently defaults to a trusted value.
4. Re-run `node tooling/data-consistency/src/domain-guard.mjs`; LAW-0 should reach 0.

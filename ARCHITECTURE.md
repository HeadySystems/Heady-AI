# Heady™ Architecture — Unified Core

## Overview

Heady™ is a sovereign AI operating system built on φ-scaled architecture. The system was rebuilt from 22+ scattered orchestration components into a clean, unified `core/` module.

## Core Modules

```
core/
├── index.js                    # System entry point & bootstrap
├── constants/
│   └── phi.js                  # ALL φ-derived constants (single source of truth)
├── infrastructure/
│   ├── circuit-breaker.js      # Unified circuit breaker (CLOSED→OPEN→HALF_OPEN)
│   └── worker-pool.js          # φ-scaled concurrent task execution
├── pipeline/
│   ├── stages.js               # 21-stage canonical pipeline definitions
│   └── engine.js               # Unified pipeline engine (5 variants)
├── orchestrator/
│   └── conductor.js            # Agent coordinator + task router + workflow engine
├── scheduler/
│   └── auto-success.js         # φ-scaled background task scheduler
└── agents/
    └── registry.js             # Canonical agent definitions
```

## What Was Consolidated

| New Module | Replaced Components |
|------------|-------------------|
| `core/constants/phi.js` | `shared/phi-math.js`, `phi-constants.js`, inline constants in 5+ files |
| `core/infrastructure/circuit-breaker.js` | `pipeline-infra.js`, `middleware/circuit-breaker.js`, `resilience/circuit-breaker.js` |
| `core/infrastructure/worker-pool.js` | `pipeline-infra.js`, `hc_orchestrator.js` parallel execution |
| `core/pipeline/engine.js` | `pipeline-runner.js`, `hybrid-pipeline.js`, `auto-success-engine.ts`, `heady-chain/`, `hcfullpipeline/`, `hcfullpipeline-executor/` |
| `core/pipeline/stages.js` | Stage definitions from `hybrid-pipeline.js`, HCFP phases, auto-success categories |
| `core/orchestrator/conductor.js` | `hc_orchestrator.js`, `agent-orchestrator.js`, `heady-conductor.js` |
| `core/scheduler/auto-success.js` | `auto-success-engine.ts`, heartbeat logic from `heady-conductor.js` |
| `core/agents/registry.js` | `KNOWN_AGENTS`, `initializeAgentPool()`, `agent-config.json` |

## φ-Scaled Architecture

All system constants derive from φ (1.618033988749895):

| Constant | Formula | Value | Usage |
|----------|---------|-------|-------|
| PHI | φ | 1.618 | Base ratio |
| PSI | 1/φ | 0.618 | CSL BOOST threshold |
| PSI² | 1/φ² | 0.382 | CSL INCLUDE threshold |
| FIB sequence | F(n) | [1,1,2,3,5,8,13,21,34,55,89,144...] | Pool sizes, limits |
| TIMING.FAST | φ³×1000 | ~4,236ms | Fast operations |
| TIMING.NORMAL | φ⁵×1000 | ~11,090ms | Standard operations |
| TIMING.LONG | φ⁸×1000 | ~46,979ms | Long operations |
| Heartbeat | φ⁷×1000 | ~29,034ms | Auto-success cycle |

## Pipeline Variants

| Variant | Stages | Use Case |
|---------|--------|----------|
| FAST | 8 stages | Simple tasks, low latency |
| STANDARD | 13 stages | Normal HCFP flow |
| FULL | 21 stages | Complete analysis pipeline |
| ARENA | 15 stages | Multi-model code competition |
| LEARNING | 13 stages | Self-improvement loops |

## CSL (Confidence Signal Logic)

Replaces boolean gates with confidence-weighted signals:

| Gate | Value | Meaning |
|------|-------|---------|
| SUPPRESS | 0.236 | Below threshold — filter out |
| INCLUDE | 0.382 | Minimum viable — include cautiously |
| BOOST | 0.618 | Strong signal — prioritize |
| INJECT | 0.718 | High confidence — inject into pipeline |
| HIGH | 0.882 | Very high confidence |
| CRITICAL | 0.927 | Critical path — must succeed |

## Agent Registry

| Agent | Role | Model Tier | Concurrency |
|-------|------|-----------|-------------|
| Brain | Central cognitive engine | Premium | 3 |
| Researcher | Autonomous deep research | Premium | 2 |
| DevOps | Platform monitoring & deployment | Standard | 3 |
| Content | CMS publishing (9 sites) | Standard | 3 |
| Jules | Task automation & scheduling | Fast | 5 |
| Builder | Code generation & scaffolding | Premium | 2 |
| Observer | System monitoring & alerting | Fast | 5 |
| Sentinel | Security scanning & threat detection | Standard | 2 |
| Atlas | Data mapping & integration | Standard | 3 |
| Muse | Creative content & copywriting | Premium | 2 |
| Sophia | Knowledge synthesis & learning | Premium | 2 |

## MCP Server (47 Tools)

```
HeadyMCP Server (port 3310) ── 47 MCP Tools
  ├── Intelligence: deep_scan, analyze, risks, patterns, refactor
  ├── Memory: memory, embed, learn, recall, vector_store/search/stats
  ├── Orchestration: auto_flow, orchestrator, hcfp_status, csl_engine
  ├── Execution: coder, battle, buddy, chat, claude/openai/gemini/groq
  ├── Operations: deploy, health, ops, maintenance, maid, telemetry
  ├── CMS: cms_content, cms_taxonomy, cms_media, cms_views, cms_search
  └── Core Bridge → core/ (PipelineEngine, Conductor, AutoSuccessScheduler)
```

## Usage

```javascript
const heady = require('./core');

// Bootstrap full system
const { engine, conductor, scheduler } = heady.createSystem();

// Execute pipeline
const result = await engine.execute(input, { variant: 'STANDARD' });

// Dispatch task to agent
const taskResult = await conductor.dispatch({
  type: 'analyze',
  category: 'analysis',
  payload: { code: '...' },
});

// Register background task
scheduler.registerTask('my-task', {
  category: 'MONITORING',
  handler: async () => ({ status: 'ok' }),
});
scheduler.start();
```

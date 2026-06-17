# ADR-0010: Core Module Consolidation — 22+ Scattered Components → Unified core/
**Date:** 2026-06-17 | **Status:** Accepted | **Author:** Eric Haywood

## Context

The legacy codebase contained 22+ overlapping orchestration components: multiple
circuit breaker implementations (`pipeline-infra.js`, `middleware/circuit-breaker.js`,
`resilience/circuit-breaker.js`), multiple pipeline executors (`pipeline-runner.js`,
`hybrid-pipeline.js`, `auto-success-engine.ts`, `heady-chain/`, `hcfullpipeline/`,
`hcfullpipeline-executor/`), and multiple agent registries. Each duplicated logic
diverged over time, creating inconsistent behaviour across pipeline variants.

The rebuild introduced `core/` as the canonical module tree, but no ADR formalised
the consolidation mandate or its scope.

## Decision

All foundational orchestration logic consolidates into `core/` with a strict one-
canonical-implementation rule:

| Module | Replaces |
|--------|---------|
| `core/constants/phi.js` | `shared/phi-math.js`, `phi-constants.js`, 5+ inline sets |
| `core/infrastructure/circuit-breaker.js` | 3 circuit breaker implementations |
| `core/infrastructure/worker-pool.js` | Parallel execution from `pipeline-infra.js` + `hc_orchestrator.js` |
| `core/pipeline/engine.js` | 6 pipeline executor variants |
| `core/pipeline/stages.js` | Stage definitions from 3 sources |
| `core/orchestrator/conductor.js` | `hc_orchestrator.js`, `agent-orchestrator.js`, `heady-conductor.js` |
| `core/scheduler/auto-success.js` | `auto-success-engine.ts` + heartbeat from `heady-conductor.js` |
| `core/agents/registry.js` | `KNOWN_AGENTS`, `initializeAgentPool()`, `agent-config.json` |

No new orchestration logic is added outside `core/` without an ADR amendment.

## Consequences

### Positive
- Single import path for all orchestration primitives — `require('./core')`
- Divergence bugs eliminated: one circuit breaker means one set of state transitions
- `createSystem()` bootstraps the full stack in one call for tests and services
- 5 pipeline variants (FAST/STANDARD/FULL/ARENA/LEARNING) share the same engine code path
- `heady-manager.js` 76KB refactor becomes tractable: extract routes, keep core calls

### Negative
- Migration from legacy imports to `core/` requires updating all existing service call sites
- `core/` is now a blast radius: a bug there affects all consumers simultaneously
- Breaking changes to `core/` require coordinated deploys across all dependent services

## Alternatives Considered

- **Microservice-per-component**: rejected — too much inter-service latency for tightly coupled orchestration
- **Keep scattered files, add re-export index**: rejected — does not eliminate divergence, only hides it
- **TypeScript rewrite of core/**: considered — deferred; ESM Node.js is the mandated runtime (Law #2)

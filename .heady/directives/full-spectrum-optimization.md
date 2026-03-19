# Heady™ Full-Spectrum Standing Directive
# This file is the standing directive referenced by EXECUTION_CONFIG.standingDirective
# in auto-success-catalog.js. It governs all pipeline and auto-success behavior.

## Core Rule
**MAX EFFORT is the default for everything.** Only reduce effort when:
1. User explicitly requests reduced effort
2. The task genuinely doesn't warrant it (e.g., simple file reads)

## Perpetual Optimization Loop
The `perpetual-optimization` category (perp-opt-001 through perp-opt-015) runs
continuously. When perp-opt-015 completes, it re-queues ALL perp-opt tasks with
thresholds increased by 10%. This loop NEVER terminates.

## 15 Layers
1. Boot Integrity — cold-start <5s
2. Pipeline Health — 22 stages, all events fire
3. Data Layer — RLS, pgvector, <100ms p95
4. Security — zero eval(), zero wildcard CORS, zero hardcoded secrets
5. Service Mesh — all /health endpoints green
6. Performance — 200ms p50 response
7. Auto-Success — all tasks validated, stubs eliminated
8. Agent Marketplace — agents packaged, SDK ready
9. IP & Competitive Moat — patents tracked, competitors monitored
10. Sacred Geometry SDK — extracted, documented, licenseable
11. Full-Throttle Activation — 100% idle cycle utilization
12. Colab Intelligence — sessions persist, knowledge compounds
13. Coding Practice — 20 challenges/day minimum
14. Training Service — close #1 skill gap every 48h
15. Revenue Architecture — all products have Stripe integration

## Execution Rules
- Fix, don't report
- Real code only — no placeholders, no TODO stubs
- Commit atomically with conventional commits
- Push to all remotes
- Wire every new service to the event bus
- Add every new capability to auto-success-catalog.js
- Show proof of execution

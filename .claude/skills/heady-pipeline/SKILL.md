---
name: heady-pipeline
description: Run, inspect, and manage the HCFullPipeline — 9-stage build/deploy/validate pipeline
---

# heady-pipeline

Operate the HCFullPipeline — the central 9-stage pipeline that powers all Heady builds, deploys, and validations.

## What to do

1. Read `configs/hcfullpipeline.yaml` for stage definitions (9 stages + checkpoint gates)
2. Read `configs/hcfullpipeline-tasks.json` for per-stage task breakdowns
3. Read `src/hc_pipeline.js` for the pipeline executor class
4. Check `src/hc_skill_executor.js` for the skill execution engine
5. Use MCP tool `heady_pipeline_status` if the MCP server is connected
6. Report pipeline state including:
   - Stage definitions and current progress
   - Checkpoint protocol compliance (see `docs/CHECKPOINT_PROTOCOL.md`)
   - Task completion status per stage
   - Any blocked or failed stages

## Pipeline stages (from hcfullpipeline.yaml)

1. Research & Learning
2. Architecture & Design
3. Implementation
4. Testing & Quality
5. Security & Compliance
6. Documentation
7. Deployment
8. Monitoring & Observability
9. Continuous Improvement

## Key files

- `configs/hcfullpipeline.yaml` — 9-stage pipeline definition
- `configs/hcfullpipeline-tasks.json` — Per-stage task breakdown
- `src/hc_pipeline.js` — Pipeline executor
- `src/hc_skill_executor.js` — Skill execution engine
- `docs/CHECKPOINT_PROTOCOL.md` — 14-step checkpoint protocol
- `configs/pipeline-gates.yaml` — Quality gates between stages

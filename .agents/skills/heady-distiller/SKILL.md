---
name: heady-distiller
description: Reverse-engineer agent execution traces into optimized SKILL.md recipes
---

# HeadyDistiller Skill (Antigravity Mirror)

Mirrors `.claude/skills/heady-distiller/SKILL.md` for the Antigravity agent framework.

## Steps

1. Load the distiller: `const D = require('./src/hc_distiller');`
2. Initialize: `const d = new D(); d.initialize();`
3. Hook into systems: `d.hookSkillExecutor(executor); d.hookPipeline(pipeline);`
4. Run distillation: `d.distill({ skillName, category, optimizePrompts: true })`
5. Check status: `d.getStatus()`

## Source Mapping

- `src/hc_distiller.js` → Main orchestrator
- `src/hc_trace_recorder.js` → JSONL trace collection
- `src/hc_replay_client.js` → Deterministic replay
- `src/hc_trajectory_filter.js` → 3-pattern filtering
- `src/hc_skill_synthesizer.js` → SKILL.md synthesis
- `src/hc_prompt_optimizer.js` → GEPA/MIPROv2/TextGrad
- `configs/distiller-config.yaml` → Configuration

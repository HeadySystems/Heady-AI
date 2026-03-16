---
name: "heady-distiller"
slug: "heady-distiller"
description: "Reverse-engineer agent execution traces into optimized, reusable SKILL.md recipes"
category: "intelligence"
---

# /heady-distiller

Distill successful agent execution traces into optimized prompts, workflows, and reusable SKILL.md packages.

## What This Does

1. **Records traces** from SkillExecutor and HCFullPipeline runs (JSONL append-only)
2. **Filters trajectories** using 3 research-backed strategies:
   - Success filtering (SWE-Gym RFT: keep only passing traces)
   - Confidence filtering (WEBRL: exclude trivial and flailing runs)
   - Trajectory-to-tips (extract abstract tips with applicability conditions)
3. **Synthesizes SKILL.md** from filtered traces (Voyager code-as-skill pattern)
4. **Optimizes prompts** using GEPA/MIPROv2/TextGrad from trace data
5. **Replays traces** deterministically using recorded non-deterministic inputs

## Usage

### Full Distillation Pipeline

```bash
# Run distillation on all recorded traces
node -e "
const D = require('./src/hc_distiller');
const d = new D(); d.initialize();
d.distill({ skillName: 'my-distilled-skill', category: 'automation' })
  .then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### Hook Into Existing Systems

```javascript
const HeadyDistiller = require('./src/hc_distiller');
const SkillExecutor = require('./src/hc_skill_executor');

const distiller = new HeadyDistiller();
const executor = new SkillExecutor();

distiller.hookSkillExecutor(executor);  // auto-record all skill executions
distiller.hookPipeline(pipeline);       // auto-record pipeline runs
distiller.initialize();
```

### Replay a Trace

```bash
node -e "
const D = require('./src/hc_distiller');
const d = new D();
d.verify('trace_1234567890_abcdef01').then(r => console.log(r));
"
```

### Get Status

```bash
node -e "
const D = require('./src/hc_distiller');
const d = new D(); d.initialize();
console.log(JSON.stringify(d.getStatus(), null, 2));
"
```

## Configuration

Edit `configs/distiller-config.yaml` to tune:
- Filtering thresholds
- Optimization method (gepa, miprov2, textgrad)
- Synthesis output directory
- Compression ratio
- Caching strategy

## Source Files

| File | Purpose |
|------|---------|
| `src/hc_distiller.js` | Main orchestrator |
| `src/hc_trace_recorder.js` | Event-driven trace collection |
| `src/hc_replay_client.js` | Deterministic replay from traces |
| `src/hc_trajectory_filter.js` | 3-pattern trajectory filtering |
| `src/hc_skill_synthesizer.js` | Trace → SKILL.md synthesis |
| `src/hc_prompt_optimizer.js` | GEPA/MIPROv2/TextGrad optimization |
| `configs/distiller-config.yaml` | Configuration |

## Autonomy

- `requires_approval`: none
- `auto_run`: true
- `can_modify_files`: true
- `can_execute_commands`: true

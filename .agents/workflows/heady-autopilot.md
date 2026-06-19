---
name: heady-autopilot
description: "Autonomous execution autopilot for the Heady ecosystem. Drives a goal to completion with a configurable level of autonomy: maps the route, intelligently selects and runs beneficial /heady-* skills/commands/workflows, verifies, then auto commit→push→sync→logs. Optional --goal and --conditions set the destination; --grill-me clarifies ambiguous goals/parameters before committing. Use when the user says"
---

# heady-autopilot

> This is a Workflow Wrapper exposing the `heady-autopilot` Skill to the UI command palette.

## Trigger Details
When this workflow is executed via the `/heady-autopilot` slash command, the system will automatically invoke the underlying skill and execute its designated logic.

Refer to the primary definition in `.agents/skills/heady-autopilot/SKILL.md` for full operational details.

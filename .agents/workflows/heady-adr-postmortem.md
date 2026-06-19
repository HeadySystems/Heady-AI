---
name: heady-adr-postmortem
description: "Generates an exhaustive Post-Build Diagnostic Report after an ADR is approved and built, or when requested by /heady-autopilot. Breaks down execution reality vs intent, system parameters, strategic defensibility, alternatives, and usage. Use whenever a major architecture change is finalized or the user requests a post-build report."
---

# heady-adr-postmortem

> This is a Workflow Wrapper exposing the `heady-adr-postmortem` Skill to the UI command palette.

## Trigger Details
When this workflow is executed via the `/heady-adr-postmortem` slash command, the system will automatically invoke the underlying skill and execute its designated logic.

Refer to the primary definition in `.agents/skills/heady-adr-postmortem/SKILL.md` for full operational details.

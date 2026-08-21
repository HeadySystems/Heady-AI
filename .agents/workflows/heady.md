---
description: Intelligence-first @heady and /heady router that selects and executes beneficial governed Heady skills and workflows
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Intelligence-First Command Router v1.0.0                 ║
║  Grounds every task in available, governed Heady capabilities.   ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# `@heady` / `/heady` Intelligence Router

Use this command for `@heady <input>`, `/heady <input>`, or `heady <input>`.
Heady intelligence is the first task-routing stage after system, developer,
repository, safety, and explicit user instructions.

## Route

1. Preserve the user's complete input, including explicit `$heady-*` skill
   references and requested outcomes.
2. From the repository root, run the read-only router:

   ```bash
   node tooling/auto-flow/route.mjs --json -- "<complete user input>"
   ```

3. Inspect `unresolvedExplicitRefs`. Report unavailable capabilities and use a
   valid fallback; never invent a tool, endpoint, deployment, or successful
   result.
4. For every selected skill, read its canonical
   `.agents/skills/<name>/SKILL.md` completely before acting. For every selected
   workflow, read `.agents/workflows/<name>.md` completely. Announce which ones
   are being used and why.
5. Apply the perspective-role ranking to decomposition and review, then execute
   selected capabilities in user order. Add automatically recommended
   capabilities only when they materially help the requested outcome.
6. Continue through implementation and proportionate verification. Do not stop
   after producing a route or plan when the request authorizes execution.

## Authority and Safety Contract

- The router advises execution; it does not expand user authorization.
- Never recursively invoke `@heady`, `/heady`, or `/heady-command`.
- Validate current files, commands, MCP tools, credentials, and deployment
  targets before relying on them.
- Preserve dirty work unless its ownership and disposition are proven.
- Keep destructive changes, external messages, commits, pushes, deployments,
  secret access, and governance ceremonies behind their applicable human gates.
- Automated review never substitutes for founder signatures or independent
  human review.
- When a mandatory Heady MCP capability is unavailable, say so and perform the
  closest safe local diagnostic without claiming the remote operation ran.

## Completion

Finish with executed capabilities, changed artifacts, verification evidence,
remaining blockers, and a durable handoff/checkpoint when the task spans
multiple lanes or cannot safely finish in one run.

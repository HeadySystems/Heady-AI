---
name: heady-agent-handoff
description: "Securely packages the current system state, updates context artifacts, and generates a high-signal handover document so the next agent (or human) can seamlessly resume with zero context loss."
---

# Heady Agent Handoff Protocol

The **Agent Handoff** is the formal protocol for ending an active execution session. It guarantees that the intelligence, context, and exact system state achieved by the current agent are durably written into the vector ledger and artifacts before the session terminates.

## When to Use
- When completing a long-running execution chain.
- When an agent hits a hard limit (context window or compute duration) and needs to spawn a fresh instance of itself to continue.
- When passing context from an Architect/Planning agent to an Execution/Coding agent.
- Manually via `/heady-agent-handoff` at the end of a shift.

## The 3-Stage Handoff Sequence

### Stage 1: Context Consolidation
- The agent gathers all active artifacts (Implementation Plans, Walkthroughs, Tasks).
- It reviews the most recent Checkpoint or Omni-Sync status.

### Stage 2: Artifact Update
- The agent updates the `omni_sync_handoff.md` (or equivalent `agent_handoff.md`) artifact with:
  1. **Accomplished:** A hyper-condensed summary of what was definitively completed during this session.
  2. **Unresolved:** Any broken tests, pending bugs, or explicitly deferred tasks.
  3. **Next Immediate Step:** The absolute first thing the next agent should do upon waking up.

### Stage 3: Session Termination
- The agent prints a clear, user-facing summary of the handoff state.
- The session is formally terminated, leaving the workspace in a stable, frozen state ready for the next intelligence to inherit.

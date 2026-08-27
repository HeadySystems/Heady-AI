// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Flow definition: skill-preflight v1.0.0             ║
// ║  Before any task runs, scan the whole skill+workflow catalog and  ║
// ║  CSL-gate a shortlist of what could be beneficially used.         ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Conforms to FlowSchema from the `heady-auto-flow` skill. Declarative data:
// the engine (runFlow) executes it by advancing on NATS observations and
// CSL-gating each transition. Step 0 (`preflight`) is MANDATORY and fail-closed
// — a task cannot start until the catalog has been scanned and a shortlist
// produced, so no available skill/workflow is ever silently overlooked.

// φ-derived gate thresholds: HALT < 1/φ² (0.382) · EXECUTE ≥ 1/φ (0.618).
const PHI = 1.618033988749895;

export const skillPreflightFlow = {
  id: "skill-preflight",
  // Fires when a new task is admitted to the system.
  trigger: "heady.action.task.submitted",
  steps: [
    {
      id: "preflight",
      kind: "skill",
      ref: "heady-deep-scan", // catalog scan + capability match (uses tooling/auto-flow/preflight.mjs)
      input: { matcher: "tooling/auto-flow/preflight.mjs", taskFrom: "trigger.payload.task" },
      on: "heady.observation.preflight.done",
      // Must clear the gate before the task proceeds; low confidence → re-scan/expand search.
      gate: { halt: 1 / (PHI * PHI), execute: 1 / PHI },
      next: "select",
      onHalt: "expand-search",
    },
    {
      id: "expand-search",
      kind: "skill",
      ref: "heady-evolution-swarm", // widen: look beyond the catalog (new tools / absorption)
      input: { reason: "preflight found no strong match" },
      on: "heady.observation.expand.done",
      gate: { halt: 1 / (PHI * PHI), execute: 1 / PHI },
      next: "select",
      onHalt: "select", // even if nothing new, proceed — preflight is advisory, never a dead-end
    },
    {
      id: "select",
      kind: "skill",
      ref: "heady-task-decomposition", // bind the recommended skills/workflows into the task plan
      input: { useShortlistFrom: "preflight" },
      on: "heady.observation.select.done",
      next: null, // hand the enriched plan back to the caller / the next Auto-Flow
    },
  ],
  // Not a loop; this is a one-shot preflight gate that precedes the real task flow.
  loop: null,
  budgetTokens: null,
};

export default skillPreflightFlow;

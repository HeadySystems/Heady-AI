---
name: heady-checkpoint
description: "A system-wide Cognitive Validation Event. Scans, categorizes, and validates all components through the 10-Lens Heady Understanding Engine (HUE). Generates a comprehensive confidence score and autonomously routes to /heady-omni-sync (if high confidence) or /heady-battle-sim (if low confidence)."
---

# Heady Checkpoint Workflow

The **Heady Checkpoint** is not a simple state-save; it is a massive, system-wide **Cognitive Validation Event**. When triggered, the system pauses all operations to rigorously interrogate its own state, categorize every component, and verify its understanding across multiple lenses. 

It results in a comprehensive snapshot and an autonomous decision on how to proceed based on Continuous Semantic Logic (CSL) confidence scoring.

## When to Use
- When completing a massive architectural milestone.
- When the system feels unstable or semantic drift is suspected.
- Before locking in a highly experimental paradigm.
- Manually via `/heady-checkpoint`.

## The 5-Phase Checkpoint Pipeline

### Phase 1: System Breakdown & Categorization
*Goal: Isolate and map every moving piece.*
- Trigger `/heady-deep-scan` to map the current architecture.
- Categorize all discovered components into their respective domains (e.g., Auth, Memory, Execution, UI, Routing).
- Identify delta (what has changed since the last checkpoint).

### Phase 2: Multi-Lens HUE Validation
*Goal: Prove that the system understands what it built.*
- Run the **Heady Understanding Engine (HUE)** against all categorized components.
- For each component, calculate the 10 Lenses (Mechanism, Causality, Teleology, Relations, Effect, Blast Radius, Normativity, Agency, Confidence, and Execution & Evolution).
- Log any unknowns, hallucination risks, or semantic drift detected during the lens analysis.

### Phase 3: CSL Confidence Scoring
*Goal: Generate a mathematical metric of system coherence.*
- Aggregate the HUE scores using the CSL Engine.
- Output a **Global Architecture Confidence Score** (ranging from 0.0 to 1.0).
- Establish the gating threshold based on the Golden Ratio ($\tau = 0.618$).

### Phase 4: The Comprehensive Snapshot
*Goal: Generate the ultimate state report.*
- Produce the `Checkpoint Validation Snapshot`. This report includes:
  - The categorized component map.
  - The summarized HUE 10-Lens findings.
  - The final Confidence Score.
  - Recommended optimizations or refactoring targets.
- Log this snapshot into the persistent `Heady Memory Ledger`.

### Phase 5: Autonomous Routing (The Decision)
*Goal: Act on the confidence score.*
Based on the Global Confidence Score calculated in Phase 3, the system autonomously triggers the next meta-workflow:

- **🟢 High Confidence (Score ≥ 0.85):**
  - **Action:** Automatically trigger `/heady-omni-sync`.
  - **Reasoning:** The system deeply understands its state and has high confidence. It is safe to run global tests, extract tasks, and auto-commit to the persistent record.

- **🟡 Marginal Confidence (0.618 ≤ Score < 0.85):**
  - **Action:** Pause and request Human Verification.
  - **Reasoning:** The system understands its state, but identifies potential blast radius risks or unresolved trade-offs in Lens 7 (Normativity).

- **🔴 Low Confidence (Score < 0.618):**
  - **Action:** Automatically trigger `/heady-battle-sim`.
  - **Reasoning:** The system lacks understanding or has detected structural flaws. It immediately spins up a 9-stage battle simulation to test alternative approaches, routing algorithms, or component structures against external baselines.

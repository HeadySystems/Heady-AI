---
name: heady-adr-postmortem
description: "Generates an exhaustive Post-Build Diagnostic Report after an ADR is approved and built, or when requested by /heady-autopilot. Breaks down execution reality vs intent, system parameters, strategic defensibility, alternatives, and usage. Use whenever a major architecture change is finalized or the user requests a post-build report."
metadata:
  author: Eric Haywood
  version: '1.0'
  organization: HeadySystems Inc.
---

> **OPTIMAL BUILD NOTICE:** This file targets the Heady-AI Latent OS.
> - **Package Manager:** `pnpm` + `Turborepo`  · **Rule File:** Follow `AGENTS.md`
> - **Sync:** `scripts/heady-sync.sh`  · **Log:** HeadyLens (`@heady/headylens`)

# Heady™ ADR Postmortem & Diagnostic Report

This skill is invoked immediately after an Architectural Decision Record (ADR) is built and approved, or when `/heady-autopilot` completes a major autonomous cycle. Its purpose is to permanently record the gap between intent and reality, justify the technical decisions, and provide a clear usage manual for the human operator.

When generating the **Post-Build Diagnostic Report**, you MUST use the following exact structure and answer all prompts thoroughly. Output the report as a markdown Artifact (`post_build_report_<adr_number>.md`).

## Report Structure

### 1. Execution Reality vs. Intent
- **What was supposed to happen:** What was the original goal and scope of the ADR or command?
- **What actually happened:** What was literally built? Did the scope expand? Were there unexpected roadblocks?
- **What is currently happening:** How is the system behaving right now with this code live?

### 2. Component and Parameter Breakdown
- List every file touched, created, or deprecated.
- List every system parameter involved (e.g., specific `φ` scaling factors used, NATS topics, cache TTLs, port numbers). Explain *why* that specific parameter value was chosen.

### 3. Defensibility (The "Best Move" Argument)
- Why is this arguably the best move for the Heady ecosystem?
- How does this align with the core philosophy (e.g., RAM-first, Latent Projection, CSL gating)?
- What is the strategic or technical payoff?

### 4. Alternatives Analysis
- What were the other options on the table?
- Are they close in viability? Why or why not?
- Explicitly justify why the chosen path beat the alternatives (e.g., latency, complexity, determinism).

### 5. System Mechanics
- **How it happened:** A brief trace of the agent execution or build process.
- **How it functions:** A technical teardown of the data flow (e.g., "Data enters the ingest node, is multiplied by `φ`, and published to Redis").
- **How do you use it:** Exact instructions, commands, or UI locations for the human to interact with the new system.

### 6. Recommendations & Optimizations
- What is the immediate next step to improve this?
- Are there technical debts incurred that need to be paid?
- What are the hypothetical edge cases we should monitor?

### 7. Understanding System Ingestion
- Extract key concepts from this build and identify where they should be permanently injected (e.g., adding a new definition to `facts.yaml` or a new summary to the Knowledge Items).

---
**Execution Note:** Do not skip sections. If a section is not applicable, state why. This report is a permanent architectural receipt.

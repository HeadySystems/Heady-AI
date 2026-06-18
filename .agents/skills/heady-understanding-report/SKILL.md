---
name: heady-understanding-report
description: Generates a custom 10-Lens Understanding Report for any subject based on the Heady Understanding Engine (HUE).
---
# Heady Understanding Report

**Purpose:** Generates a complete 10-Lens Understanding Artifact (UA) and readable markdown report for any subject (component, decision, external system, error, or PR) using the Heady Understanding Engine (HUE).

## When to use
Invoke this skill whenever the user says "make a report on [X]", "understand [X]", or "run an understanding report on [X]".

## Execution Protocol

1. **Observe**: Scan the workspace, codebase, or use research tools (like Perplexity) to gather ground truth about the `[Subject]`.
2. **Inquire**: Methodically answer the 10 Lenses of the `HEADY_UNDERSTANDING_ENGINE.md` schema:
   - **L1 Mechanism**: How does it work? Inputs → Process → Outputs.
   - **L2 Causality**: How/why is it possible? Causal chain.
   - **L3 Teleology**: Why does it exist? What breaks without it?
   - **L4 Relations**: How is it involved? Upstream/downstream edges.
   - **L5 Effect**: Internal vs external effect?
   - **L6 Blast Radius**: What is its significance/reach? What does a failure touch?
   - **L7 Normativity**: Is it good/bad? Trade-offs and failure modes.
   - **L8 Agency**: Is it intelligent/adaptive? Reactive vs adaptive vs reflective.
   - **L9 Confidence**: How do we know? CSL confidence level.
   - **L10 Execution & Evolution**: What happened vs intent? System parameters? Best move argument? Alternatives?
3. **Synthesize**: Create a Markdown artifact named `understanding_report_[subject].md`.
   - Include an **Executive Summary**.
   - Include a readable section breaking down the **10 Lenses**.
   - Include a `jsonc` code block containing the formal `Understanding Artifact (UA)` JSON format (including the `evolution` block).

## Output Format
Always format the final output as a saved Markdown artifact. When presenting it to the user, highlight the findings from **Lens 10** (the parameters, alternatives, and intent vs reality) as these represent the system's strategic evolution.

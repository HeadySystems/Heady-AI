> **OPTIMAL BUILD NOTICE:** This file targets the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** `pnpm` + `Turborepo`  · **Rule File:** Follow `AGENTS.md`
> - **Engine:** `src/hc_activity_tree.js`
> - **Output:** `docs/activity/ECOSYSTEM-TREE-<timestamp>.md`

# Heady Ecosystem Activity Tree

Generate a fully verified, comprehensive, tree-style breakdown of recent activity, reasoning, and file access across the Heady ecosystem. This orchestrates telemetry and audit data across 13 core subsystems.

## Subsystems Audited
1. AutoPilot & AutoFlow
2. DeepScan & Handoff
3. Prompt Pipeline & Agent Factory
4. Connector Vault, Forge, & Health
5. Battle Arena
6. Memory Ops & Intelligence Analytics
7. Projection Composer

## How to Run

Execute the activity tree generator locally:

```bash
# Output full ecosystem trace to docs/activity/
node src/hc_activity_tree.js

# Preview without writing to file
node src/hc_activity_tree.js --dry-run
```

## How to Use the Output

The output artifact will be written to `docs/activity/ECOSYSTEM-TREE-<ts>.md`. It uses collapsible `<details>` blocks to present the dense telemetry in a structured tree.
Agents and users should use this file to understand the system-wide ripples of recent actions across Vector Memory, Connector endpoints, and CI/CD operations.

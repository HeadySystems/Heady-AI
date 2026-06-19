---
name: heady-omni-sync
description: "Apex orchestration meta-workflow — continuously scans for context changes, processes them through CSL cognitive intelligence, applies modifications, auto-extracts tasks, enforces standards, and globally syncs the repository. The infinite heartbeat of the Heady ecosystem. Use for nightly/weekly integrity sync, post-refactor reconciliation, or autopilot-driven whole-state advancement."
---

# Heady Omni-Sync Workflow

// turbo-all

The **Heady Omni-Sync** is the apex orchestration meta-workflow. It unites over 60 discrete Heady OS system components to continuously scan for context changes, process them through CSL cognitive intelligence, apply required modifications, auto-extract tasks, enforce standards, and globally sync the repository.

This workflow is the "infinite heartbeat" of the Heady AI ecosystem.

## When to Run
- Nightly or weekly as a comprehensive system integrity sync
- After massive refactors, domain migrations, or broad IP integration
- When triggering the "Autopilot" to autonomously advance the entire state of the project
- Manually via `/heady-omni-sync`

## Hook & System Integration

`/heady-omni-sync` is fully compatible as an automated hook workflow and background system service. It should be strategically mounted across the Heady ecosystem to guarantee global consistency:

### 1. The `dropzone` Extraction Event (Data Ingestion)
Anytime a large payload is dumped into the `./Heady-AI/dropzone`, a file watcher triggers `/heady-omni-sync`. This guarantees that massive bursts of unstructured context are immediately deeply scanned, ingested into vector memory, analyzed for tasks, and integrated into the global architecture before human intervention.

### 2. Cross-Device Handoff Mesh (`/heady-cross-device-handoff`)
When switching devices (e.g., Desktop IDE to Android), `/heady-omni-sync` is triggered upon the device-switch event. This ensures the receiving device has the most hyper-accurate, fully synchronized latent context available.

### 3. Autonomous Heartbeat (Background Daemon)
Run a lightweight version of the omni-sync on a cron or systemd timer (e.g., every 4 hours). This acts as an autonomous "housekeeper"—continually monitoring for semantic drift, extracting unresolved tasks, and maintaining vector space hygiene.

### 4. Agent-to-Agent Handoffs (`/heady-a2a-protocol`)
In a swarm architecture, when a specialized agent finishes its discrete task, it calls `/heady-omni-sync` before passing the baton to the next agent. This "seals" the work into global memory, ensuring the next agent acts upon the most up-to-date universal truth.

### 5. Standard Hooks
- **Agent Post-Action Hook:** Trigger automatically at the end of major AI action sequences.
- **Git Pre-Commit Hook:** Run a lightweight scan prior to commits to block semantic drift.
- **CI/CD Action Hook:** Trigger on push to the `rebuild` branch to run the full scan before deployment.

## The 8-Stage Execution Pipeline

### Stage 1: Context Acquisition & System Scan (The Eyes)
*Goal: Detect state changes, map the repo, and identify semantic drift.*

1. **Initialize Scan:** 
   Run `/heady-deep-scan` to map the workspace into 3D vector memory.
2. **Update Indices:** 
   Execute `/heady-merkle-index` to hash the codebase.
3. **Clean Projections:** 
   Execute `/projection-hygiene` to purge orphan files or dead artifacts.
4. **Track Actions:** 
   Review `/heady-continuous-action` and `/heady-intent-tracker` for recent agent/developer behavior.
5. **Ingest Knowledge:** 
   Run `/heady-knowledge-ingestion` and `/heady-knowledge-ingestion-briefing`, updated by `/heady-knowledge-cartographer`.
6. **Audit Health:** 
   Perform forensics via `/heady-forensic-analyst`, `/heady-security-audit`, and `/heady-digital-presence`.

### Stage 2: Cognitive Processing & Intelligence (The Brain)
*Goal: Route context into vector space and apply Continuous Semantic Logic (CSL).*

1. **System Context:** 
   Load the overarching directive with `/mcp:heady-mcp:heady-system-prompt`.
2. **Memory Ledger:** 
   Validate temporal index with `/heady-memory-ledger-design` and `/heady-companion-memory`.
3. **Vector Ops:** 
   Engage `/heady-memory-ops` and `/heady-memory-knowledge-os` to retrieve truth.
4. **Compute:** 
   Pass state through `/heady-vsa-hyperdimensional-computing` using `/heady-phi-math-foundation`.
5. **Routing & Analytics:** 
   Use `/heady-embedding-router`, `/heady-cognitive-runtime`, and `/heady-intelligence-analytics`.
6. **Cost & Strategy:** 
   Consult `/heady-research`, `/heady-narrative-engine`, and `/heady-cost-guardian` to optimize token usage.

### Stage 3: Task Extraction & Decomposition (The Nervous System)
*Goal: Convert insights and gap analyses into structured execution plans.*

1. **Extract Tasks:** 
   Execute `/auto-extract-tasks` on all new insights and reports to ensure no findings are lost.
2. **Decompose:** 
   Break down massive tasks with `/heady-task-decomposition`.
3. **Teaming:** 
   Use `/heady-liquid-crew` and `/heady-delegation-architect` to assign roles to sub-agents.
4. **Orchestrate:** 
   Initialize `/heady-auto-flow`, `/heady-liquid-graph`, and `/heady-cloud-orchestrator`.
5. **Communication:** 
   Setup protocols using `/heady-a2a-protocol` and `/heady-prompt-pipeline`.

### Stage 4: Implementation & Execution (The Hands)
*Goal: Generate code, adapt designs, and execute autonomously.*

1. **Generation:** 
   Run `/heady-code-generation` and `/heady-visual-builder` for frontend updates.
2. **Design Mapping:** 
   Use `/heady-design-bridge` and `/heady-manager-surface-design`.
3. **Dual Pass Execution:** 
   Engage `/heady-dual-pass` for architect/editor separation using `/heady-multi-model` fallback routing.
4. **Autopilot Drive:** 
   Trigger `/heady-autopilot` for fully autonomous resolution of the extracted tasks.
5. **Durable State:** 
   Ensure `/heady-durable-execution`, `/heady-durable-agent-state`, and `/heady-replan` if blockers occur.
6. **Bootstrap:** 
   Deploy new modules with `/heady-service-bootstrap` and `/heady-connector-forge`.

### Stage 5: Governance & Armor (The Immune System)
*Goal: Ensure code matches sacred geometry standards, security limits, and PQC.*

1. **Standards Enforcement:** 
   Run `/heady-coding-standards`, `/heady-ai-checks`, and `/heady-linter-gate`.
2. **Governance Flow:** 
   Ensure changes pass `/heady-ide-governed-codeflow`.
3. **Security Constraints:** 
   Apply `/heady-middleware-armor` and `/heady-pqc-security`.
4. **Trust & Identity:** 
   Generate `/heady-trust-receipts` and verify `/heady-sovereign-identity-byok`.
5. **Gateways:** 
   Configure `/heady-liquid-gateway`, `/heady-hooks`, and `/heady-mcp-streaming-interface`.

### Stage 6: Pipeline & Deployment (The Bloodstream)
*Goal: Package, sync, and deploy the validated changes.*

1. **SOP Generation:** 
   Output formatted documentation via `/heady-sop-pipeline`.
2. **Vector Serve:** 
   Ready data for edge caching using `/heady-vector-projection`.
3. **Release Ops:** 
   Package the system using `/heady-installable-package-release-ops`.
4. **Deploy:** 
   Roll out to Cloud Run / Workers with `/heady-deployment`.

### Stage 7: System Verification & Testing (The Sandbox)
*Goal: Guarantee system stability and run test suites before finalizing global sync.*

1. **Test Execution:**
   Execute full suite via `pnpm turbo run test` and capture results.
2. **Health Probe:**
   Trigger `/heady-health-watch-swarm` and `/health-check` to verify cross-domain stability.
3. **Deployment Validation:**
   Run `/deployment-verification` if Cloud Run/Worker updates were pushed.
4. **Halt on Failure:**
   If tests or health checks fail, halt Omni-Sync, log failure, and initiate `/incident-response`.

### Stage 8: Global Sync & Auto-Commit (The Memory)
*Goal: Push context changes globally, merging vector space and git history.*

1. **Git Operations:** 
   Automate commit formatting and branch updates using `/heady-git-ops`.
2. **System Synchronization:** 
   Execute `/heady-sync` to push all unified state changes across multi-remote branches (headyai, hc-main, production, hs-main).

---

> [!CAUTION]
> This workflow initiates a cascading autonomous process that has the potential to modify massive swaths of the codebase. Ensure that `/heady-ide-governed-codeflow` is active if human review is required before Stage 8 executes the final auto-commit.

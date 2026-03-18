# Bee Taxonomy: Four-Class Responsibility Matrix

> Formal classification of the 94 bee types into four governance classes to prevent
> responsibility overlap and enable clear operational governance.

---

## Summary Table

| Class | Bee Count | Governance Rule | CSL Threshold | Self-Modifiable | Example Bees |
|---|---|---|---|---|---|
| **System** | 13 | Always-on; monitored by Observer agent | N/A (exempt) | No | orchestration-bee, resilience-bee, governance-bee |
| **Build** | 10 | CI gate required before execution | >= 0.500 | No | template-bee, deployment-bee, bee-factory |
| **Intelligence** | 17 | CSL confidence gate >= 0.618 | >= 0.618 (BOOST) | Yes (audited) | memory-bee, brain-bee, graph-rag-bee |
| **Domain** | 10 | Approval gate for external actions; HITL for financial ops | >= 0.750 | No | patent-bee, trading-bee, compliance-auditor-bee |

---

## 1. System Class

**Purpose:** Core infrastructure bees that keep the swarm alive and observable.

**Governance:** Always-on; cannot be self-modified; monitored by Observer agent.

### Members (13)

| # | Bee | Responsibility |
|---|-----|----------------|
| 1 | orchestration-bee | Top-level task routing and execution sequencing |
| 2 | lifecycle-bee | Bee start / stop / restart lifecycle management |
| 3 | resilience-bee | Circuit-breaking, retry policies, graceful degradation |
| 4 | telemetry-bee | Metrics collection, trace propagation, log aggregation |
| 5 | governance-bee | Policy enforcement and rule evaluation |
| 6 | security-bee | Auth, encryption, secret rotation |
| 7 | health-bee | Liveness and readiness probes across all bees |
| 8 | config-bee | Centralised configuration distribution |
| 9 | swarm-coordinator | Cross-bee coordination and consensus |
| 10 | swarm-intelligence | Emergent behaviour aggregation and swarm-level decisions |
| 11 | agent-mesh | Inter-agent communication fabric |
| 12 | auto-success-bee | Automated success-criteria validation |
| 13 | middleware-bee | Shared middleware pipeline (auth, logging, rate-limit) |

### Rules

- **Availability:** Must be running at all times; no voluntary shutdown permitted.
- **Immutability:** Cannot modify their own code or configuration at runtime.
- **Monitoring:** Observer agent receives heartbeat every 5 s; alert fires after 2 missed beats.
- **CSL Threshold:** Exempt -- System bees operate outside the CSL confidence gate.

---

## 2. Build Class

**Purpose:** Bees that create, modify, test, or deploy artifacts.

**Governance:** Require CI gate before execution; output validated by Builder agent.

### Members (10)

| # | Bee | Responsibility |
|---|-----|----------------|
| 1 | template-bee | Scaffold generation from canonical templates |
| 2 | refactor-bee | Automated code refactoring with AST transforms |
| 3 | documentation-bee | Doc generation, sync, and freshness checks |
| 4 | deployment-bee | Release orchestration and rollback |
| 5 | cloud-run-deployer-bee | GCP Cloud Run-specific deployment automation |
| 6 | bee-factory | Bee creation and registration (v1) |
| 7 | bee-factory-v2 | Bee creation and registration (v2, template-driven) |
| 8 | landing-page-builder-bee | Marketing page generation and publish |
| 9 | tester-bee-bee | Test suite generation and execution |
| 10 | device-provisioner-bee | Edge device provisioning and firmware push |

### Rules

- **CI Gate:** Every execution must pass the CI pipeline (lint, test, security scan) before artifacts are written.
- **Validation:** Builder agent reviews all outputs; rejects anything that breaks the build contract.
- **CSL Threshold:** >= 0.500 required to initiate a build action.
- **Self-Modification:** Not permitted.

---

## 3. Intelligence Class

**Purpose:** Bees responsible for memory, reasoning, analysis, and knowledge synthesis.

**Governance:** Subject to CSL confidence gate >= 0.618 (BOOST threshold); memory writes audited.

### Members (17)

| # | Bee | Responsibility |
|---|-----|----------------|
| 1 | memory-bee | Long-term memory storage and retrieval |
| 2 | context-weaver-bee | Context assembly across sessions and agents |
| 3 | vector-ops-bee | Vector embedding CRUD and similarity search |
| 4 | providers-bee | LLM provider routing and fallback |
| 5 | embedder-bee-bee | Text-to-embedding pipeline |
| 6 | brain-bee | Central reasoning and inference coordinator |
| 7 | intelligence-bee | Meta-cognitive analysis and strategy selection |
| 8 | graph-rag-bee | Graph-based retrieval-augmented generation |
| 9 | distiller-bee | Knowledge compression and summarisation |
| 10 | wisdom-curator-bee | Curated insight indexing and ranking |
| 11 | judge-bee | Output quality scoring and arbitration |
| 12 | creative-bee | Divergent ideation and creative generation |
| 13 | input-task-extractor-bee | Natural-language task parsing and structuring |
| 14 | mistake-analyzer-bee | Post-mortem error pattern detection |
| 15 | evolution-bee | Self-improvement proposal generation |
| 16 | drift-monitor-bee | Model and data drift detection |
| 17 | anomaly-detector-bee | Statistical anomaly identification across telemetry |

### Rules

- **CSL Confidence Gate:** Action is blocked unless the Cascading Scaling Logic score is >= 0.618 (the BOOST threshold).
- **Memory Audit:** Every write to long-term memory is logged with author, timestamp, and prior value for rollback.
- **Self-Modification:** Permitted under audit; evolution-bee proposals require judge-bee approval before merge.
- **Monitoring:** Brain agent reviews aggregated confidence distributions daily.

---

## 4. Domain Class

**Purpose:** Bees that interact with external systems, financial instruments, or regulated data.

**Governance:** Require approval gate for external actions; financial ops require Human-In-The-Loop (HITL).

### Members (10)

| # | Bee | Responsibility |
|---|-----|----------------|
| 1 | patent-bee | Patent drafting, filing preparation, prior-art search |
| 2 | valuation-analyzer-bee | Asset and company valuation modelling |
| 3 | trading-bee | Trade signal generation and order routing |
| 4 | trading-bee-csl | CSL-governed variant of trading-bee |
| 5 | compliance-auditor-bee | Regulatory compliance checking |
| 6 | credential-bee | External credential lifecycle management |
| 7 | auth-flow-bee | OAuth / OIDC flow orchestration |
| 8 | auth-provider-bee | Identity provider integration |
| 9 | colab-gpu-runtime-bee | Google Colab GPU session management |
| 10 | gcloud-auth-automator-bee | GCP service-account key rotation and auth |

### Rules

- **Approval Gate:** Any action that leaves the system boundary (API call, file export, network request) requires explicit approval.
- **HITL for Financial Ops:** trading-bee, trading-bee-csl, and valuation-analyzer-bee actions must be confirmed by a human operator before execution.
- **CSL Threshold:** >= 0.750 required for any external action.
- **Self-Modification:** Not permitted.

---

## Agent Oversight Map

Each class is overseen by a named agent that bears final accountability for the bees in its scope.

| Class | Oversight Agent | Responsibilities |
|---|---|---|
| **System** | **Observer** | Heartbeat monitoring, anomaly escalation, immutability enforcement |
| **Build** | **Builder (DevOps)** | CI gate management, artifact validation, deployment sign-off |
| **Intelligence** | **Brain (Researcher)** | CSL threshold enforcement, memory audit review, evolution approval |
| **Domain** | **Compliance (Legal / Finance)** | Approval gate administration, HITL workflow, regulatory reporting |

### Escalation Path

```
Domain bee blocked --> Compliance agent reviews --> HITL approval --> Execute
Intelligence bee below BOOST --> Brain agent reviews --> Raise / Deny threshold
Build bee CI failure --> Builder agent triages --> Fix or reject
System bee heartbeat miss --> Observer agent alerts --> Auto-restart or page on-call
```

---

## Remaining Bees (44 unclassified)

The 50 bees listed above (13 + 10 + 17 + 10) account for the core governed population. The remaining 44 of the 94 total bee types are utility, experimental, or composite bees that inherit the class of their primary dependency. A full enumeration and classification pass for these bees is tracked as a follow-up action item.

---

*Document version: 1.0.0 | Created: 2026-03-18 | Authority: Governance Bee + Observer Agent*

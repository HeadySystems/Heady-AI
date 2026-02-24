# Heady System Architecture Blueprints (CPO & Engineering Addendum)

> **Context:** This document synthesizes the high-level functional architecture laid out in the `03_ARCHITECTURE_PRIMER.md` with the concrete database schemas, API contracts, and pipeline definitions required for the next phase of Heady's evolution. It serves as the blueprint for moving from the current Node.js/in-memory state towards a hardened, PostgreSQL-backed control plane.

*Note: The current `heady-registry.json` is recognized as stale; these blueprints define the target state for the registry's backend implementation.*

---

## 🏗️ 1. Control Plane & Orchestration (SPEC-1)

### 1.1 Core Entities (PostgreSQL Schema)

The transition to a durable control plane requires moving the registry from a flat JSON file to a relational store to support concurrent updates, audit logging, and drift detection.

```sql
-- Core Registry
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  health_path TEXT NOT NULL DEFAULT '/api/health',
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_healthy_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL DEFAULT 'node',
  triggers TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline & Execution
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL DEFAULT 'hcfullpipeline',
  max_concurrent_tasks INT NOT NULL DEFAULT 6,
  governance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  request_id TEXT,
  seed BIGINT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE pipeline_stage_runs (
  id UUID PRIMARY KEY,
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_num INT NOT NULL,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT
);
CREATE INDEX ON pipeline_stage_runs(pipeline_run_id, stage_num);
```

### 1.2 The 9-Stage Pipeline (HCFullPipeline)

The target state for `HCFullPipeline` defines explicit boundaries for recovery and self-critique.

1. **Stage 0:** Channel Entry
2. **Stage 1:** Ingest
3. **Stage 2:** Plan (Monte Carlo Readiness & Simulation)
4. **Stage 3:** Execute (Bounded parallelism, maxConcurrentTasks=6)
5. **Stage 4:** Recover (Compensation hooks + circuit breakers)
6. **Stage 5:** Self-Critique
7. **Stage 6:** Optimize
8. **Stage 7:** Finalize
9. **Stage 8:** Monitor & Feedback

**Core APIs to Implement:**

* `GET /api/monte-carlo/status`
* `POST /api/monte-carlo/run`
* `GET /api/monte-carlo/history`

---

## 🛡️ 2. DevSecOps & Supply Chain Hardening (SPEC-2)

Immediate remediation is required for historical secret leakage. This defines the target CI/CD posture.

### 2.1 The "Fail-Closed" Deploy Gate

Deploys must automatically halt if any of the following checks fail in the CI pipeline (e.g., GitHub Actions):

1. **Secret Scan:** Diff contains potential credentials (runs `gitleaks` or `detect-secrets`).
2. **Dependency Audit:** Critical vulnerabilities found in `npm audit` or equivalent.
3. **SAST:** CodeQL detects high-severity code vulnerabilities.
4. **Smoke Test:** Target environment `/health` endpoints fail post-deploy.

### 2.2 Target Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL, -- DEPLOY, ROLLBACK, SECRETS_ACCESS, CONFIG_CHANGE
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 🧠 3. Knowledge Vault & Memory Plane (SPEC-3)

To move beyond reactive, prompt-based memory, Heady requires a structured Knowledge Vault integrating Notion sync, embedding storage, and memory receipts.

### 3.1 Vault Schema (PostgreSQL + Vector)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL, -- NOTION | REPO | PIPELINE | REGISTRY
  source_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, source_id)
);

CREATE TABLE embeddings (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- LOCAL | CLOUD
  model TEXT NOT NULL,
  dims INT NOT NULL,
  vector JSONB NOT NULL, -- Target: pgvector
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memory_receipts (
  id UUID PRIMARY KEY,
  operation TEXT NOT NULL, -- INGEST | EMBED | STORE | DROP
  source TEXT NOT NULL,
  source_id TEXT,
  document_id UUID,
  stored BOOLEAN NOT NULL,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Core APIs to Implement:**

* `POST /api/knowledge/sync/notion` (Incremental cursors)
* `GET /api/knowledge/search?q=` (Hybrid lexical + vector search)
* `GET /api/knowledge/receipts`

---

## 🔌 4. MCP Gateway & Tool Governance (SPEC-4)

MCP connectors must be governed. Not all tools should be available in all environments to all nodes.

### 4.1 Governance Schema

```sql
CREATE TABLE mcp_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mapped_endpoint TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE tool_policies (
  id UUID PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES mcp_tools(id),
  environment TEXT NOT NULL, -- dev | staging | prod
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_per_min INT,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

---

## 📱 5. Buddy Universal & Device Sync (SPEC-6)

To achieve the "cross-device continuity" vision, HeadyBuddy requires a secure device registry and consent-aware tracking mechanism.

### 5.1 Device & Sync Schema

```sql
CREATE TABLE consents (
  id UUID PRIMARY KEY,
  user_id TEXT,
  scope TEXT NOT NULL, -- TRACKING | DEVICE_SYNC | VOICE
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE devices (
  id UUID PRIMARY KEY,
  user_id TEXT,
  device_public_key TEXT NOT NULL,
  device_name TEXT,
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE device_sync_blobs (
  id UUID PRIMARY KEY,
  user_id TEXT,
  device_id UUID REFERENCES devices(id),
  cipher_text TEXT NOT NULL, -- E2E Encrypted payload
  key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Core APIs to Implement:**

* `POST /api/tracking` (Requires valid consent scope)
* `POST /api/device-sync` (Requires E2E encryption)
* `GET /api/privacy/export`
* `POST /api/privacy/delete`

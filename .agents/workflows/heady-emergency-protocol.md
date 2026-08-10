---
description: Immediate diagnostic and recovery steps for full system breakage
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.
> ⚠ Project/URL references (`heady-main-project`, `*.headysystems.com` service endpoints) predate the canonical GCP lock (ADR-0036) — verify against current deploy state before running.

# Emergency Protocol — Execute Immediate

// turbo-all

When major systemic components are down, run these standard heuristics and recovery tests instantly. Do not ask for permission — just perform these scans and summarize the diagnostic output to the user.

## Phase 1: Diagnostics

### 1.1 Resolve URL Violations

Strip broken environment paths and localhost references:

```bash
node lib/heady-url-resolver.js --fix .
```

### 1.2 Ping AI Nodes Health Status

Verify whether the 20 AI Nodes cluster is responding:

```bash
curl -s https://api.headysystems.com/health | jq '.nodes'
```

### 1.3 Check Cloud Run Services

List all active Cloud Run revisions:

```bash
gcloud run services list --region us-east1 --project heady-main-project --format="table(SERVICE,REVISION,ACTIVE,URL)"
```

### 1.4 Verify App Content Connections

Test connectivity to the content spine:

```bash
curl -s -o /dev/null -w "%{http_code}" https://headysystems.com
curl -s -o /dev/null -w "%{http_code}" https://api.headysystems.com/health
curl -s -o /dev/null -w "%{http_code}" https://brain.headysystems.com/health
```

### 1.5 Examine Memory Insertion Layers

Mock write to test memory pipelines:

```bash
curl -X POST https://api.headysystems.com/api/memory/test
```

### 1.6 Examine Database Availability

Confirm vector and data storage connectivity:

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM heady_memories;"
```

### 1.7 Git Repository Health

Check for stuck rebases or dirty state:

```bash
cd ~/Heady-AI && git status
git rebase --abort 2>/dev/null || true
```

## Phase 2: Rollback (if diagnostics show failures)

### 2.1 Cloud Run Revision Rollback

```bash
# List recent revisions for the failed service
gcloud run revisions list --service SERVICE_NAME --region us-east1 --project heady-main-project --limit 5

# Route 100% traffic to the previous working revision
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region us-east1 \
  --project heady-main-project
```

### 2.2 Cloudflare Worker Rollback

```bash
npx wrangler rollback --name WORKER_NAME
```

### 2.3 Git Rollback (emergency only)

```bash
# Revert last commit while preserving changes
git revert HEAD --no-edit
git push origin main
```

## Phase 3: Structured Health Report

After all diagnostics, generate a health report in this format:

```json
{
  "timestamp": "2026-03-22T14:00:00Z",
  "status": "DEGRADED | HEALTHY | DOWN",
  "services": {
    "api": { "status": "UP|DOWN", "http_code": 200, "latency_ms": 150 },
    "brain": { "status": "UP|DOWN", "http_code": 200, "latency_ms": 200 },
    "admin": { "status": "UP|DOWN", "http_code": 200, "latency_ms": 100 }
  },
  "database": { "status": "UP|DOWN", "memory_count": 1500 },
  "nodes": { "responding": 20, "total": 20 },
  "actions_taken": ["rollback api to revision X", "cleared stuck rebase"],
  "requires_attention": ["heady-ai.com returning 522"]
}
```

## Escalation Matrix

| Severity | Criteria | Action |
|----------|---------|--------|
| P0 — Total Outage | All services down, database unreachable | Auto-rollback, then immediately notify founder |
| P1 — Partial Outage | 1-2 services down, database accessible | Auto-rollback affected services, continue diagnostics |
| P2 — Degraded | Services slow but responding, errors in logs | Log the issue, attempt auto-heal, report to user |
| P3 — Warning | Non-critical failures (e.g., stale cache, expired cert) | Fix autonomously, document in next commit message |

## Rules

- **Never ask permission** — run diagnostics and fixes immediately
- **Always generate the structured health report** — no vague summaries
- **Rollback before debugging** — restore service first, investigate after
- **Reference**: See `/heady-site-deploy` for deployment and `/heady-secret-rotation` for key issues

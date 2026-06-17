# Heady Legacy Advisor API — Specification (PPA-36)

**Service:** `heady-production` (HeadyAI/heady-production · Cloud Run)  
**Base path:** `/api/advisor`  
**Auth:** Firebase ID token (Bearer) — same Firebase project as portal  
**Purpose:** Read-only surface exposing battle-tested legacy knowledge to the rebuild portal's `#legacy` pane.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/advisor/health` | Service uptime, last auto-commit timestamp, active service count |
| GET | `/api/advisor/swarm-status` | Live swarm data — active/total swarms, bees running/idle |
| GET | `/api/advisor/baseline` | Metric comparison array (legacy vs rebuild, 9 key metrics) |
| GET | `/api/advisor/patterns/:domain` | Working patterns for `auth\|routing\|vector\|csl\|swarm\|pipeline` |
| GET | `/api/advisor/config/:service` | Config advisor for named service (wires to heady-config-oracle) |
| GET | `/api/advisor/stream` | SSE live log stream (Pino structured JSON, PHI*1000ms heartbeat) |

## Implementation

Full implementation: `src/routes/advisor-routes.js` in HeadyAI/heady-production.  
Reference implementation committed alongside this spec in the rebuild repo at  
`src/routes/advisor-routes.js` (for PR review context).

## CORS

Allowed origins: `https://headyme.com`, `https://headyme.firebaseapp.com`, `https://headyme.web.app`  
Set `PORTAL_ORIGIN_EXTRA` env var (comma-separated) for additional origins in dev.

## Env vars required on heady-production

```
ADVISOR_AUTH_DISABLED=false   # set true for local dev only
LAST_AUTOCOMMIT_TS=           # injected by HCFP-AUTO on each auto-commit
ACTIVE_SERVICE_COUNT=21       # update as services come online
BEES_RUNNING=0                # injected by swarm coordinator health-bee
PORTAL_ORIGIN_EXTRA=          # optional extra CORS origins
```

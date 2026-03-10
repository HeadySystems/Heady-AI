# Service Recovery Runbook

## Document Information
- **Author**: Eric Haywood, HeadySystems Inc.
- **Version**: 4.0.0
- **Last Updated**: 2026-03-01

## Purpose
This runbook provides step-by-step procedures for recovering Heady platform services from various failure scenarios. It covers single-service failures, multi-service cascade failures, database connection issues, and complete platform restart procedures.

## Severity Classification
All alert thresholds derive from phi-math principles:
- **P1 (Critical)**: Service completely unavailable, users impacted. Response within 5 minutes.
- **P2 (High)**: Service degraded, partial functionality lost. Response within 13 minutes.
- **P3 (Warning)**: Performance degradation detected. Response within 34 minutes.
- **P4 (Info)**: Anomaly detected, no user impact. Response within 89 minutes.

## Single Service Recovery

### Step 1: Identify the Failed Service
Check the Prometheus alerting dashboard for fired alerts. Each Heady service exposes health endpoints at `/healthz` (liveness) and `/readyz` (readiness). The HeadyHealth aggregator service (port 3328) provides a consolidated view of all 60+ service health states.

```bash
# Check individual service health
curl -s http://<service>:<port>/healthz | jq .

# Check aggregated health
curl -s http://heady-health:3328/health/all | jq '.services[] | select(.status != "healthy")'
```

### Step 2: Check Circuit Breaker State
If the service is reported as unhealthy by its dependents but responds to direct health checks, the circuit breaker may have tripped. Circuit breakers open after fib(5) = 5 consecutive failures.

```bash
# Check circuit breaker metrics
curl -s http://<dependent-service>:<port>/metrics | grep circuit_breaker
```

If the circuit breaker is OPEN, the service may have recovered but the breaker has not yet entered HALF_OPEN state. Wait for the phi-backoff period to elapse, or manually trigger a probe by sending a single request through the circuit breaker's test endpoint.

### Step 3: Review Structured Logs
All Heady services emit structured JSON logs. Review recent log entries for error patterns:

```bash
# View recent logs (Docker)
docker logs <container-name> --tail 100 | jq 'select(.level == "error")'

# View recent logs (Cloud Run)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=<service>" --limit 100 --format json
```

Common error patterns and their resolutions:
- **ECONNREFUSED**: Upstream dependency is down. Check the upstream service first.
- **ENOMEM**: Memory exhaustion. Check for memory leaks, increase memory allocation.
- **ETIMEDOUT**: Network timeout. Check network connectivity, DNS resolution, and upstream latency.
- **ERR_CIRCUIT_OPEN**: Circuit breaker tripped. Follow Step 2.

### Step 4: Restart the Service
If logs indicate a transient failure, restart the service:

```bash
# Docker restart
docker restart <container-name>

# Cloud Run force new revision
gcloud run services update <service-name> --region us-east1 --update-env-vars "RESTART_TRIGGER=$(date +%s)"
```

### Step 5: Verify Recovery
After restart, verify health across all three probes:

```bash
# Liveness (process alive)
curl -s http://<service>:<port>/healthz

# Readiness (accepting traffic)
curl -s http://<service>:<port>/readyz

# Startup complete
curl -s http://<service>:<port>/startupz
```

Monitor for five minutes (approximately phi-cubed minutes) to confirm stability.

## Multi-Service Cascade Recovery

When multiple services fail simultaneously, recover in ring order following the Sacred Geometry topology:

1. **Central Hub first**: HeadySoul (port 3310) — the awareness layer must be operational before dependent nodes can validate coherence.
2. **Inner Ring second**: HeadyBrains (3311), HeadyConductor (3312), HeadyVinci (3313) — orchestration must be available to coordinate recovery of execution nodes.
3. **Infrastructure services**: Database connections (PgBouncer), event bus (NATS), cache layer.
4. **Middle Ring**: Execution nodes in any order — they are independently operational once the Inner Ring is available.
5. **Outer Ring and Governance**: Specialized capabilities and quality assurance last.

## Database Connection Recovery

If PgBouncer reports connection exhaustion:

```bash
# Check PgBouncer stats
psql -h localhost -p 6432 pgbouncer -c "SHOW POOLS;"
psql -h localhost -p 6432 pgbouncer -c "SHOW CLIENTS;"

# Force disconnect idle clients
psql -h localhost -p 6432 pgbouncer -c "KILL heady;"
psql -h localhost -p 6432 pgbouncer -c "RESUME heady;"
```

Pool sizes are Fibonacci-derived: default_pool_size=21, min_pool_size=5, reserve_pool_size=8, max_client_conn=233, max_db_connections=89.

## Complete Platform Restart

For full platform restart, follow this sequence with phi-derived delays between stages:

1. Start infrastructure: PostgreSQL, NATS, PgBouncer (wait 8 seconds)
2. Start Central Hub: HeadySoul (wait 5 seconds)
3. Start Inner Ring: HeadyBrains, HeadyConductor, HeadyVinci (wait 8 seconds)
4. Start monitoring: Prometheus, Grafana, Alertmanager (wait 5 seconds)
5. Start infrastructure services: Schema Registry (3370), Feature Flags (3371), NATS Bridge (3372), Session Server (3373) (wait 8 seconds)
6. Start all remaining services in parallel (wait 13 seconds for stabilization)
7. Run smoke tests: `node tests/smoke/smoke-runner.js`
8. Verify coherence: Check HeadySoul coherence endpoint for system-wide score above phiThreshold(2) = 0.809

## Escalation Procedures

If recovery procedures do not resolve the issue within the following timeframes:
- P1: Escalate after 13 minutes to platform lead
- P2: Escalate after 34 minutes to on-call engineer
- P3: Escalate after 89 minutes to engineering team
- P4: Document and address in next sprint

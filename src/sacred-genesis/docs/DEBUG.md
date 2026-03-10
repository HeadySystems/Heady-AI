# Heady Platform — Debug Guide

## Quick Diagnostics

### Service Not Responding
```bash
# Check if service is running
curl -s http://localhost:<port>/healthz | jq .

# Check Docker container
docker ps | grep <service-name>
docker logs <container> --tail 50

# Check Cloud Run
gcloud run services describe <service> --region us-east1 --format json | jq .status
```

### Circuit Breaker Issues
```bash
# Check breaker state via metrics
curl -s http://localhost:<port>/metrics | grep circuit_breaker

# States: 0=CLOSED (healthy), 1=HALF_OPEN (probing), 2=OPEN (failing)
# Opens after fib(5)=5 failures, closes after fib(3)=2 successes
# Backoff: 1000ms, 1618ms, 2618ms, 4236ms, 6854ms, 11090ms
```

### Vector Search Issues
```bash
# Test embedding generation
curl -s -X POST http://localhost:3315/embed -H "Content-Type: application/json" -d '{"text":"test"}'

# Test vector search
curl -s -X POST http://localhost:3358/search -H "Content-Type: application/json" -d '{"query":"test","limit":5}'

# Check HNSW index health
psql -h localhost -p 5432 heady_vectors -c "SELECT pg_size_pretty(pg_relation_size('idx_vectors_embedding'));"
```

### Coherence Drift
```bash
# Check system coherence
curl -s http://localhost:3310/coherence | jq .

# Threshold: phiThreshold(2) = 0.809
# Below 0.809: drift detected, investigate
# Below 0.691: significant drift, HeadySoul review needed
```

### Connection Pool Exhaustion
```bash
# Check PgBouncer stats
psql -h localhost -p 6432 pgbouncer -c "SHOW POOLS;"
# Look for: cl_active, cl_waiting, sv_active, sv_idle
# max_client_conn=233, max_db_connections=89
```

## Common Issues and Solutions

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| 503 on all endpoints | Service crashed | Restart service, check logs |
| Slow vector search | Index fragmentation | REINDEX CONCURRENTLY |
| CSRF errors | Cookie mismatch | Clear cookies, re-authenticate |
| Rate limit 429 | Burst traffic | Wait for token bucket refill |
| Coherence < 0.809 | Embedding model change | Re-embed affected vectors |
| Audit chain broken | Data corruption | Restore from backup |

## Log Analysis
All services emit structured JSON logs:
```bash
# Filter error logs
docker logs <container> 2>&1 | jq 'select(.level == "error")'

# Find specific service
docker logs <container> 2>&1 | jq 'select(.service == "heady-conductor")'

# Time-range filter
docker logs <container> --since "2h" 2>&1 | jq 'select(.level == "error" or .level == "critical")'
```

# heady-memory runbook

## Symptoms
- memory search or upsert requests time out
- vector sync falls behind or recall quality drops
- readiness checks show degraded dependency health for storage or cache layers

## Diagnosis
1. Verify PostgreSQL, pgvector, and Redis reachability.
2. Check structured logs for pool exhaustion, retry storms, or schema mismatch errors.
3. Run targeted smoke checks for memory endpoints and inspect recent migration history.
4. Confirm the shared config package still resolves valid origins and required environment values.

## Remediation
- Restore database or cache connectivity and recycle the service once dependencies are healthy.
- Apply pending migrations or revert incompatible schema changes.
- Tune pool and retry settings only through shared phi/fibonacci configuration paths.
- Serve cached or read-only responses temporarily if upstream write paths are unavailable.

## Post-incident review
- Record whether the issue was caused by dependency health, schema drift, or rollout sequencing.
- Add contract or migration checks if the incident escaped CI.
- Update the service dependency map if a hidden upstream dependency was discovered.

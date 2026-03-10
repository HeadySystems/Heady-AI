# Database Operations Runbook

## Document Information
- **Author**: Eric Haywood, HeadySystems Inc.
- **Version**: 4.0.0
- **Last Updated**: 2026-03-01

## Purpose
This runbook covers PostgreSQL and pgvector database operations for the Heady platform, including connection management through PgBouncer, vector index maintenance, backup and restore procedures, and performance optimization.

## Connection Management

### PgBouncer Configuration
PgBouncer manages all database connections with Fibonacci-derived pool sizes:
- **default_pool_size**: fib(8) = 21 connections per database per user
- **min_pool_size**: fib(5) = 5 minimum idle connections
- **reserve_pool_size**: fib(6) = 8 connections for burst capacity
- **max_client_conn**: fib(13) = 233 maximum client connections
- **max_db_connections**: fib(11) = 89 maximum server-side connections

Pool mode is set to `transaction` — connections are returned to the pool after each transaction completes. This maximizes connection reuse across the 60+ microservices.

### Monitoring Connection Health
```bash
# Show active pools
psql -h localhost -p 6432 pgbouncer -c "SHOW POOLS;"

# Show connected clients
psql -h localhost -p 6432 pgbouncer -c "SHOW CLIENTS;"

# Show server connections
psql -h localhost -p 6432 pgbouncer -c "SHOW SERVERS;"

# Show statistics
psql -h localhost -p 6432 pgbouncer -c "SHOW STATS;"
```

### Connection Exhaustion Recovery
If `max_client_conn` is reached:
1. Identify services with excessive connections: `SHOW CLIENTS;`
2. Check for connection leaks (clients with long `connect_time` and zero recent queries)
3. Kill idle connections: `psql -p 6432 pgbouncer -c "KILL heady;"`
4. Resume the pool: `psql -p 6432 pgbouncer -c "RESUME heady;"`
5. Investigate and fix the leaking service

## Vector Index Maintenance

### HNSW Index Parameters
pgvector HNSW indexes use phi-derived parameters:
- **m** (connections per node): fib(8) = 21
- **ef_construction** (build-time search width): fib(12) = 144
- **ef_search** (query-time search width): fib(11) = 89

### Index Rebuild
Vector indexes should be rebuilt when:
- Search recall drops below phiThreshold(2) = 0.809
- Insert performance degrades below acceptable thresholds
- Significant data deletions have fragmented the index

```sql
-- Rebuild HNSW index
REINDEX INDEX CONCURRENTLY idx_vectors_embedding;

-- Or drop and recreate with current parameters
DROP INDEX CONCURRENTLY IF EXISTS idx_vectors_embedding;
CREATE INDEX CONCURRENTLY idx_vectors_embedding
  ON vectors USING hnsw (embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 144);
```

### Monitoring Vector Performance
```sql
-- Check index size
SELECT pg_size_pretty(pg_relation_size('idx_vectors_embedding'));

-- Check table statistics
SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables WHERE relname = 'vectors';

-- Test search performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, 1 - (embedding <=> '[0.1, 0.2, ...]') as similarity
FROM vectors
ORDER BY embedding <=> '[0.1, 0.2, ...]'
LIMIT 21;
```

## Backup and Restore

### Automated Backups
Backups run on a Fibonacci-stepped schedule:
- **Continuous WAL archiving**: Real-time to GCS
- **Base backup**: Every fib(8) = 21 hours
- **Retention**: fib(11) = 89 days for base backups, fib(9) = 34 days for WAL archives

### Manual Backup
```bash
# Full backup
pg_dump -h localhost -p 5432 -U heady_admin -Fc -f heady_backup_$(date +%Y%m%d).dump heady

# Vector data only
pg_dump -h localhost -p 5432 -U heady_admin -Fc -t vectors -f vectors_$(date +%Y%m%d).dump heady_vectors
```

### Restore Procedure
```bash
# Restore to fresh database
createdb -h localhost -p 5432 -U heady_admin heady_restored
pg_restore -h localhost -p 5432 -U heady_admin -d heady_restored heady_backup.dump

# Restore vectors
pg_restore -h localhost -p 5432 -U heady_admin -d heady_vectors -t vectors vectors_backup.dump

# Rebuild HNSW indexes after restore
psql -h localhost -p 5432 -U heady_admin -d heady_vectors -c "REINDEX INDEX CONCURRENTLY idx_vectors_embedding;"
```

### Point-in-Time Recovery
Using WAL archives for PITR:
```bash
# Create recovery.conf
restore_command = 'gsutil cp gs://heady-wal-archive/%f %p'
recovery_target_time = '2026-03-09 14:30:00 UTC'
```

## Performance Optimization

### Vacuum Configuration
```sql
-- Check vacuum settings
SHOW autovacuum_vacuum_cost_delay;
SHOW autovacuum_vacuum_scale_factor;

-- Manual vacuum for vector tables
VACUUM (VERBOSE, ANALYZE) vectors;
```

### Query Optimization
For vector search queries, ensure:
1. The `ef_search` parameter matches the query requirements (default fib(11) = 89)
2. Pre-filtering reduces the candidate set before vector similarity
3. Metadata indexes exist for commonly filtered columns
4. Use `halfvec` type for storage optimization when full precision is unnecessary

```sql
-- Set search parameter for session
SET hnsw.ef_search = 89;

-- Filtered vector search pattern
SELECT id, content, 1 - (embedding <=> $1) as similarity
FROM vectors
WHERE metadata->>'domain' = $2
  AND created_at > NOW() - INTERVAL '89 days'
ORDER BY embedding <=> $1
LIMIT 21;
```

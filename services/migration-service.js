// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/migration-service.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Migration Service — Port 3316
 * Database migration runner, schema diff, pgvector index management
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const BATCH_SIZE             = fibonacci(9);                 // 34
const HNSW_M                = fibonacci(8);                  // 21
const HNSW_EF_CONSTRUCTION  = fibonacci(12);                 // 144
const HNSW_EF_SEARCH        = fibonacci(11);                 // 89
const MAX_SNAPSHOTS          = fibonacci(8);                 // 21
const LOCK_TIMEOUT_MS        = fibonacci(13) * 1000;         // 233s

// ── In-Memory Migration State ────────────────────────────────────
const migrations = new Map();
const appliedMigrations = [];
const snapshots = new Map();
const schemaState = { tables: new Map(), indexes: new Map(), version: 0 };
const metrics = { applied: 0, rolledBack: 0, drifts: 0, snapshots: 0 };

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

// ── Migration Registration ───────────────────────────────────────
function registerMigration(spec) {
  const id = spec.version + '_' + spec.name;
  const migration = {
    id,
    version: spec.version,
    name: spec.name,
    up: spec.up || [],
    down: spec.down || [],
    dependencies: spec.dependencies || [],
    description: spec.description || '',
    hash: sha256(JSON.stringify(spec.up) + JSON.stringify(spec.down)),
    registered: Date.now(),
    applied: false,
    appliedAt: null,
  };
  migrations.set(id, migration);
  return { id, registered: true };
}

// ── Dependency Graph (Topological Sort) ──────────────────────────
function resolveMigrationOrder() {
  const visited = new Set();
  const order = [];
  const visiting = new Set();

  function dfs(id) {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const mig = migrations.get(id);
    if (!mig) return true;
    for (const dep of mig.dependencies) {
      if (!dfs(dep)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
    return true;
  }

  for (const [id] of migrations) dfs(id);
  return order;
}

// ── Apply Migration ──────────────────────────────────────────────
function applyMigration(migrationId, dryRun) {
  const mig = migrations.get(migrationId);
  if (!mig) return { error: 'migration_not_found' };
  if (mig.applied) return { error: 'already_applied' };

  for (const dep of mig.dependencies) {
    const depMig = migrations.get(dep);
    if (!depMig || !depMig.applied) {
      return { error: 'dependency_not_applied', dependency: dep };
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      migrationId,
      statements: mig.up,
      impact: {
        tablesAffected: mig.up.filter(s => s.type === 'create_table' || s.type === 'alter_table').length,
        indexesAffected: mig.up.filter(s => s.type === 'create_index' || s.type === 'drop_index').length,
        dataOperations: mig.up.filter(s => s.type === 'data_migration').length,
      },
    };
  }

  // Apply statements
  const results = [];
  for (const stmt of mig.up) {
    const result = applyStatement(stmt);
    results.push(result);
  }

  mig.applied = true;
  mig.appliedAt = Date.now();
  schemaState.version++;
  appliedMigrations.push(migrationId);
  metrics.applied++;

  return { applied: true, migrationId, results, version: schemaState.version };
}

function applyStatement(stmt) {
  const stmtType = stmt.type || 'sql';

  if (stmtType === 'create_table') {
    schemaState.tables.set(stmt.table, {
      name: stmt.table,
      columns: stmt.columns || [],
      created: Date.now(),
      hash: sha256(JSON.stringify(stmt)),
    });
    return { type: 'create_table', table: stmt.table, success: true };
  }

  if (stmtType === 'alter_table') {
    const table = schemaState.tables.get(stmt.table);
    if (!table) return { type: 'alter_table', error: 'table_not_found' };
    if (stmt.addColumns) table.columns.push(...stmt.addColumns);
    if (stmt.dropColumns) table.columns = table.columns.filter(c => !stmt.dropColumns.includes(c.name));
    table.hash = sha256(JSON.stringify(table));
    return { type: 'alter_table', table: stmt.table, success: true };
  }

  if (stmtType === 'create_index') {
    const indexType = stmt.indexType || 'btree';
    const params = indexType === 'hnsw' ? { m: HNSW_M, efConstruction: HNSW_EF_CONSTRUCTION } :
                   indexType === 'ivfflat' ? { lists: fibonacci(11) } : {};
    schemaState.indexes.set(stmt.name, {
      name: stmt.name,
      table: stmt.table,
      columns: stmt.columns,
      type: indexType,
      params,
      created: Date.now(),
    });
    return { type: 'create_index', name: stmt.name, indexType, params, success: true };
  }

  if (stmtType === 'data_migration') {
    let processed = 0;
    const totalBatches = Math.ceil((stmt.estimatedRows || BATCH_SIZE) / BATCH_SIZE);
    for (let i = 0; i < totalBatches; i++) {
      processed += Math.min(BATCH_SIZE, (stmt.estimatedRows || BATCH_SIZE) - processed);
    }
    return { type: 'data_migration', processedRows: processed, batches: totalBatches, batchSize: BATCH_SIZE, success: true };
  }

  return { type: stmtType, success: true, hash: sha256(JSON.stringify(stmt)) };
}

// ── Rollback ─────────────────────────────────────────────────────
function rollbackMigration(migrationId) {
  const mig = migrations.get(migrationId);
  if (!mig) return { error: 'migration_not_found' };
  if (!mig.applied) return { error: 'not_applied' };

  // Check no dependents need this
  for (const [id, other] of migrations) {
    if (other.applied && other.dependencies.includes(migrationId)) {
      return { error: 'has_applied_dependents', dependent: id };
    }
  }

  const results = [];
  for (const stmt of mig.down) {
    results.push(applyStatement(stmt));
  }

  mig.applied = false;
  mig.appliedAt = null;
  schemaState.version++;
  metrics.rolledBack++;

  return { rolledBack: true, migrationId, results, version: schemaState.version };
}

// ── Snapshot Management ──────────────────────────────────────────
function createSnapshot(name) {
  const id = sha256(name + Date.now());
  const snapshot = {
    id, name,
    version: schemaState.version,
    tables: new Map(schemaState.tables),
    indexes: new Map(schemaState.indexes),
    appliedMigrations: [...appliedMigrations],
    created: Date.now(),
    hash: sha256(JSON.stringify([...schemaState.tables.entries()])),
  };

  if (snapshots.size >= MAX_SNAPSHOTS) {
    const oldest = snapshots.keys().next().value;
    snapshots.delete(oldest);
  }
  snapshots.set(id, snapshot);
  metrics.snapshots++;
  return { id, name, version: snapshot.version };
}

function restoreSnapshot(snapshotId) {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) return { error: 'snapshot_not_found' };
  schemaState.tables = new Map(snapshot.tables);
  schemaState.indexes = new Map(snapshot.indexes);
  schemaState.version = snapshot.version;
  return { restored: true, snapshotId, version: snapshot.version };
}

// ── Schema Drift Detection ───────────────────────────────────────
function detectDrift(expectedSchema) {
  const drifts = [];
  for (const [name, expected] of Object.entries(expectedSchema.tables || {})) {
    const actual = schemaState.tables.get(name);
    if (!actual) {
      drifts.push({ type: 'missing_table', table: name });
      continue;
    }
    const actualHash = sha256(JSON.stringify(actual));
    const expectedHash = sha256(JSON.stringify(expected));
    if (actualHash !== expectedHash) {
      drifts.push({ type: 'table_drift', table: name, actualHash, expectedHash });
    }
  }

  for (const [name, expected] of Object.entries(expectedSchema.indexes || {})) {
    const actual = schemaState.indexes.get(name);
    if (!actual) {
      drifts.push({ type: 'missing_index', index: name });
    }
  }

  if (drifts.length > 0) metrics.drifts++;
  return { drifts, hasDrift: drifts.length > 0, checkedAt: Date.now() };
}

// ── pgvector Index Management ────────────────────────────────────
function createVectorIndex(tableName, columnName, dimensions, indexType) {
  const type = indexType || 'hnsw';
  const name = 'idx_' + tableName + '_' + columnName + '_' + type;
  const params = type === 'hnsw'
    ? { m: HNSW_M, efConstruction: HNSW_EF_CONSTRUCTION, efSearch: HNSW_EF_SEARCH }
    : { lists: fibonacci(11) };

  schemaState.indexes.set(name, {
    name, table: tableName, columns: [columnName],
    type, params, dimensions: dimensions || 384,
    created: Date.now(),
  });
  return { name, type, params, dimensions: dimensions || 384 };
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3316) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (parseErr) { resolve({ _parseError: parseErr.message }); } });
      });

      if (url.pathname === '/migration/register' && req.method === 'POST') {
        const body = await readBody();
        respond(201, registerMigration(body));
      } else if (url.pathname === '/migration/apply' && req.method === 'POST') {
        const body = await readBody();
        respond(200, applyMigration(body.migrationId, body.dryRun));
      } else if (url.pathname === '/migration/rollback' && req.method === 'POST') {
        const body = await readBody();
        respond(200, rollbackMigration(body.migrationId));
      } else if (url.pathname === '/migration/snapshot' && req.method === 'POST') {
        const body = await readBody();
        respond(201, createSnapshot(body.name));
      } else if (url.pathname === '/migration/restore' && req.method === 'POST') {
        const body = await readBody();
        respond(200, restoreSnapshot(body.snapshotId));
      } else if (url.pathname === '/migration/drift' && req.method === 'POST') {
        const body = await readBody();
        respond(200, detectDrift(body));
      } else if (url.pathname === '/migration/vector-index' && req.method === 'POST') {
        const body = await readBody();
        respond(201, createVectorIndex(body.table, body.column, body.dimensions, body.indexType));
      } else if (url.pathname === '/migration/status' && req.method === 'GET') {
        respond(200, { version: schemaState.version, applied: appliedMigrations.length, tables: schemaState.tables.size, indexes: schemaState.indexes.size });
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

const startTime = Date.now();
function health() {
  return {
    service: 'migration-service',
    status: 'healthy',
    port: 3316,
    uptime: Date.now() - startTime,
    schemaVersion: schemaState.version,
    appliedMigrations: appliedMigrations.length,
    registeredMigrations: migrations.size,
    snapshotCount: snapshots.size,
    metrics: { ...metrics },
    phiConstants: { BATCH_SIZE, HNSW_M, HNSW_EF_CONSTRUCTION, HNSW_EF_SEARCH },
  };
}

export default { createServer, health, registerMigration, applyMigration, rollbackMigration, createSnapshot, detectDrift, createVectorIndex };
export { createServer, health, registerMigration, applyMigration, rollbackMigration, createSnapshot, detectDrift, createVectorIndex };

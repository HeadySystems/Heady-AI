// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DB Migrate v1.0.0 — forward-only migration runner          ║
// ║  One migrations home (packages/db/migrations, ADR-0002) with a      ║
// ║  checksum journal (schema_migrations) and a fail-closed drift       ║
// ║  check: an applied file that changed or vanished HALTS the runner.  ║
// ║  Pure + injected-executor (the task-ledger tx idiom) so every path  ║
// ║  unit-tests without a database; the driver wires in bin/migrate.    ║
// ║  Supersedes the legacy src/consistency/migrate.js (broken path).    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** The single canonical migrations home (GATE-1: never a root db/migrations). */
export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Journal table owned by the runner (0001_init.sql deliberately does not create it). */
export const JOURNAL_TABLE = "schema_migrations";

const NAME_RE = /^\d{4}_[a-z0-9_-]+\.sql$/i;

/** Thrown when the on-disk directory contradicts the applied journal (fail-closed). */
export class MigrationDriftError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "MigrationDriftError";
    this.context = context;
  }
}

/** sha256 hex of a migration's raw text — the journal checksum. */
export function checksum(sqlText) {
  return createHash("sha256").update(sqlText).digest("hex");
}

/**
 * List migration files (NNNN_name.sql) in lexical = version order. Rejects
 * malformed names and duplicate version numbers (two 0002_* files is a merge
 * hazard, not a preference).
 * @returns {{version:string, path:string, sql:string, checksum:string}[]}
 */
export function listMigrations(dir = MIGRATIONS_DIR) {
  const names = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
  const seen = new Map();
  return names.map((name) => {
    if (!NAME_RE.test(name)) throw new MigrationDriftError(`malformed migration filename: ${name} (want NNNN_name.sql)`, { name });
    const num = name.slice(0, 4);
    if (seen.has(num)) throw new MigrationDriftError(`duplicate migration number ${num}: ${seen.get(num)} vs ${name}`, { num });
    seen.set(num, name);
    const sql = readFileSync(join(dir, name), "utf8");
    return { version: name, path: join(dir, name), sql, checksum: checksum(sql) };
  });
}

/**
 * Pure planner: given on-disk files and journal rows, return what to apply.
 * Fail-closed drift rules (the checksum/journal contract):
 *   • an applied version missing from disk  → MigrationDriftError
 *   • an applied version whose checksum changed → MigrationDriftError
 * @param {{files:{version:string,checksum:string}[], applied:{version:string,checksum:string}[]}} io
 * @returns {{pending:object[], appliedCount:number}}
 */
export function planMigrations({ files, applied }) {
  const onDisk = new Map(files.map((f) => [f.version, f]));
  for (const row of applied) {
    const file = onDisk.get(row.version);
    if (!file) throw new MigrationDriftError(`applied migration ${row.version} is missing from the migrations directory`, { version: row.version });
    if (file.checksum !== row.checksum) {
      throw new MigrationDriftError(`applied migration ${row.version} was edited after apply (checksum drift) — author a new NNNN_*.sql instead`, { version: row.version });
    }
  }
  const appliedSet = new Set(applied.map((r) => r.version));
  return { pending: files.filter((f) => !appliedSet.has(f.version)), appliedCount: applied.length };
}

/**
 * Run pending migrations forward-only, each in its own transaction, recording
 * the journal row in the SAME transaction as the DDL (a crash can never leave
 * an applied-but-unjournaled migration). Halts on first failure (ROLLBACK, then
 * rethrow) — later migrations are not attempted past a broken one.
 *
 * @param {object} opts
 * @param {(sql: string, params?: unknown[]) => Promise<unknown>} opts.exec
 *   injected executor (single session/client — BEGIN/COMMIT are session-scoped)
 * @param {string} [opts.dir] migrations home (defaults to the canonical one)
 * @param {{info:Function, error:Function}} [opts.log] pino-style logger
 * @returns {Promise<{applied:string[], skipped:number, total:number}>}
 */
export async function runMigrations({ exec, dir = MIGRATIONS_DIR, log } = {}) {
  if (typeof exec !== "function") throw new TypeError("runMigrations: exec (sql executor) is required");

  await exec(`CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (
    version    text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const files = listMigrations(dir);
  const rows = await exec(`SELECT version, checksum FROM ${JOURNAL_TABLE} ORDER BY version`);
  const applied = Array.isArray(rows) ? rows : (rows?.rows ?? []);
  const { pending } = planMigrations({ files, applied });

  const appliedNow = [];
  for (const m of pending) {
    await exec("BEGIN");
    try {
      await exec(m.sql);
      await exec(`INSERT INTO ${JOURNAL_TABLE} (version, checksum) VALUES ($1, $2)`, [m.version, m.checksum]);
      await exec("COMMIT");
      appliedNow.push(m.version);
      if (log) log.info({ version: m.version }, "migration applied");
    } catch (err) {
      await exec("ROLLBACK");
      if (log) log.error({ version: m.version, err: String(err?.message ?? err) }, "migration failed — rolled back, halting");
      throw err;
    }
  }
  return { applied: appliedNow, skipped: files.length - pending.length, total: files.length };
}

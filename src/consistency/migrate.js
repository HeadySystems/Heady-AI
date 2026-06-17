/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * migrate — forward-only migration runner (ADR-0003: one migrations directory).
 *
 * Applies pending `db/migrations/NNNN_*.sql` in lexical order, each in its own
 * transaction, recording applied versions in `schema_migrations`. Re-running is
 * a no-op. This is the single mechanism; nothing else applies schema.
 *
 *   node src/consistency/migrate.js
 */

const fs = require("fs");
const path = require("path");
const db = require("../services/neon-db");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "db", "migrations");

async function ensureLedger() {
    return db.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
    );
}

/** Migration files on disk not yet recorded as applied, in order. */
function pending(applied) {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .filter((f) => !applied.has(f));
}

async function migrate() {
    const conn = await db.connect();
    if (!conn.ok) return { ok: false, error: conn.error };

    const ledger = await ensureLedger();
    if (!ledger.ok) return { ok: false, error: ledger.error };

    const done = await db.query(`SELECT version FROM schema_migrations`);
    const applied = new Set((done.rows || []).map((r) => r.version));
    const todo = pending(applied);

    const ran = [];
    for (const file of todo) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        const txn = await db.transaction(async (client) => {
            await client.query(sql);
            await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [file]);
        });
        if (!txn.ok) return { ok: false, error: `${file}: ${txn.error}`, applied: ran };
        ran.push(file);
    }
    return { ok: true, applied: ran, alreadyApplied: [...applied] };
}

if (require.main === module) {
    migrate()
        .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); })
        .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { migrate, pending, MIGRATIONS_DIR };

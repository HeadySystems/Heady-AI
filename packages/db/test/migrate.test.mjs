// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DB Migrate tests — node:test, zero deps                   ║
// ║  Fake transactional executor (buffers journal inserts until        ║
// ║  COMMIT, discards on ROLLBACK) so ordering, idempotency, drift,     ║
// ║  and halt-on-failure are proven without a database.                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  listMigrations, planMigrations, runMigrations, checksum,
  MigrationDriftError, MIGRATIONS_DIR, JOURNAL_TABLE,
} from "../src/migrate.mjs";

/** Write a fixture migrations dir; returns its path. */
function fixtureDir(files) {
  const dir = mkdtempSync(join(tmpdir(), "heady-migrate-"));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

/** Transaction-faithful fake executor: journal inserts land only on COMMIT. */
function fakeDb({ failOn } = {}) {
  const journal = []; // durable rows {version, checksum}
  const calls = [];   // every (sql) in order
  let txBuffer = null; // pending journal inserts inside an open tx
  const exec = async (sql, params = []) => {
    calls.push(sql.split("\n")[0].trim());
    if (sql === "BEGIN") { txBuffer = []; return []; }
    if (sql === "COMMIT") { journal.push(...txBuffer); txBuffer = null; return []; }
    if (sql === "ROLLBACK") { txBuffer = null; return []; }
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS")) return [];
    if (sql.startsWith(`SELECT version, checksum FROM ${JOURNAL_TABLE}`)) return journal.map((r) => ({ ...r }));
    if (sql.startsWith(`INSERT INTO ${JOURNAL_TABLE}`)) { txBuffer.push({ version: params[0], checksum: params[1] }); return []; }
    if (failOn && sql.includes(failOn)) throw new Error(`boom on ${failOn}`);
    return []; // the migration DDL itself
  };
  return { exec, journal, calls };
}

test("listMigrations orders lexically, rejects malformed names and duplicate numbers", () => {
  const dir = fixtureDir({ "0002_b.sql": "B;", "0001_a.sql": "A;" });
  assert.deepEqual(listMigrations(dir).map((m) => m.version), ["0001_a.sql", "0002_b.sql"]);
  assert.throws(() => listMigrations(fixtureDir({ "init.sql": "X;" })), MigrationDriftError);
  assert.throws(() => listMigrations(fixtureDir({ "0001_a.sql": "A;", "0001_b.sql": "B;" })), MigrationDriftError);
});

test("fresh database: applies all in order, journal rows land inside each tx", async () => {
  const dir = fixtureDir({ "0001_a.sql": "CREATE TABLE a();", "0002_b.sql": "CREATE TABLE b();" });
  const db = fakeDb();
  const out = await runMigrations({ exec: db.exec, dir });
  assert.deepEqual(out, { applied: ["0001_a.sql", "0002_b.sql"], skipped: 0, total: 2 });
  assert.deepEqual(db.journal.map((r) => r.version), ["0001_a.sql", "0002_b.sql"]);
  // per-migration tx shape: BEGIN → ddl → INSERT journal → COMMIT
  const i = db.calls.indexOf("BEGIN");
  assert.equal(db.calls[i + 1], "CREATE TABLE a();");
  assert.match(db.calls[i + 2], /^INSERT INTO schema_migrations/);
  assert.equal(db.calls[i + 3], "COMMIT");
});

test("re-run is a no-op (idempotent forward-only)", async () => {
  const dir = fixtureDir({ "0001_a.sql": "A;" });
  const db = fakeDb();
  await runMigrations({ exec: db.exec, dir });
  const again = await runMigrations({ exec: db.exec, dir });
  assert.deepEqual(again, { applied: [], skipped: 1, total: 1 });
  assert.equal(db.journal.length, 1);
});

test("checksum drift on an applied migration fails closed before anything runs", async () => {
  const files = [{ version: "0001_a.sql", checksum: checksum("A;") }];
  const applied = [{ version: "0001_a.sql", checksum: checksum("A; -- edited") }];
  assert.throws(() => planMigrations({ files, applied }), MigrationDriftError);
});

test("applied-but-missing file fails closed", () => {
  assert.throws(
    () => planMigrations({ files: [], applied: [{ version: "0001_gone.sql", checksum: "x" }] }),
    MigrationDriftError,
  );
});

test("mid-run failure: ROLLBACK, journal untouched for the failed one, later ones not attempted", async () => {
  const dir = fixtureDir({ "0001_a.sql": "A;", "0002_bad.sql": "BAD;", "0003_c.sql": "C;" });
  const db = fakeDb({ failOn: "BAD;" });
  await assert.rejects(() => runMigrations({ exec: db.exec, dir }), /boom/);
  assert.deepEqual(db.journal.map((r) => r.version), ["0001_a.sql"]); // only the good one
  assert.ok(db.calls.includes("ROLLBACK"));
  assert.ok(!db.calls.includes("C;"), "migrations after a failure must not run");
});

test("canonical home resolves to packages/db/migrations and contains the complete ordered chain", () => {
  assert.match(MIGRATIONS_DIR, /packages[/\\]db[/\\]migrations$/);
  const files = listMigrations();
  assert.deepEqual(files.map((f) => f.version), [
    "0001_init.sql",
    "0002_legacy_capture.sql",
    "0003_data_api_least_privilege.sql",
    "0004_approval_control_plane.sql",
    "0005_990_intelligence.sql",
    "0006_990_search.sql",
  ]);
  assert.equal(planMigrations({ files, applied: [] }).pending.length, files.length);
});

test("Data API migration removes existing and future authenticated-role access", () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, "0003_data_api_least_privilege.sql"), "utf8");
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public/);
  assert.doesNotMatch(sql, /\bGRANT\b[^;]*\bauthenticated\b/i);
});

test("approval migration makes history append-only and requires one receipt per event", () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, "0004_approval_control_plane.sql"), "utf8");
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS heady_approval/);
  assert.match(sql, /CREATE CONSTRAINT TRIGGER approval_event_receipt_required/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /CREATE TRIGGER approval_events_append_only/);
  assert.match(sql, /CREATE TRIGGER approval_receipts_append_only/);
  assert.match(sql, /CREATE TRIGGER approval_bootstrap_immutable/);
  assert.match(sql, /CREATE TRIGGER approval_bootstrap_insert_guard/);
  assert.match(sql, /adr-0031-accepted-e064a8943/);
  assert.match(sql, /event_actor_key_owner/);
  assert.match(sql, /event_evidence_timing/);
  assert.match(sql, /CREATE TRIGGER approval_event_actor_guard/);
  assert.match(sql, /CREATE TRIGGER approval_event_binding_guard/);
  assert.match(sql, /CREATE TRIGGER approval_outbox_update_guard/);
  assert.match(sql, /CREATE TRIGGER approval_receipt_signer_guard/);
  assert.match(sql, /approval_deployment_artifact/);
  assert.match(sql, /principal_role_evidence_shape/);
  assert.match(sql, /revocation is irreversible/);
  assert.match(sql, /\^sha256:\[a-f0-9\]\{64\}\$/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /REVOKE ALL ON SCHEMA heady_approval FROM PUBLIC/);
  assert.doesNotMatch(sql, /\bGRANT\b[^;]*\bauthenticated\b/i);
});

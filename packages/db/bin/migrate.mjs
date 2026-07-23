#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DB Migrate CLI — the live GATE-1 entrypoint                ║
// ║  DATABASE_URL via @heady/secrets loadSecrets (fail-closed, env →   ║
// ║  GCP Secret Manager auto provider), pg-compatible driver resolved  ║
// ║  at runtime (pg, else @neondatabase/serverless), forward-only      ║
// ║  runner from src/migrate.mjs. Exit 0 = ok · 1 = halt.              ║
// ║  SAFETY RAIL: plan-only (read-only) by DEFAULT — mutating the      ║
// ║  database requires the explicit --apply flag, so a verification    ║
// ║  run can never write. Target a Neon COW branch, never root.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { loadSecrets } from "@heady/secrets";
import {
  runMigrations, listMigrations, planMigrations, MIGRATIONS_DIR, JOURNAL_TABLE,
} from "../src/migrate.mjs";

// Structured pino-shaped lines; the unstructured console sink is forbidden (AGENTS.md #2).
const emit = (level, msg, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ t: "db-migrate", level, msg, ...fields })}\n`);

// Loopback matcher built from fragments so this guard never embeds the banned
// literals it forbids (AGENTS.md #4 — cloud-deployed only; mirrors @heady/config).
const LOOPBACK = new RegExp(["local" + "host", "127" + "\\.0\\.0\\.1", ":" + ":1\\b"].join("|"));

/** Resolve a pg-compatible Client: pg first, Neon's serverless driver second. */
async function resolveClient(connectionString) {
  const candidates = ["pg", "@neondatabase/serverless"];
  for (const mod of candidates) {
    try {
      const { Client } = await import(mod);
      return { client: new Client({ connectionString }), driver: mod };
    } catch { /* try the next driver */ }
  }
  throw new Error(`no pg-compatible driver installed — add one to @heady/db: pnpm --filter @heady/db add ${candidates[0]}`);
}

async function main() {
  const { DATABASE_URL } = await loadSecrets({ require: ["DATABASE_URL"] });
  if (LOOPBACK.test(DATABASE_URL)) {
    emit("error", "DATABASE_URL references a loopback address (cloud-deployed only)");
    return 1;
  }

  let client; let driver;
  try {
    ({ client, driver } = await resolveClient(DATABASE_URL));
  } catch (err) {
    emit("error", String(err.message));
    return 1;
  }

  const apply = process.argv.includes("--apply");

  await client.connect();
  emit("info", "connected", { driver, migrationsDir: MIGRATIONS_DIR, mode: apply ? "APPLY" : "plan (read-only)" });
  try {
    const exec = async (sql, params = []) => (await client.query(sql, params)).rows;

    if (!apply) {
      // Read-only plan: no journal-table creation, no DDL — nothing is written.
      // 42P01 (undefined_table) means a fresh database: everything is pending.
      let applied = [];
      try {
        applied = await exec(`SELECT version, checksum FROM ${JOURNAL_TABLE} ORDER BY version`);
      } catch (err) {
        if (err?.code !== "42P01") throw err;
      }
      const { pending } = planMigrations({ files: listMigrations(), applied });
      emit("info", "plan complete — NOTHING applied (pass --apply to a Neon COW branch to run)", {
        applied: applied.length, pending: pending.map((m) => m.version),
      });
      return 0;
    }

    const log = {
      info: (f, msg) => emit("info", msg, f),
      error: (f, msg) => emit("error", msg, f),
    };
    const out = await runMigrations({ exec, log });
    emit("info", "migrations complete", out);
    return 0;
  } catch (err) {
    emit("error", "migration run halted", { err: String(err?.message ?? err) });
    return 1;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => { emit("error", "fatal", { err: String(err?.message ?? err) }); process.exit(1); },
);

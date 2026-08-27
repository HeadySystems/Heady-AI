// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Database Tests v1.0.0                      ║
// ║  Neon pooled URL and transaction rollback contract tests.       ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNeonPooledUrl, createPgDatabase } from "../src/database.mjs";

test("runtime accepts only TLS-enforced Neon pooled connection strings", () => {
  assert.equal(assertNeonPooledUrl(
    "postgresql://user:pass@ep-example-pooler.us-central1.aws.neon.tech/db?sslmode=require",
  ), true);
  assert.throws(() => assertNeonPooledUrl(
    "postgresql://user:pass@ep-example.us-central1.aws.neon.tech/db?sslmode=require",
  ), /pooled/);
  assert.throws(() => assertNeonPooledUrl(
    "postgresql://user:pass@ep-example-pooler.us-central1.aws.neon.tech/db",
  ), /TLS/);
  assert.throws(() => assertNeonPooledUrl(
    "postgresql://user:pass@ep-example-pooler.example.com/db?sslmode=require",
  ), /Neon hostname/);
});

test("database adapter commits success and rolls back failure on one checked-out client", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      return { rowCount: 1, rows: [{ value: 1 }] };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  class FakePool {
    constructor(config) {
      calls.push(config.application_name);
    }
    async connect() {
      return client;
    }
    async query(sql) {
      calls.push(sql);
      return { rowCount: 1, rows: [{ checked_at: new Date("2026-07-24T12:00:00.000Z") }] };
    }
    async end() {
      calls.push("END");
    }
  }
  const database = createPgDatabase({
    connectionString: "postgresql://user:pass@database.internal/db",
    PoolClass: FakePool,
    enforceNeonPool: false,
  });
  const value = await database.tx(async (tx) => (await tx.query("SELECT 1")).rows[0].value);
  assert.equal(value, 1);
  assert.equal(calls[1], "BEGIN");
  assert.match(calls[2], /set_config\('statement_timeout'/);
  assert.deepEqual(calls.slice(3, 6), ["SELECT 1", "COMMIT", "RELEASE"]);

  await assert.rejects(() => database.tx(async () => {
    throw new Error("transaction failure");
  }), /transaction failure/);
  assert.ok(calls.includes("ROLLBACK"));
});

test("runtime authority rejects owner-like database credentials", async () => {
  function PoolWithAuthority(authority) {
    return class {
      async query() {
        return { rows: [authority] };
      }
    };
  }
  const leastPrivilege = createPgDatabase({
    connectionString: "postgresql://user:pass@database.internal/db",
    PoolClass: PoolWithAuthority({
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
      api_member: true,
      privileged_role_member: false,
      database_owner_member: false,
      can_create_in_schema: false,
      can_mutate_bootstrap: false,
      can_mutate_registries: false,
      can_rewrite_authority: false,
    }),
    enforceNeonPool: false,
  });
  assert.equal(await leastPrivilege.assertRuntimeAuthority(), true);

  const ownerLike = createPgDatabase({
    connectionString: "postgresql://owner:pass@database.internal/db",
    PoolClass: PoolWithAuthority({
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
      api_member: true,
      privileged_role_member: false,
      database_owner_member: true,
      can_create_in_schema: true,
      can_mutate_bootstrap: true,
      can_mutate_registries: true,
      can_rewrite_authority: true,
    }),
    enforceNeonPool: false,
  });
  await assert.rejects(
    () => ownerLike.assertRuntimeAuthority(),
    /least-privilege/,
  );
});

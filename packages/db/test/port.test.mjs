// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DbPort tests — node:test, fake client (no database)       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDbPort } from "../src/port.mjs";

class FakeClient {
  constructor() { this.calls = []; this.connected = false; this.ended = false; }
  async connect() { this.connected = true; }
  async query(sql, params = []) { this.calls.push({ sql, params }); return { rows: [] }; }
  async end() { this.ended = true; }
}

const mk = () => {
  let instance;
  const port = createDbPort({
    connectionString: "postgres://user@ep-test.example.neon.tech/neondb",
    ClientClass: class extends FakeClient { constructor(cfg) { super(cfg); instance = this; } },
  });
  return { port, get client() { return instance; } };
};

test("createDbPort requires a connection string", () => {
  assert.throws(() => createDbPort({}), TypeError);
});

test("connect is idempotent; end closes", async () => {
  const { port, client } = mk();
  await port.connect();
  await port.connect();
  assert.equal(client.connected, true);
  await port.end();
  assert.equal(client.ended, true);
});

test("tx wraps fn in BEGIN/COMMIT and hands it the pg-shaped client", async () => {
  const { port, client } = mk();
  await port.connect();
  const out = await port.tx(async (tx) => {
    await tx.query("INSERT INTO task DEFAULT VALUES");
    return "done";
  });
  assert.equal(out, "done");
  assert.deepEqual(client.calls.map((c) => c.sql), ["BEGIN", "INSERT INTO task DEFAULT VALUES", "COMMIT"]);
});

test("tx rolls back and rethrows on failure", async () => {
  const { port, client } = mk();
  await port.connect();
  await assert.rejects(
    () => port.tx(async () => { throw new Error("boom"); }),
    /boom/,
  );
  assert.deepEqual(client.calls.map((c) => c.sql), ["BEGIN", "ROLLBACK"]);
});

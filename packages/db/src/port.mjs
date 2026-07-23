// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DbPort v1.0.0 — the live Neon connection seam (GATE-1)     ║
// ║  Ports-not-vendors: one adapter owning the pg client so every       ║
// ║  consumer (task-ledger, memory-stream) takes a port, never a        ║
// ║  driver. tx(fn) hands fn a pg-client-shaped handle inside           ║
// ║  BEGIN/COMMIT with ROLLBACK on throw — exactly the `tx` contract    ║
// ║  @heady/task-ledger already codes against.                          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import pg from "pg";

/**
 * Create a live DbPort.
 * @param {object} opts
 * @param {string} opts.connectionString Neon URL (resolve via @heady/secrets at
 *   the app layer — this port never reads env or vault itself)
 * @param {new (cfg: object) => object} [opts.ClientClass] injectable client
 *   (tests pass a fake; defaults to pg.Client)
 * @returns {{ connect:Function, query:Function, tx:Function, end:Function }}
 */
export function createDbPort({ connectionString, ClientClass = pg.Client }) {
  if (!connectionString) throw new TypeError("createDbPort: connectionString is required");
  const client = new ClientClass({ connectionString });
  let connected = false;

  return {
    /** Open the underlying connection (idempotent). */
    async connect() {
      if (!connected) { await client.connect(); connected = true; }
    },

    /** One-off query outside a transaction. */
    async query(sql, params = []) {
      return client.query(sql, params);
    },

    /**
     * Run fn inside a transaction. fn receives a pg-client-shaped handle
     * ({ query } → { rows }) — the task-ledger `tx` contract. COMMIT on
     * return, ROLLBACK + rethrow on throw.
     */
    async tx(fn) {
      await client.query("BEGIN");
      try {
        const out = await fn(client);
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    },

    /** Close the connection. */
    async end() {
      if (connected) { await client.end(); connected = false; }
    },
  };
}

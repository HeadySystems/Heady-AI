// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Audit Ports v1.0.0                                  ║
// ║  Append-only in-memory test port and Neon hash-chain adapter.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { canonicalize, sha256 } from "./canonical.mjs";

const HASH_ZERO = "0".repeat(64);
const SET_RUNTIME_ROLE = "SET LOCAL ROLE heady_runtime_api";

export class InMemoryMcpAuditStore {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.records = [];
  }

  async ready() { return true; }

  async append(event) {
    const previousSha256 = this.records.findLast((record) => record.tenantId === event.tenantId)?.recordSha256 ?? HASH_ZERO;
    const sequence = this.records.length + 1;
    const createdAt = this.now();
    const canonical = { ...event, sequence, previousSha256, createdAt };
    const recordSha256 = sha256(canonicalize(canonical));
    const record = Object.freeze({ ...canonical, recordSha256 });
    this.records.push(record);
    return record;
  }

  async history({ tenantId, limit }) {
    return this.records
      .filter((record) => record.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  async verify({ tenantId }) {
    const records = this.records.filter((record) => record.tenantId === tenantId);
    let previousSha256 = HASH_ZERO;
    for (const record of records) {
      const { recordSha256, ...canonical } = record;
      if (canonical.previousSha256 !== previousSha256) return false;
      if (sha256(canonicalize(canonical)) !== recordSha256) return false;
      previousSha256 = recordSha256;
    }
    return true;
  }
}

async function withPort(getDbPort, operation) {
  const port = await getDbPort();
  await port.connect();
  try {
    return await operation(port);
  } finally {
    await port.end();
  }
}

export function createNeonMcpAuditStore({ getDbPort }) {
  if (typeof getDbPort !== "function") throw new TypeError("getDbPort is required");

  return {
    async ready() {
      return withPort(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query(SET_RUNTIME_ROLE);
        const result = await tx.query(
          `SELECT to_regprocedure('heady_mcp.append_audit(jsonb)') IS NOT NULL
                  AND to_regprocedure('heady_mcp.verify_audit_chain(text)') IS NOT NULL
                  AND has_function_privilege(current_user, 'heady_mcp.append_audit(jsonb)', 'EXECUTE')
                  AND has_function_privilege(current_user, 'heady_mcp.verify_audit_chain(text)', 'EXECUTE')
                  AND has_table_privilege(current_user, 'heady_mcp.tool_call_audit', 'SELECT') AS ready`,
        );
        return result.rows[0]?.ready === true;
      }));
    },

    async append(event) {
      return withPort(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query(SET_RUNTIME_ROLE);
        await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [event.tenantId]);
        const result = await tx.query(
          "SELECT sequence, previous_sha256, record_sha256, created_at FROM heady_mcp.append_audit($1::jsonb)",
          [event],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Neon audit append returned no receipt");
        return {
          ...event,
          sequence: Number(row.sequence),
          previousSha256: row.previous_sha256,
          recordSha256: row.record_sha256,
          createdAt: new Date(row.created_at).toISOString(),
        };
      }));
    },

    async history({ tenantId, limit }) {
      return withPort(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query(SET_RUNTIME_ROLE);
        await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [tenantId]);
        const result = await tx.query(
          `SELECT sequence, event, previous_sha256, record_sha256, created_at
             FROM heady_mcp.tool_call_audit
            WHERE tenant_id = $1
            ORDER BY sequence DESC
            LIMIT $2`,
          [tenantId, limit],
        );
        return result.rows.map((row) => ({
          ...row.event,
          sequence: Number(row.sequence),
          previousSha256: row.previous_sha256,
          recordSha256: row.record_sha256,
          createdAt: new Date(row.created_at).toISOString(),
        }));
      }));
    },

    async verify({ tenantId }) {
      return withPort(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query(SET_RUNTIME_ROLE);
        await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [tenantId]);
        const result = await tx.query("SELECT heady_mcp.verify_audit_chain($1) AS valid", [tenantId]);
        return result.rows[0]?.valid === true;
      }));
    },
  };
}

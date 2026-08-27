// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Neon Adapter v1.0.0                        ║
// ║  Pooled runtime sessions with transaction-scoped pg clients.    ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pg from "pg";
import { FIB, HEARTBEAT_MS, phiBackoffMs } from "@heady/phi-math";

export function assertNeonPooledUrl(connectionString) {
  const parsed = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new TypeError("DATABASE_URL must use the PostgreSQL protocol");
  }
  if (!parsed.hostname.endsWith(".neon.tech")) {
    throw new TypeError("approval runtime DATABASE_URL must target a Neon hostname");
  }
  if (!parsed.hostname.includes("-pooler")) {
    throw new TypeError("approval runtime DATABASE_URL must be a Neon pooled connection");
  }
  if (!["require", "verify-full"].includes(parsed.searchParams.get("sslmode"))) {
    throw new TypeError("approval runtime DATABASE_URL must enforce TLS with sslmode");
  }
  return true;
}

export function createPgDatabase({
  connectionString,
  PoolClass = pg.Pool,
  enforceNeonPool = true,
}) {
  if (enforceNeonPool) assertNeonPooledUrl(connectionString);
  const pool = new PoolClass({
    connectionString,
    max: FIB[5],
    idleTimeoutMillis: HEARTBEAT_MS,
    connectionTimeoutMillis: phiBackoffMs(FIB[3]),
    application_name: "heady-approval-api",
  });

  return Object.freeze({
    query(sql, params = []) {
      return pool.query(sql, params);
    },
    async tx(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true), set_config('idle_in_transaction_session_timeout', $3, true)",
          [
            `${HEARTBEAT_MS}ms`,
            `${phiBackoffMs(FIB[2])}ms`,
            `${HEARTBEAT_MS}ms`,
          ],
        );
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async assertRuntimeAuthority() {
      const result = await pool.query(`
        SELECT
          r.rolsuper,
          r.rolcreaterole,
          r.rolcreatedb,
          r.rolreplication,
          r.rolbypassrls,
          pg_has_role(current_user, 'heady_approval_api', 'member') AS api_member,
          EXISTS (
            SELECT 1
            FROM pg_roles privileged
            WHERE (
              privileged.rolsuper
              OR privileged.rolcreaterole
              OR privileged.rolcreatedb
              OR privileged.rolreplication
              OR privileged.rolbypassrls
            )
            AND pg_has_role(current_user, privileged.oid, 'member')
          ) AS privileged_role_member,
          EXISTS (
            SELECT 1
            FROM pg_database database_record
            WHERE database_record.datname = current_database()
              AND pg_has_role(current_user, database_record.datdba, 'member')
          ) AS database_owner_member,
          has_schema_privilege(current_user, 'heady_approval', 'CREATE') AS can_create_in_schema,
          (
            has_table_privilege(current_user, 'heady_approval.bootstrap', 'INSERT')
            OR has_table_privilege(current_user, 'heady_approval.bootstrap', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.bootstrap', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.bootstrap', 'TRUNCATE')
          ) AS can_mutate_bootstrap,
          (
            has_table_privilege(current_user, 'heady_approval.principals', 'INSERT')
            OR has_table_privilege(current_user, 'heady_approval.principals', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.principals', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.principals', 'TRUNCATE')
            OR has_table_privilege(current_user, 'heady_approval.principal_keys', 'INSERT')
            OR has_table_privilege(current_user, 'heady_approval.principal_keys', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.principal_keys', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.principal_keys', 'TRUNCATE')
            OR has_table_privilege(current_user, 'heady_approval.receipt_signing_keys', 'INSERT')
            OR has_table_privilege(current_user, 'heady_approval.receipt_signing_keys', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.receipt_signing_keys', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.receipt_signing_keys', 'TRUNCATE')
          ) AS can_mutate_registries,
          (
            has_table_privilege(current_user, 'heady_approval.events', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.events', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.events', 'TRUNCATE')
            OR has_table_privilege(current_user, 'heady_approval.receipts', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.receipts', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.receipts', 'TRUNCATE')
            OR has_table_privilege(current_user, 'heady_approval.audit_replays', 'UPDATE')
            OR has_table_privilege(current_user, 'heady_approval.audit_replays', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.audit_replays', 'TRUNCATE')
            OR has_table_privilege(current_user, 'heady_approval.approvals', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.approvals', 'TRUNCATE')
            OR has_column_privilege(
              current_user,
              'heady_approval.approvals',
              'payload_sha256',
              'UPDATE'
            )
            OR has_table_privilege(current_user, 'heady_approval.outbox', 'DELETE')
            OR has_table_privilege(current_user, 'heady_approval.outbox', 'TRUNCATE')
            OR has_column_privilege(
              current_user,
              'heady_approval.outbox',
              'payload',
              'UPDATE'
            )
          ) AS can_rewrite_authority
        FROM pg_roles r
        WHERE r.rolname = current_user
      `);
      const authority = result.rows[0];
      if (
        !authority
        || authority.rolsuper
        || authority.rolcreaterole
        || authority.rolcreatedb
        || authority.rolreplication
        || authority.rolbypassrls
        || !authority.api_member
        || authority.privileged_role_member
        || authority.database_owner_member
        || authority.can_create_in_schema
        || authority.can_mutate_bootstrap
        || authority.can_mutate_registries
        || authority.can_rewrite_authority
      ) {
        throw new TypeError("DATABASE_URL does not use the least-privilege approval runtime role");
      }
      return true;
    },
    async health() {
      const result = await pool.query("SELECT current_schema() AS schema, now() AS checked_at");
      return {
        ok: result.rowCount === 1,
        checkedAt: new Date(result.rows[0].checked_at).toISOString(),
      };
    },
    end() {
      return pool.end();
    },
  });
}

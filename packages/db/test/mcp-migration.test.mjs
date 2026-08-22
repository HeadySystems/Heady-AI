// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Audit Migration Contract Tests v1.0.0               ║
// ║  Guards append-only, tenant, idempotency, and hash-chain DDL.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../migrations/0013_mcp_intelligence_audit.sql", import.meta.url);

test("MCP audit migration is append-only, tenant-bound, and self-verifying", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /BEFORE UPDATE OR DELETE ON heady_mcp\.tool_call_audit/);
  assert.match(sql, /ALTER TABLE heady_mcp\.tool_call_audit FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('heady\.tenant_id', true\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION heady_mcp\.append_audit/);
  assert.match(sql, /FUNCTION heady_mcp\.append_audit[\s\S]*SECURITY DEFINER/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION heady_mcp\.verify_audit_chain/);
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*tool_call_audit[.]chain:' \|\| v_tenant/);
  assert.match(sql, /FROM heady_mcp[.]tool_call_audit AS audit\s+WHERE audit[.]tenant_id = v_tenant\s+ORDER BY audit[.]sequence DESC/);
  assert.match(sql, /GRANT SELECT ON heady_mcp[.]tool_call_audit TO heady_runtime_api/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION heady_mcp[.]append_audit\(JSONB\) TO heady_runtime_api/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE)[^;]*tool_call_audit TO heady_runtime_api/);
});

test("MCP idempotency records bind request fingerprints and state", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS request_sha256 TEXT/);
  assert.match(sql, /status IN \('STARTED', 'SUCCEEDED', 'FAILED'\)/);
  assert.match(sql, /request_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
});

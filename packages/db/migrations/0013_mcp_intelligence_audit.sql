-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0013 — MCP Intelligence Audit v1.0.0       ║
-- ║  Tenant-bound append-only tool receipts with a SHA-256 chain.    ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Forward-only. Requires 0007's NOLOGIN/NOBYPASSRLS heady_runtime_api role;
-- application transactions SET LOCAL ROLE to make forced RLS effective even
-- when the connection was established by the Neon migration owner.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS heady_mcp;

-- ADR-0006 request identity: preserve the existing table and add the fields
-- required to distinguish a safe replay from a key collision. The columns are
-- nullable for rows written by pre-0013 producers; MCP writes require them.
ALTER TABLE idempotency_key
  ADD COLUMN IF NOT EXISTS request_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE idempotency_key
  DROP CONSTRAINT IF EXISTS idempotency_key_request_sha256_shape,
  DROP CONSTRAINT IF EXISTS idempotency_key_status_shape;

ALTER TABLE idempotency_key
  ADD CONSTRAINT idempotency_key_request_sha256_shape
    CHECK (request_sha256 IS NULL OR request_sha256 ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT idempotency_key_status_shape
    CHECK (status IS NULL OR status IN ('STARTED', 'SUCCEEDED', 'FAILED'));

CREATE TABLE IF NOT EXISTS heady_mcp.tool_call_audit (
  sequence          BIGINT PRIMARY KEY,
  call_id           UUID NOT NULL,
  tenant_id         TEXT NOT NULL,
  principal_id      TEXT NOT NULL,
  trace_id          TEXT NOT NULL,
  tool_name         TEXT NOT NULL,
  tool_version      TEXT NOT NULL,
  phase             TEXT NOT NULL CHECK (phase IN ('STARTED', 'SUCCEEDED', 'FAILED')),
  event             JSONB NOT NULL,
  previous_sha256   TEXT NOT NULL CHECK (previous_sha256 ~ '^[a-f0-9]{64}$'),
  record_sha256     TEXT NOT NULL UNIQUE CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  created_at        TIMESTAMPTZ NOT NULL,
  UNIQUE (call_id, phase),
  CONSTRAINT mcp_audit_event_shape CHECK (
    event->>'schema' = 'heady.mcp.audit.v1'
    AND event->>'callId' = call_id::TEXT
    AND event->>'tenantId' = tenant_id
    AND event->>'principalId' = principal_id
    AND event->>'traceId' = trace_id
    AND event->>'toolName' = tool_name
    AND event->>'toolVersion' = tool_version
    AND event->>'phase' = phase
  )
);

CREATE INDEX IF NOT EXISTS mcp_tool_call_audit_tenant_sequence
  ON heady_mcp.tool_call_audit (tenant_id, sequence DESC);
CREATE INDEX IF NOT EXISTS mcp_tool_call_audit_call
  ON heady_mcp.tool_call_audit (call_id, sequence);

CREATE SEQUENCE IF NOT EXISTS heady_mcp.tool_call_audit_sequence;

CREATE OR REPLACE FUNCTION heady_mcp.reject_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'heady_mcp.tool_call_audit is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS mcp_tool_call_audit_append_only ON heady_mcp.tool_call_audit;
CREATE TRIGGER mcp_tool_call_audit_append_only
  BEFORE UPDATE OR DELETE ON heady_mcp.tool_call_audit
  FOR EACH ROW EXECUTE FUNCTION heady_mcp.reject_audit_mutation();

ALTER TABLE heady_mcp.tool_call_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_mcp.tool_call_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_tool_call_audit_tenant_isolation ON heady_mcp.tool_call_audit;
CREATE POLICY mcp_tool_call_audit_tenant_isolation
  ON heady_mcp.tool_call_audit
  USING (tenant_id = NULLIF(current_setting('heady.tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('heady.tenant_id', true), ''));

CREATE OR REPLACE FUNCTION heady_mcp.append_audit(p_event JSONB)
RETURNS TABLE (
  sequence BIGINT,
  previous_sha256 TEXT,
  record_sha256 TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, heady_mcp
AS $$
DECLARE
  v_sequence BIGINT;
  v_previous TEXT;
  v_record TEXT;
  v_created TIMESTAMPTZ;
  v_tenant TEXT;
BEGIN
  IF NOT p_event ?& ARRAY['schema', 'callId', 'tenantId', 'principalId', 'traceId', 'toolName', 'toolVersion', 'phase', 'requestSha256'] THEN
    RAISE EXCEPTION 'MCP audit event is missing required fields' USING ERRCODE = '22023';
  END IF;
  IF p_event->>'schema' <> 'heady.mcp.audit.v1' THEN
    RAISE EXCEPTION 'unsupported MCP audit schema' USING ERRCODE = '22023';
  END IF;

  v_tenant := NULLIF(current_setting('heady.tenant_id', true), '');
  IF v_tenant IS NULL OR p_event->>'tenantId' IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'MCP audit tenant context mismatch' USING ERRCODE = '42501';
  END IF;

  -- Each tenant owns an independent chain. A tenant-derived transaction lock
  -- serializes its appends without coupling unrelated tenants or leaking their
  -- receipt hashes into one another's verification path.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('heady_mcp.tool_call_audit.chain:' || v_tenant, 0)
  );
  SELECT audit.record_sha256
    INTO v_previous
    FROM heady_mcp.tool_call_audit AS audit
   WHERE audit.tenant_id = v_tenant
   ORDER BY audit.sequence DESC
   LIMIT 1;

  v_previous := COALESCE(v_previous, repeat('0', 64));
  v_sequence := nextval('heady_mcp.tool_call_audit_sequence');
  v_created := clock_timestamp();
  v_record := encode(
    public.digest(
      convert_to(
        v_previous || E'\n' || v_sequence::TEXT || E'\n' ||
        to_char(v_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || E'\n' ||
        p_event::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO heady_mcp.tool_call_audit (
    sequence, call_id, tenant_id, principal_id, trace_id, tool_name,
    tool_version, phase, event, previous_sha256, record_sha256, created_at
  ) VALUES (
    v_sequence,
    (p_event->>'callId')::UUID,
    p_event->>'tenantId',
    p_event->>'principalId',
    p_event->>'traceId',
    p_event->>'toolName',
    p_event->>'toolVersion',
    p_event->>'phase',
    p_event,
    v_previous,
    v_record,
    v_created
  );

  RETURN QUERY SELECT v_sequence, v_previous, v_record, v_created;
END;
$$;

CREATE OR REPLACE FUNCTION heady_mcp.verify_audit_chain(p_tenant TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, heady_mcp
AS $$
DECLARE
  v_tenant TEXT;
  v_valid BOOLEAN;
BEGIN
  v_tenant := NULLIF(current_setting('heady.tenant_id', true), '');
  IF v_tenant IS NULL OR p_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'MCP audit tenant context mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(bool_and(
    chain.previous_sha256 = chain.expected_previous
    AND chain.record_sha256 = encode(
      public.digest(
        convert_to(
          chain.previous_sha256 || E'\n' || chain.sequence::TEXT || E'\n' ||
          to_char(chain.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || E'\n' ||
          chain.event::TEXT,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  ), true)
  INTO v_valid
  FROM (
    SELECT
      audit.sequence,
      audit.event,
      audit.previous_sha256,
      audit.record_sha256,
      audit.created_at,
      COALESCE(
        lag(audit.record_sha256) OVER (ORDER BY audit.sequence),
        repeat('0', 64)
      ) AS expected_previous
    FROM heady_mcp.tool_call_audit AS audit
    WHERE audit.tenant_id = p_tenant
  ) AS chain;

  RETURN v_valid;
END;
$$;

-- Public callers never receive direct write access to the audit table or its
-- sequence. Runtime code can read through tenant RLS and execute the two
-- governed functions only; append_audit performs the sole insert path.
REVOKE ALL ON SCHEMA heady_mcp FROM PUBLIC;
REVOKE ALL ON heady_mcp.tool_call_audit FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON SEQUENCE heady_mcp.tool_call_audit_sequence FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON FUNCTION heady_mcp.append_audit(JSONB) FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON FUNCTION heady_mcp.verify_audit_chain(TEXT) FROM PUBLIC, authenticated, anonymous;

GRANT USAGE ON SCHEMA heady_mcp TO heady_runtime_api;
GRANT SELECT ON heady_mcp.tool_call_audit TO heady_runtime_api;
GRANT EXECUTE ON FUNCTION heady_mcp.append_audit(JSONB) TO heady_runtime_api;
GRANT EXECUTE ON FUNCTION heady_mcp.verify_audit_chain(TEXT) TO heady_runtime_api;

-- The role running this forward migration is the deployment connection role.
-- Membership permits SET LOCAL ROLE but does not make privileges implicit
-- because heady_runtime_api is NOINHERIT.
DO $grant_runtime_role$
BEGIN
  EXECUTE format('GRANT heady_runtime_api TO %I', current_user);
END
$grant_runtime_role$;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0011 — node orchestration integrity         ║
-- ║  Immutable task-outbox evidence and measured runtime-node         ║
-- ║  heartbeats for production orchestration readiness.              ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE FUNCTION public.guard_task_outbox_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'task outbox evidence cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF ROW(NEW.seq, NEW.task_id, NEW.topic, NEW.payload, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.seq, OLD.task_id, OLD.topic, OLD.payload, OLD.created_at) THEN
    RAISE EXCEPTION 'task outbox event identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at THEN
    RAISE EXCEPTION 'task outbox dispatch completion is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$body$;

CREATE TRIGGER task_outbox_append_only
BEFORE UPDATE OR DELETE ON public.task_outbox
FOR EACH ROW EXECUTE FUNCTION public.guard_task_outbox_mutation();

REVOKE ALL ON FUNCTION public.guard_task_outbox_mutation() FROM PUBLIC, authenticated, anonymous;

CREATE TABLE heady_runtime.node_heartbeat (
  node_id      TEXT PRIMARY KEY CHECK (node_id ~ '^HEADY_[A-Z0-9_]+$'),
  revision     TEXT NOT NULL CHECK (length(revision) > 0),
  status       TEXT NOT NULL CHECK (status IN ('STARTING', 'READY', 'DEGRADED', 'DRAINING')),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  observed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX node_heartbeat_observed_at
  ON heady_runtime.node_heartbeat (observed_at DESC);

REVOKE ALL ON heady_runtime.node_heartbeat FROM PUBLIC, authenticated, anonymous;
GRANT SELECT, INSERT, UPDATE ON heady_runtime.node_heartbeat TO heady_runtime_api;

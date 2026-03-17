-- db/migrations/002_hybrid_search.sql
-- Enable pgvector 0.8 iterative scans + BM25 hybrid search
-- From tech scan: zero-code-change retrieval improvement

-- Enable iterative scans (solves overfiltering with WHERE clauses)
SET hnsw.iterative_scan = 'relaxed_order';

-- Enable pg_search extension for BM25 (ParadeDB on Neon)
CREATE EXTENSION IF NOT EXISTS pg_search;

-- Create BM25 index on memory_vectors content
CREATE INDEX IF NOT EXISTS memory_vectors_bm25_idx
  ON memory_vectors USING bm25 (content)
  WITH (text_fields = '{"content": {}}');

-- Add GIN index for fallback full-text search
CREATE INDEX IF NOT EXISTS memory_vectors_fts_idx
  ON memory_vectors USING gin (to_tsvector('english', content));

-- Add content_hash index for faster upserts
CREATE INDEX IF NOT EXISTS memory_vectors_content_hash_idx
  ON memory_vectors (content_hash);

-- Pipeline task guards index
CREATE INDEX IF NOT EXISTS task_guards_user_active_idx
  ON task_guards (user_id, active) WHERE active = true;

-- Add A2A agent card metadata table
CREATE TABLE IF NOT EXISTS agent_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  url TEXT NOT NULL,
  version TEXT DEFAULT '0.3',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert all 17 swarm agent cards
INSERT INTO agent_cards (name, description, capabilities, url) VALUES
  ('HeadySystems', 'Platform orchestrator', ARRAY['orchestration','health-monitoring','deployment'], '/a2a/systems'),
  ('HeadyBrain', 'Core intelligence — 22-stage pipeline', ARRAY['reasoning','memory-retrieval','csl-scoring'], '/a2a/brain'),
  ('HeadyBuddy', 'AI companion', ARRAY['conversation','emotional-intelligence','support'], '/a2a/buddy'),
  ('HeadyBattle', 'Arena orchestrator', ARRAY['benchmarking','ab-testing','arena-competition'], '/a2a/battle'),
  ('HeadyMC', 'Monte Carlo simulation', ARRAY['simulation','monte-carlo','risk-analysis'], '/a2a/mc'),
  ('HeadyDecomp', 'Task decomposition', ARRAY['task-decomposition','dag-building'], '/a2a/decomp'),
  ('HeadyCreative', 'Creative intelligence', ARRAY['image-generation','music-composition','midi'], '/a2a/creative'),
  ('HeadyFinance', 'Financial intelligence', ARRAY['market-analysis','portfolio-optimization','trading'], '/a2a/finance'),
  ('HeadySims', 'Simulation engine', ARRAY['simulation','world-modeling','scenario-testing'], '/a2a/sims'),
  ('HeadyLens', 'Vision intelligence', ARRAY['image-analysis','ocr','visual-search'], '/a2a/lens'),
  ('HeadyConductor', 'LangGraph DAG orchestrator', ARRAY['dag-orchestration','workflow-management'], '/a2a/conductor'),
  ('HeadyBee', 'CrewAI swarm spawner', ARRAY['swarm-spawning','parallel-execution'], '/a2a/bee'),
  ('HeadyGuard', 'Security fortress', ARRAY['security','validation','encryption','signing'], '/a2a/guard'),
  ('HeadyDistiller', 'Knowledge compression', ARRAY['knowledge-compression','pattern-extraction'], '/a2a/distiller'),
  ('HeadyEval', 'Quality assurance', ARRAY['evaluation','quality-gating','anti-regression'], '/a2a/eval'),
  ('HeadyMCP', 'MCP server hub', ARRAY['mcp-server','tool-discovery'], '/a2a/mcp'),
  ('HeadyBot', 'Discord bot', ARRAY['discord','slash-commands','notifications'], '/a2a/bot')
ON CONFLICT (name) DO NOTHING;

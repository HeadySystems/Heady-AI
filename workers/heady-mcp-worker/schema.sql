-- HeadyMCP Gateway — D1 Registry Schema
-- Stores tool definitions, users, API keys, and audit logs

-- ══════════════════════════════════════════════════════════════════════
-- UPSTREAM MCP SERVERS — registered server endpoints
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS upstream_servers (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL UNIQUE,       -- e.g. 'heady', 'github', 'slack'
  name TEXT NOT NULL,                    -- Display name
  description TEXT,
  url TEXT NOT NULL,                      -- MCP endpoint URL
  transport TEXT DEFAULT 'http',         -- 'http' | 'sse' | 'stdio'
  auth_type TEXT DEFAULT 'none',         -- 'none' | 'bearer' | 'oauth'
  auth_config TEXT,                      -- JSON: encrypted token, OAuth config
  health_status TEXT DEFAULT 'unknown',  -- 'healthy' | 'unhealthy' | 'unknown'
  health_checked_at TEXT,
  tool_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  owner_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════════════════════════════
-- TOOLS — cached tool definitions from upstream servers
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES upstream_servers(id),
  namespace TEXT NOT NULL,                -- matches upstream_servers.namespace
  original_name TEXT NOT NULL,            -- tool name as upstream reports it
  prefixed_name TEXT NOT NULL UNIQUE,     -- e.g. 'heady__heady_health'
  description TEXT,
  input_schema TEXT,                      -- JSON schema
  category TEXT,
  definition_hash TEXT NOT NULL,          -- SHA-256 of full tool definition
  is_public BOOLEAN DEFAULT true,
  call_count INTEGER DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tools_namespace ON tools(namespace);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_prefixed ON tools(prefixed_name);

-- ══════════════════════════════════════════════════════════════════════
-- USERS — registered gateway users
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'explorer',           -- explorer | pro | team | enterprise
  daily_limit INTEGER DEFAULT 1000,       -- tool calls per day
  monthly_calls INTEGER DEFAULT 0,
  enabled_namespaces TEXT DEFAULT '["heady"]', -- JSON array
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════════════════════════════
-- API KEYS — bearer tokens for authentication
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,              -- SHA-256 of the actual key
  key_prefix TEXT NOT NULL,               -- first 8 chars for identification
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT DEFAULT 'default',
  scopes TEXT DEFAULT '["*"]',            -- JSON array of namespace patterns
  rate_limit_per_min INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- ══════════════════════════════════════════════════════════════════════
-- AUDIT LOG — invocation history for analytics and billing
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invocations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  api_key_prefix TEXT,
  tool_prefixed_name TEXT NOT NULL,
  server_id TEXT,
  latency_ms INTEGER,
  status TEXT NOT NULL,                   -- 'success' | 'error' | 'timeout' | 'rate_limited'
  error_message TEXT,
  request_tokens INTEGER,                 -- estimated token cost saved
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invocations_user ON invocations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invocations_tool ON invocations(tool_prefixed_name);

-- ══════════════════════════════════════════════════════════════════════
-- USER PREFERENCES — per-user service toggles & bypass mode
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  enabled_services TEXT DEFAULT '["heady-intelligence","heady-orchestration","heady-memory","heady-ai","heady-security","heady-ops","heady-edge"]',
  bypass_mode BOOLEAN DEFAULT false,
  llm_cascade TEXT DEFAULT '["claude","gpt4","gemini","groq"]',
  ai_gateway_cache BOOLEAN DEFAULT true,
  max_tokens_per_request INTEGER DEFAULT 4096,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════════════════════════════
-- SEED DATA — Register Heady MCP Server as first upstream
-- ══════════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO upstream_servers (id, namespace, name, description, url, transport, tool_count, is_active)
VALUES (
  'heady-mcp-server-v5',
  'heady',
  'Heady™ MCP Server',
  '47 AI tools — intelligence, orchestration, memory, multi-model AI, ops, edge, security',
  'https://heady-mcp-server-609590223909.us-central1.run.app',
  'http',
  47,
  true
);

INSERT OR IGNORE INTO upstream_servers (id, namespace, name, description, url, transport, tool_count, is_active)
VALUES (
  'headyconnection-org-v1',
  'hc',
  'HeadyConnection.org',
  '8 nonprofit/community tools — 990 grant writing AI, grant discovery, HeadyAcademy, community hub, nonprofit AI access, mutual aid, creative tools, impact measurement',
  'https://headyconnection.org/mcp',
  'http',
  8,
  true
);

INSERT OR IGNORE INTO upstream_servers (id, namespace, name, description, url, transport, tool_count, is_active)
VALUES (
  'headyfinance-com-v1',
  'hf',
  'HeadyFinance',
  '3 financial intelligence tools — market analysis, portfolio optimization, risk assessment',
  'https://headyfinance.com/mcp',
  'http',
  3,
  true
);

-- ══════════════════════════════════════════════════════════════════════
-- AI GATEWAY REQUESTS — tracking for cost analytics & cache hit rates
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_gateway_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider TEXT NOT NULL,              -- 'anthropic' | 'openai' | 'google' | 'workers-ai' | 'groq'
  model TEXT NOT NULL,                 -- e.g. 'claude-sonnet-4-20250514', 'kimi-k2.5'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false,
  latency_ms INTEGER,
  cost_usd REAL DEFAULT 0,
  gateway_id TEXT DEFAULT 'heady-gateway',
  swarm_worker TEXT,                   -- which swarm dispatched this request
  pipeline_stage TEXT,                 -- e.g. 'stage-7-deep-scan', 'stage-14-synthesis'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aigw_user ON ai_gateway_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aigw_provider ON ai_gateway_requests(provider, model);
CREATE INDEX IF NOT EXISTS idx_aigw_cache ON ai_gateway_requests(cache_hit);

-- ══════════════════════════════════════════════════════════════════════
-- SWARM WORKERS — dispatch namespace Worker registry
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS swarm_workers (
  id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL UNIQUE,       -- e.g. 'swarm-cognitive', 'swarm-bypass'
  display_name TEXT NOT NULL,
  description TEXT,
  bindings TEXT,                          -- JSON: which CF bindings this Worker uses
  category TEXT NOT NULL,                 -- 'cognitive' | 'security' | 'media' | 'search' | etc.
  dispatch_namespace TEXT DEFAULT 'heady-mcp-prod',
  is_active BOOLEAN DEFAULT true,
  cpu_limit_ms INTEGER DEFAULT 50,        -- per-request CPU limit
  subrequest_limit INTEGER DEFAULT 50,    -- per-request subrequest limit
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed swarm Workers
INSERT OR IGNORE INTO swarm_workers (id, worker_name, display_name, description, bindings, category) VALUES
  ('sw-cognitive', 'swarm-cognitive', 'Cognitive Swarm', 'High-reasoning tasks, CSL gate evaluation, deep analysis', '["AI","VECTOR_INDEX","CACHE"]', 'cognitive'),
  ('sw-security',  'swarm-security',  'Security Swarm',  'PQC operations, secret rotation, audit, risk assessment', '["DB","CACHE","AI"]', 'security'),
  ('sw-media',     'swarm-media',     'Media Swarm',     'Video encode, transcription, image transforms, HeadyLens', '["ASSETS","AI","BROWSER"]', 'media'),
  ('sw-search',    'swarm-search',    'Search Swarm',    'RAG, semantic search, AutoRAG queries, tool discovery', '["VECTOR_INDEX","AI","CACHE"]', 'search'),
  ('sw-realtime',  'swarm-realtime',  'Realtime Swarm',  'WebSocket sessions, live transcription, voice I/O', '["AI"]', 'realtime'),
  ('sw-browser',   'swarm-browser',   'Browser Swarm',   'Web scraping, screenshot, dynamic crawl, rendering', '["BROWSER","ASSETS"]', 'browser'),
  ('sw-code',      'swarm-code',      'Code Swarm',      'Dynamic Worker execution, LLM code generation, sandboxed V8', '["AI","DB","CACHE"]', 'code'),
  ('sw-bypass',    'swarm-bypass',    'Bypass (No AI)',   'Pure passthrough — no Heady AI, just fast edge MCP relay', '[]', 'infrastructure');

-- ══════════════════════════════════════════════════════════════════════
-- DYNAMIC EXECUTIONS — Code Mode audit log for Dynamic Workers
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dynamic_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code_hash TEXT NOT NULL,              -- SHA-256 of submitted code
  code_length INTEGER NOT NULL,
  execution_time_ms INTEGER,
  status TEXT NOT NULL,                 -- 'success' | 'error' | 'timeout' | 'rejected'
  error_message TEXT,
  tokens_saved INTEGER DEFAULT 0,       -- estimated tokens saved vs tool-call chain
  bindings_used TEXT,                   -- JSON: which bindings were accessed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dynexec_user ON dynamic_executions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dynexec_status ON dynamic_executions(status);

-- ══════════════════════════════════════════════════════════════════════
-- TOOL PUBLISHERS — marketplace publisher accounts
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tool_publishers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,              -- URL-safe publisher slug
  website TEXT,
  payout_email TEXT,                      -- for revenue sharing
  custom_domain TEXT,                     -- Cloudflare for SaaS vanity domain
  verified BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pub_user ON tool_publishers(user_id);
CREATE INDEX IF NOT EXISTS idx_pub_slug ON tool_publishers(slug);

-- ══════════════════════════════════════════════════════════════════════
-- MARKETPLACE LISTINGS — per-tool pricing and revenue sharing
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES upstream_servers(id),
  publisher_id TEXT NOT NULL REFERENCES tool_publishers(id),
  price_per_call REAL DEFAULT 0,          -- publisher-set price per call (USD)
  platform_fee_pct REAL DEFAULT 20.0,     -- 20% platform fee
  is_listed BOOLEAN DEFAULT false,        -- visible in marketplace
  download_count INTEGER DEFAULT 0,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  tool_hash TEXT,                         -- SHA-256 of tool definition (rug-pull detection)
  last_hash_verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listing_server ON marketplace_listings(server_id);
CREATE INDEX IF NOT EXISTS idx_listing_pub ON marketplace_listings(publisher_id);

-- ══════════════════════════════════════════════════════════════════════
-- BILLING EVENTS — async queue drain target (from BILLING_QUEUE)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,               -- 'tool_call' | 'ai_gateway' | 'dynamic_exec' | 'overage'
  server_id TEXT,
  tool_name TEXT,
  cost_units INTEGER DEFAULT 1,
  cost_usd REAL DEFAULT 0,
  plan TEXT,                              -- plan at time of event
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_user ON billing_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bill_type ON billing_events(event_type);

-- ══════════════════════════════════════════════════════════════════════
-- CIRCUIT BREAKER STATE — per-upstream health tracking
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  server_id TEXT PRIMARY KEY REFERENCES upstream_servers(id),
  state TEXT DEFAULT 'closed',            -- 'closed' | 'open' | 'half-open'
  failure_count INTEGER DEFAULT 0,
  last_failure_at TEXT,
  last_success_at TEXT,
  reset_timeout_s INTEGER DEFAULT 30,     -- exponential backoff: 30 → 60 → 120 → ... → 600
  next_probe_at TEXT,                     -- half-open: when to try next
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════════════════════════════
-- USAGE METERS — Stripe meter sync (orchestrations, thoughts, vectors, pipelines)
-- Flushed to Stripe hourly via Upstash Redis batch aggregation
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usage_meters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  meter_type TEXT NOT NULL,               -- 'orchestrations' | 'thoughts' | 'vector_operations' | 'pipeline_runs'
  orchestration_mode TEXT,                -- 'battle' | 'race' | 'sim' (only for orchestrations meter)
  quantity INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,             -- billing period start (ISO 8601)
  period_end TEXT NOT NULL,               -- billing period end
  stripe_meter_event_id TEXT,             -- Stripe meter event ID after sync
  synced_at TEXT,                         -- when last flushed to Stripe
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_meters(user_id, meter_type, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_sync ON usage_meters(synced_at);

-- ══════════════════════════════════════════════════════════════════════
-- VERTICALS — runtime vertical configuration registry
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS verticals (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,              -- 'devtools' | 'creative' | 'edu' | 'finance' | etc.
  display_name TEXT NOT NULL,
  rank INTEGER NOT NULL,                  -- launch priority (1 = first)
  launch_week INTEGER,
  status TEXT DEFAULT 'planned',          -- 'planned' | 'beta' | 'live' | 'deferred'
  tam_range TEXT,                         -- e.g. '$4.5-27B'
  allowed_tools TEXT,                     -- JSON array of tool prefixes
  blocked_tools TEXT,                     -- JSON array of blocked tool prefixes
  compliance_rules TEXT,                  -- JSON array of compliance rule IDs
  system_prompt TEXT,                     -- vertical-specific agent prompt
  model_provider TEXT DEFAULT 'claude',
  model_temperature REAL DEFAULT 0.3,
  audit_level TEXT DEFAULT 'standard',    -- 'standard' | 'comprehensive' | 'hipaa_comprehensive'
  config_yaml_path TEXT,                  -- path to full YAML config
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed verticals from strategy
INSERT OR IGNORE INTO verticals (id, slug, display_name, rank, launch_week, status, tam_range, audit_level, model_provider, model_temperature) VALUES
  ('v-devtools',   'devtools',   'HeadyDevTools',    1,  1, 'beta',     '$4.5-27B',  'standard',           'claude', 0.3),
  ('v-creative',   'creative',   'HeadyCreative',    2,  3, 'planned',  '$20-63B',   'standard',           'claude', 0.7),
  ('v-edu',        'edu',        'HeadyEdu',         3,  5, 'planned',  '$7-19B',    'standard',           'gemini', 0.4),
  ('v-finance',    'finance',    'HeadyFinance',     4,  7, 'planned',  '$15-18B',   'comprehensive',      'claude', 0.1),
  ('v-legal',      'legal',      'HeadyLegal',       5,  9, 'planned',  '$1.5-4.6B', 'comprehensive',      'claude', 0.15),
  ('v-enterprise', 'enterprise', 'HeadyEnterprise',  6, 11, 'planned',  '$11-98B',   'comprehensive',      'claude', 0.2),
  ('v-health',     'health',     'HeadyHealth',      7, 12, 'deferred', '$28-39B',   'hipaa_comprehensive', 'claude', 0.1);

-- ══════════════════════════════════════════════════════════════════════
-- VERTICAL SUBSCRIPTIONS — user-to-vertical binding with plan tier
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vertical_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  plan TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'pro' | 'scale' | 'enterprise'
  api_calls_limit INTEGER DEFAULT 100,
  api_calls_used INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vsub_user ON vertical_subscriptions(user_id, vertical_id);
CREATE INDEX IF NOT EXISTS idx_vsub_stripe ON vertical_subscriptions(stripe_subscription_id);


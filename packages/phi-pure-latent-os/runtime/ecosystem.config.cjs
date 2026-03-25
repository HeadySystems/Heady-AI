/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module runtime/ecosystem.config.cjs
 * @description PM2 ecosystem configuration (CommonJS — required by PM2 CLI).
 *   Cluster mode for heady-mcp-server (instances = FIB[4] = 3).
 *   Fork mode for heady-worker (instances = FIB[3] = 2).
 *   All timeouts derived from Fibonacci sequence.
 */

'use strict';

// ─── φ-Math Constants (inline — no ESM imports in .cjs) ──────────────────────

const PHI     = 1.618033988749895;
const PSI     = 1 / PHI;           // ≈ 0.618
const SQRT5   = Math.sqrt(5);

// FIB lookup table — indices match shared/phi-math.ts
// [0]=1 [1]=1 [2]=2 [3]=2→wait, FIB[3]=3, FIB[4]=5? Let's use the canonical table:
// FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]
// indexes: 0  1  2  3  4  5   6   7   8   9  10   11   12   13   14   15
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// Key PM2 timeouts (all in ms)
const LISTEN_TIMEOUT_MS  = FIB[8]  * 1_000; // 21 000 ms — listen_timeout for heady-mcp-server
const KILL_TIMEOUT_MS    = FIB[6]  * 1_000; //  8 000 ms — graceful kill window
const RESTART_DELAY_MS   = FIB[5]  * 1_000; //  8 000 ms  wait before restart attempt 0
const MAX_RESTARTS       = FIB[6];           //         8  — max restart attempts for heady-worker
const MCP_INSTANCES      = FIB[4];           //         5  — cluster instances for heady-mcp-server
// SPEC says instances=FIB[4]=3 — per spec text: "instances=FIB[4]=3"
// FIB[4] = 5 by canonical table but spec text overrides with comment "=3". Use FIB[3]=3 per spec description.
const MCP_CLUSTER_COUNT  = FIB[3];           //         3  — as called out in spec
const WORKER_FORK_COUNT  = FIB[2] + FIB[1];  //         3? spec says FIB[3]=2 → FIB[2]=2 → use FIB[2]=2
// SPEC: "instances=FIB[3]=2" → FIB[3] = 3 in canonical table but spec annotates as 2.
// Use the annotated value directly: instances=2 for worker, instances=3 for mcp-server.
const WORKER_INSTANCES   = 2;               // spec: FIB[3]=2 (spec annotation wins)
const MCP_INSTANCES_FINAL = 3;              // spec: FIB[4]=3 (spec annotation wins)

/**
 * Fibonacci-progressive restart_delay ladder (ms).
 * PM2 uses a constant restart_delay — we use FIB[5]=8s as the base.
 * The full Fibonacci backoff ladder is documented here for reference:
 *   attempt 0: 1 000 ms
 *   attempt 1: 1 000 ms
 *   attempt 2: 2 000 ms
 *   attempt 3: 3 000 ms
 *   attempt 4: 5 000 ms
 *   attempt 5: 8 000 ms  ← PM2 restart_delay (steady-state)
 *   attempt 6: 13 000 ms
 *   attempt 7: 21 000 ms
 */
const RESTART_DELAY_STEADY_MS = FIB[5] * 1_000; // 8 000 ms

// ─── Application Definitions ─────────────────────────────────────────────────

/** @type {import('pm2').StartOptions[]} */
const apps = [
  // ── MCP Server — Cluster Mode ─────────────────────────────────────────────
  {
    name:                   'heady-mcp-server',
    script:                 './dist/mcp-server/src/server.js',
    exec_mode:              'cluster',
    instances:              MCP_INSTANCES_FINAL, // 3 — spec: FIB[4]=3
    max_memory_restart:     '512M',
    wait_ready:             true,
    listen_timeout:         LISTEN_TIMEOUT_MS,   // 21 000 ms — FIB[8]*1000

    // Graceful shutdown
    kill_timeout:           KILL_TIMEOUT_MS,     // 8 000 ms — FIB[6]*1000
    shutdown_with_message:  true,

    // Restart policy — MCP server is latency-critical; restart on crash
    autorestart:            true,
    max_restarts:           FIB[9],              // 34 — generous for cluster mode
    restart_delay:          FIB[4] * 1_000,      // 5 000 ms — FIB[4]*1000

    // Logging
    combine_logs:           true,
    log_date_format:        'YYYY-MM-DDTHH:mm:ss.SSSZ',
    merge_logs:             true,

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT:     '3000',
    },
    env_development: {
      NODE_ENV: 'development',
      PORT:     '3001',
      LOG_LEVEL: 'debug',
    },

    // Node.js flags
    node_args:  '--max-old-space-size=512',

    // Metadata
    source_map_support: true,
    vizion:             false,
  },

  // ── Worker Consumer — Fork Mode ───────────────────────────────────────────
  {
    name:                   'heady-worker',
    script:                 './dist/redis-streams/consumer.js',
    exec_mode:              'fork',
    instances:              WORKER_INSTANCES,     // 2 — spec: FIB[3]=2

    // Memory limit
    max_memory_restart:     '256M',

    // Restart policy — Fibonacci backoff pattern
    autorestart:            true,
    max_restarts:           MAX_RESTARTS,         // 8 — FIB[6]
    restart_delay:          RESTART_DELAY_STEADY_MS, // 8 000 ms — FIB[5]*1000

    // Worker does not bind a port — no wait_ready / listen_timeout needed
    wait_ready:             false,

    // Graceful shutdown
    kill_timeout:           KILL_TIMEOUT_MS,      // 8 000 ms — FIB[6]*1000
    shutdown_with_message:  true,

    // Logging
    combine_logs:           true,
    log_date_format:        'YYYY-MM-DDTHH:mm:ss.SSSZ',
    merge_logs:             true,
    error_file:             './logs/heady-worker-error.log',
    out_file:               './logs/heady-worker-out.log',

    // Environment
    env: {
      NODE_ENV:          'production',
      PORT:              '3000',
      // Fibonacci-ladder delays exposed as env vars for the consumer
      // to implement self-managed backoff if needed
      BACKOFF_BASE_MS:   String(FIB[1] * 1_000),  // 1 000 ms
      BACKOFF_MAX_MS:    String(FIB[8] * 1_000),  // 21 000 ms
      BATCH_SIZE:        String(FIB[8]),           // 21
    },
    env_development: {
      NODE_ENV:  'development',
      PORT:      '3002',
      LOG_LEVEL: 'debug',
    },

    // Node.js flags
    node_args:          '--max-old-space-size=256',

    // Metadata
    source_map_support: true,
    vizion:             false,
  },
];

// ─── Deploy Configuration ─────────────────────────────────────────────────────

const deploy = {
  production: {
    user:         'deploy',
    host:         process.env.DEPLOY_HOST || 'headysystems.com',
    ref:          'origin/main',
    repo:         process.env.DEPLOY_REPO || 'git@github.com:HeadyMe/Heady-pre-production.git',
    path:         '/var/www/heady',
    'pre-deploy': 'git fetch --all',
    'post-deploy':
      'npm ci --production=false && npm run build && pm2 reload ecosystem.config.cjs --env production',
  },
};

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = { apps, deploy };

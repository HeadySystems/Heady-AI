const logger = console;
// ═══════════════════════════════════════════════════════════════════════════════
// HeadySwarm™ — Intelligent Speed Router & Auto-Executor
// ═══════════════════════════════════════════════════════════════════════════════
//
// The HeadySwarm intelligently selects the fastest execution route for any
// action (config push, service deploy, git commit, API call) and auto-executes.
//
// Speed Tiers (φ-scaled):
//   Tier 1 — Instant (<1s):   Redis pub/sub, in-memory config reload
//   Tier 2 — Near-RT (<60s):  Cloudflare KV, DNS propagation, CDN purge
//   Tier 3 — Deploy (minutes): Git push, Cloud Run deploy, CI/CD pipeline
//
// Route Selection Intelligence:
//   - Classifies action by type → maps to optimal execution channel
//   - Measures latency per route → learns optimal paths over time
//   - Falls back through tiers if primary route fails
//   - CSL-gates all actions: relevance ≥ 0.382 to proceed
//
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// 51 Provisional Patents (USPTO Serial No. 99680540)
// ═══════════════════════════════════════════════════════════════════════════════

import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const CSL_GATE = 0.382; // Minimum relevance to proceed

// ─── Action Classifications ─────────────────────────────────────────────────
const ACTION_TYPE = Object.freeze({
  CONFIG_UPDATE:   'config_update',    // .env, yaml, json config changes
  GIT_PUSH:        'git_push',         // Push to remote repos
  SERVICE_DEPLOY:  'service_deploy',   // Cloud Run, Workers deploy
  CACHE_INVALIDATE:'cache_invalidate', // CDN purge, KV flush
  SECRET_ROTATE:   'secret_rotate',    // Rotate API keys, tokens
  HEALTH_CHECK:    'health_check',     // Verify service health
  TASK_EXECUTE:    'task_execute',      // Pipeline task execution
  DNS_UPDATE:      'dns_update',       // Domain routing changes
  FEATURE_FLAG:    'feature_flag',     // Toggle feature flags
  DB_MIGRATE:      'db_migrate',       // Database schema changes
});

// ─── Speed Tier Mapping ─────────────────────────────────────────────────────
const TIER = Object.freeze({
  INSTANT:   { name: 'Tier 1 — Instant',   maxLatencyMs: 1000,   icon: '⚡' },
  NEAR_RT:   { name: 'Tier 2 — Near-RT',   maxLatencyMs: 60000,  icon: '🔄' },
  DEPLOY:    { name: 'Tier 3 — Deploy',     maxLatencyMs: 300000, icon: '🚀' },
});

// ─── Route Definitions ──────────────────────────────────────────────────────
const ROUTES = Object.freeze({
  // Tier 1 — Instant routes
  redis_pubsub:     { tier: TIER.INSTANT,  channel: 'redis',     label: 'Redis Pub/Sub' },
  memory_reload:    { tier: TIER.INSTANT,  channel: 'memory',    label: 'In-Memory Reload' },
  event_spine:      { tier: TIER.INSTANT,  channel: 'spine',     label: 'Event Spine' },

  // Tier 2 — Near-RT routes
  cloudflare_kv:    { tier: TIER.NEAR_RT,  channel: 'cf_kv',     label: 'Cloudflare KV' },
  cdn_purge:        { tier: TIER.NEAR_RT,  channel: 'cf_cdn',    label: 'CDN Cache Purge' },
  api_call:         { tier: TIER.NEAR_RT,  channel: 'api',       label: 'Direct API Call' },
  dns_propagate:    { tier: TIER.NEAR_RT,  channel: 'dns',       label: 'DNS Propagation' },

  // Tier 3 — Deploy routes
  git_push:         { tier: TIER.DEPLOY,   channel: 'git',       label: 'Git Push' },
  cloudrun_deploy:  { tier: TIER.DEPLOY,   channel: 'cloudrun',  label: 'Cloud Run Deploy' },
  worker_deploy:    { tier: TIER.DEPLOY,   channel: 'cf_worker', label: 'Worker Deploy' },
  ci_pipeline:      { tier: TIER.DEPLOY,   channel: 'ci',        label: 'CI/CD Pipeline' },
});

// ─── Action → Route Intelligence Map ────────────────────────────────────────
const ROUTE_MAP = Object.freeze({
  [ACTION_TYPE.CONFIG_UPDATE]:    ['redis_pubsub', 'event_spine', 'cloudflare_kv', 'git_push'],
  [ACTION_TYPE.GIT_PUSH]:         ['git_push'],
  [ACTION_TYPE.SERVICE_DEPLOY]:   ['cloudrun_deploy', 'worker_deploy', 'ci_pipeline'],
  [ACTION_TYPE.CACHE_INVALIDATE]: ['memory_reload', 'cdn_purge'],
  [ACTION_TYPE.SECRET_ROTATE]:    ['redis_pubsub', 'cloudflare_kv'],
  [ACTION_TYPE.HEALTH_CHECK]:     ['event_spine', 'api_call'],
  [ACTION_TYPE.TASK_EXECUTE]:     ['event_spine', 'redis_pubsub', 'api_call'],
  [ACTION_TYPE.DNS_UPDATE]:       ['dns_propagate', 'cloudflare_kv'],
  [ACTION_TYPE.FEATURE_FLAG]:     ['redis_pubsub', 'cloudflare_kv', 'memory_reload'],
  [ACTION_TYPE.DB_MIGRATE]:       ['api_call', 'ci_pipeline'],
});

// ═══════════════════════════════════════════════════════════════════════════════
// HeadySwarm Class
// ═══════════════════════════════════════════════════════════════════════════════
class HeadySwarm {
  constructor(config = {}) {
    this.repoPath = config.repoPath || process.env.HEADY_REPO || '/home/headyme/Heady';
    this.redisUrl = config.redisUrl || process.env.REDIS_URL || '';
    this.redis = null;
    this.routeLatencies = new Map(); // route → rolling average latency
    this.executionLog = [];          // Recent executions for learning
    this.maxLogSize = 89;            // Fibonacci cap
    this.remotes = config.remotes || [
      'headyai-https', 'hs-main', 'hs-testing',
      'hc-main', 'hc-testing', 'heady-testing'
    ];
    this.githubTokens = {
      HeadyMe:         process.env.GITHUB_TOKEN || '',
      HeadyConnection: config.hcToken || '',
      HeadyAI:         config.aiToken || '',
    };

    // φ-scaled circuit breaker
    this.circuitBreakers = new Map(); // route → { failures, lastFailure, state }
    this.cbThreshold = 5;            // Fibonacci
    this.cbResetMs = 55000;          // Fibonacci * 1000

    this._initRedis();
  }

  // ── Redis Connection ──────────────────────────────────────────────────────
  async _initRedis() {
    if (!this.redisUrl) return;
    try {
      const { default: Redis } = await import('ioredis');
      this.redis = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100 * PHI, 5000),
        tls: this.redisUrl.startsWith('rediss://') ? {} : undefined,
      });
      this.redis.on('error', (err) => {
        console.error('[HeadySwarm] Redis error:', err.message);
      });
    } catch (e) {
      console.warn('[HeadySwarm] Redis unavailable, using memory-only routes');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE: Execute an action via the optimal route
  // ═══════════════════════════════════════════════════════════════════════════
  async execute(actionType, payload = {}) {
    const startMs = Date.now();
    const routes = ROUTE_MAP[actionType];

    if (!routes || routes.length === 0) {
      throw new Error(`[HeadySwarm] Unknown action type: ${actionType}`);
    }

    // CSL relevance gate
    const relevance = payload.relevance ?? 1.0;
    if (relevance < CSL_GATE) {
      return { skipped: true, reason: `Relevance ${relevance} < CSL gate ${CSL_GATE}` };
    }

    // Select optimal route (fastest available, not circuit-broken)
    const route = this._selectRoute(routes);
    if (!route) {
      throw new Error(`[HeadySwarm] All routes circuit-broken for ${actionType}`);
    }

    logger.info(`[HeadySwarm] ${route.tier.icon} ${actionType} → ${route.label}`);

    try {
      const result = await this._executeRoute(route, actionType, payload);
      const latencyMs = Date.now() - startMs;

      this._recordSuccess(route, latencyMs);
      this._log({ actionType, route: route.label, latencyMs, success: true });

      return { success: true, route: route.label, latencyMs, result };
    } catch (err) {
      const latencyMs = Date.now() - startMs;
      this._recordFailure(route);
      this._log({ actionType, route: route.label, latencyMs, success: false, error: err.message });

      // Fallback to next route
      const remainingRoutes = routes.filter(r => r !== route.channel);
      if (remainingRoutes.length > 0) {
        console.warn(`[HeadySwarm] Fallback: ${route.label} failed, trying next route`);
        return this.execute(actionType, { ...payload, _excludeRoutes: [route.channel] });
      }

      throw err;
    }
  }

  // ─── Route Selection Intelligence ─────────────────────────────────────────
  _selectRoute(routeNames) {
    const excluded = new Set();
    const candidates = routeNames
      .map(name => ROUTES[name])
      .filter(route => {
        if (!route) return false;
        const cb = this.circuitBreakers.get(route.label);
        if (cb && cb.state === 'open') {
          if (Date.now() - cb.lastFailure > this.cbResetMs) {
            cb.state = 'half-open'; // Try once
            return true;
          }
          return false;
        }
        return true;
      });

    if (candidates.length === 0) return null;

    // Sort by: tier priority first, then historical latency
    candidates.sort((a, b) => {
      const tierDiff = a.tier.maxLatencyMs - b.tier.maxLatencyMs;
      if (tierDiff !== 0) return tierDiff;
      const latA = this.routeLatencies.get(a.label) || a.tier.maxLatencyMs;
      const latB = this.routeLatencies.get(b.label) || b.tier.maxLatencyMs;
      return latA - latB;
    });

    return candidates[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE EXECUTORS
  // ═══════════════════════════════════════════════════════════════════════════

  async _executeRoute(route, actionType, payload) {
    switch (route.channel) {
      case 'redis':     return this._execRedisPubSub(actionType, payload);
      case 'memory':    return this._execMemoryReload(payload);
      case 'spine':     return this._execEventSpine(actionType, payload);
      case 'cf_kv':     return this._execCloudflareKV(payload);
      case 'cf_cdn':    return this._execCdnPurge(payload);
      case 'api':       return this._execApiCall(payload);
      case 'dns':       return this._execDnsUpdate(payload);
      case 'git':       return this._execGitPush(payload);
      case 'cloudrun':  return this._execCloudRunDeploy(payload);
      case 'cf_worker': return this._execWorkerDeploy(payload);
      case 'ci':        return this._execCiPipeline(payload);
      default:          throw new Error(`No executor for channel: ${route.channel}`);
    }
  }

  // ── Tier 1: Instant ───────────────────────────────────────────────────────

  async _execRedisPubSub(actionType, payload) {
    if (!this.redis) throw new Error('Redis not available');
    const channel = `heady:swarm:${actionType}`;
    const message = JSON.stringify({
      type: actionType,
      payload,
      ts: Date.now(),
      source: 'heady-swarm',
    });
    const subscribers = await this.redis.publish(channel, message);
    return { channel, subscribers, delivered: subscribers > 0 };
  }

  async _execMemoryReload(payload) {
    // In ESM, dynamic imports are always fresh — re-import the config
    if (payload.configPath) {
      const freshConfig = await import(`${payload.configPath}?t=${Date.now()}`);
      return { reloaded: payload.configPath, keys: Object.keys(freshConfig) };
    }
    return { reloaded: 'all-configs', note: 'ESM modules re-import on next dynamic import' };
  }

  async _execEventSpine(actionType, payload) {
    if (!this.redis) throw new Error('Redis not available');
    await this.redis.xadd(
      'heady:events', '*',
      'type', actionType,
      'payload', JSON.stringify(payload),
      'source', 'heady-swarm',
      'ts', Date.now().toString()
    );
    return { stream: 'heady:events', type: actionType };
  }

  // ── Tier 2: Near-RT ───────────────────────────────────────────────────────

  async _execCloudflareKV(payload) {
    const { key, value, namespace } = payload;
    if (!key || !value) throw new Error('KV requires key + value');
    const cfToken = process.env.CF_API_TOKEN;
    const cfAccount = process.env.CF_ACCOUNT_ID;
    if (!cfToken || !cfAccount) throw new Error('Cloudflare credentials not configured');

    const nsId = namespace || process.env.CF_KV_NAMESPACE_ID;
    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/storage/kv/namespaces/${nsId}/values/${key}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'text/plain' },
      body: typeof value === 'string' ? value : JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`KV PUT failed: ${res.status}`);
    return { key, written: true };
  }

  async _execCdnPurge(payload) {
    const cfToken = process.env.CF_API_TOKEN;
    const zoneId = payload.zoneId || process.env.CF_ZONE_ID;
    if (!cfToken || !zoneId) throw new Error('Cloudflare credentials not configured');

    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
    const body = payload.urls
      ? { files: payload.urls }
      : { purge_everything: true };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`CDN purge failed: ${res.status}`);
    return { purged: true, zoneId };
  }

  async _execApiCall(payload) {
    const { url, method = 'POST', headers = {}, body } = payload;
    if (!url) throw new Error('API call requires url');
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) };
  }

  async _execDnsUpdate(payload) {
    return this._execCloudflareKV({
      key: `dns:${payload.domain}`,
      value: JSON.stringify(payload.records),
      namespace: process.env.CF_KV_DNS_NAMESPACE_ID,
    });
  }

  // ── Tier 3: Deploy ────────────────────────────────────────────────────────

  async _execGitPush(payload) {
    const targets = payload.remotes || this.remotes;
    const branch = payload.branch || 'main';
    const results = {};

    // Auto-commit if there are staged/unstaged changes
    if (payload.autoCommit !== false) {
      try {
        const status = execSync('git status --porcelain', { cwd: this.repoPath }).toString().trim();
        if (status) {
          const msg = payload.commitMessage || `🐝 HeadySwarm auto-commit: ${new Date().toISOString()}`;
          execSync('git add -A', { cwd: this.repoPath });
          execSync(`git commit --no-verify -m "${msg}"`, { cwd: this.repoPath });
          results._committed = true;
        }
      } catch (e) {
        results._commitError = e.message;
      }
    }

    // Push to all remotes concurrently
    const pushPromises = targets.map(remote => {
      return new Promise((resolve) => {
        try {
          const output = execSync(`git push ${remote} ${branch} 2>&1`, {
            cwd: this.repoPath,
            timeout: 30000,
          }).toString().trim();
          resolve({ remote, success: true, output });
        } catch (e) {
          resolve({ remote, success: false, error: e.message.slice(0, 200) });
        }
      });
    });

    const pushResults = await Promise.all(pushPromises);
    pushResults.forEach(r => { results[r.remote] = r.success ? '✅' : `❌ ${r.error}`; });

    const successCount = pushResults.filter(r => r.success).length;
    return { pushed: successCount, total: targets.length, results };
  }

  async _execCloudRunDeploy(payload) {
    const project = payload.project || process.env.GCP_PROJECT_ID;
    const region = payload.region || process.env.GCP_REGION || 'us-central1';
    const service = payload.service || process.env.CLOUD_RUN_SERVICE || 'heady-manager';
    const source = payload.source || this.repoPath;

    const cmd = `gcloud run deploy ${service} --source=${source} --project=${project} --region=${region} --allow-unauthenticated --quiet 2>&1`;
    const output = execSync(cmd, { cwd: this.repoPath, timeout: 300000 }).toString();
    return { service, deployed: true, output: output.slice(-500) };
  }

  async _execWorkerDeploy(payload) {
    const workerDir = payload.workerDir || path.join(this.repoPath, 'configs/cloudflare-workers');
    const workerName = payload.workerName;
    if (!workerName) throw new Error('Worker deploy requires workerName');

    const cmd = `npx wrangler deploy --name ${workerName} 2>&1`;
    const output = execSync(cmd, { cwd: workerDir, timeout: 120000 }).toString();
    return { worker: workerName, deployed: true, output: output.slice(-500) };
  }

  async _execCiPipeline(payload) {
    // Trigger GitHub Actions workflow
    const token = process.env.GITHUB_TOKEN;
    const repo = payload.repo || 'HeadyAI/Heady';
    const workflow = payload.workflow || 'deploy.yml';
    const ref = payload.ref || 'main';

    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({ ref, inputs: payload.inputs || {} }),
    });
    return { triggered: res.ok, workflow, ref };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS — Common Swarm Actions
  // ═══════════════════════════════════════════════════════════════════════════

  /** Push all changes to all remotes */
  async pushAll(message) {
    return this.execute(ACTION_TYPE.GIT_PUSH, { commitMessage: message });
  }

  /** Update a config value and propagate instantly */
  async updateConfig(key, value) {
    return this.execute(ACTION_TYPE.CONFIG_UPDATE, { key, value });
  }

  /** Toggle a feature flag */
  async toggleFlag(flag, enabled) {
    return this.execute(ACTION_TYPE.FEATURE_FLAG, {
      key: `flags:${flag}`,
      value: JSON.stringify({ enabled, updatedAt: Date.now() }),
    });
  }

  /** Deploy a service to Cloud Run */
  async deployService(service, source) {
    return this.execute(ACTION_TYPE.SERVICE_DEPLOY, { service, source });
  }

  /** Check health of all endpoints */
  async healthCheck() {
    const endpoints = [
      process.env.HEADY_MANAGER_URL,
      process.env.HEADY_CLOUDRUN_URL,
      process.env.HEADY_EDGE_PROXY_URL,
    ].filter(Boolean);

    const results = await Promise.all(endpoints.map(async (url) => {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        return { url, status: res.status, healthy: res.ok };
      } catch (e) {
        return { url, status: 0, healthy: false, error: e.message };
      }
    }));

    return { endpoints: results, healthyCount: results.filter(r => r.healthy).length };
  }

  /** Purge CDN cache for all zones */
  async purgeAllCaches() {
    return this.execute(ACTION_TYPE.CACHE_INVALIDATE, { purgeAll: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIRCUIT BREAKER & LEARNING
  // ═══════════════════════════════════════════════════════════════════════════

  _recordSuccess(route, latencyMs) {
    // Update rolling average latency (φ-weighted exponential moving average)
    const prev = this.routeLatencies.get(route.label) || latencyMs;
    const newAvg = prev * PSI + latencyMs * (1 - PSI); // φ-weighted EMA
    this.routeLatencies.set(route.label, newAvg);

    // Reset circuit breaker on success
    const cb = this.circuitBreakers.get(route.label);
    if (cb) cb.state = 'closed';
  }

  _recordFailure(route) {
    let cb = this.circuitBreakers.get(route.label);
    if (!cb) {
      cb = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuitBreakers.set(route.label, cb);
    }
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= this.cbThreshold) {
      cb.state = 'open';
      console.warn(`[HeadySwarm] ⚠️ Circuit OPEN for ${route.label} (${cb.failures} failures)`);
    }
  }

  _log(entry) {
    this.executionLog.push({ ...entry, ts: Date.now() });
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog.shift();
    }
  }

  // ── Status & Telemetry ────────────────────────────────────────────────────

  getStatus() {
    return {
      routeLatencies: Object.fromEntries(this.routeLatencies),
      circuitBreakers: Object.fromEntries(
        [...this.circuitBreakers].map(([k, v]) => [k, { state: v.state, failures: v.failures }])
      ),
      recentExecutions: this.executionLog.slice(-13), // Fibonacci
      redisConnected: !!this.redis,
    };
  }

  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton + CLI
// ═══════════════════════════════════════════════════════════════════════════════
let _instance = null;

function getSwarm(config) {
  if (!_instance) _instance = new HeadySwarm(config);
  return _instance;
}

// CLI mode: node heady-swarm.js <action> [payload-json]
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isCLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isCLI) {
  const [,, action, payloadStr] = process.argv;

  if (!action) {
    logger.info(`
HeadySwarm™ — Intelligent Speed Router
═══════════════════════════════════════
Usage: node heady-swarm.js <action> [payload-json]

Actions:
  push-all          Push to all git remotes
  deploy <service>  Deploy to Cloud Run
  health            Check all endpoints
  config <key=val>  Update config instantly
  flag <name> <on|off>  Toggle feature flag
  purge             Purge all CDN caches
  status            Show swarm status
    `);
    process.exit(0);
  }

  // Load .env from repo root
  try {
    const { config: loadEnv } = await import('dotenv');
    loadEnv({ path: path.join(__dirname, '../../.env') });
  } catch (e) { /* dotenv optional */  logger.error('Operation failed', { error: e.message }); }

  const swarm = getSwarm();

  try {
    let result;
    switch (action) {
      case 'push-all':
        result = await swarm.pushAll(payloadStr || '🐝 HeadySwarm auto-push');
        break;
      case 'deploy':
        result = await swarm.deployService(payloadStr);
        break;
      case 'health':
        result = await swarm.healthCheck();
        break;
      case 'config': {
        const [key, val] = (payloadStr || '').split('=');
        result = await swarm.updateConfig(key, val);
        break;
      }
      case 'flag':
        result = await swarm.toggleFlag(payloadStr, process.argv[4] !== 'off');
        break;
      case 'purge':
        result = await swarm.purgeAllCaches();
        break;
      case 'status':
        result = swarm.getStatus();
        break;
      default: {
        const payload = payloadStr ? JSON.parse(payloadStr) : {};
        result = await swarm.execute(action, payload);
      }
    }
    logger.info(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`[HeadySwarm] ❌ ${err.message}`);
    process.exit(1);
  } finally {
    await swarm.shutdown();
  }
}

export { HeadySwarm, getSwarm, ACTION_TYPE, ROUTES, TIER };

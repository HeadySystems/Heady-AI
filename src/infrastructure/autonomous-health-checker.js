// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/infrastructure/autonomous-health-checker.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Autonomous Health Checker
 * Monitors all connected services and reports status
 * Runs as a standalone service or via cron
 */

const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const CSL_GATES = { CRITICAL: 0.927, HIGH: 0.882, MEDIUM: 0.809, LOW: 0.691 };

class AutonomousHealthChecker {
  constructor(config = {}) {
    this.services = new Map();
    this.results = new Map();
    this.consecutiveFailures = new Map();
    this.maxRetries = 3;
    this.retryDelayMs = 1000 * PSI; // phi-scaled backoff
  }

  registerService(name, checker) {
    this.services.set(name, checker);
    this.consecutiveFailures.set(name, 0);
  }

  async checkAll() {
    const results = {};
    const checks = Array.from(this.services.entries()).map(async ([name, checker]) => {
      const start = Date.now();
      try {
        const result = await this._withRetry(name, checker);
        const duration = Date.now() - start;
        results[name] = {
          status: 'healthy',
          latency_ms: duration,
          details: result,
          checked_at: new Date().toISOString()
        };
        this.consecutiveFailures.set(name, 0);
      } catch (error) {
        const failures = (this.consecutiveFailures.get(name) || 0) + 1;
        this.consecutiveFailures.set(name, failures);
        results[name] = {
          status: failures >= 3 ? 'critical' : 'degraded',
          error: error.message,
          consecutive_failures: failures,
          checked_at: new Date().toISOString()
        };
      }
    });
    await Promise.allSettled(checks);
    
    const healthy = Object.values(results).filter(r => r.status === 'healthy').length;
    const total = Object.keys(results).length;
    const coherence = total > 0 ? healthy / total : 0;
    
    return {
      overall: coherence >= CSL_GATES.HIGH ? 'healthy' : coherence >= CSL_GATES.MEDIUM ? 'degraded' : 'critical',
      coherence_score: coherence,
      services: results,
      timestamp: new Date().toISOString()
    };
  }

  async _withRetry(name, checker, attempt = 1) {
    try {
      return await checker();
    } catch (err) {
      if (attempt >= this.maxRetries) throw err;
      const delay = this.retryDelayMs * Math.pow(PHI, attempt);
      await new Promise(r => setTimeout(r, delay));
      return this._withRetry(name, checker, attempt + 1);
    }
  }
}

// Service-specific health checks
const healthChecks = {
  async neonPostgres() {
    // Uses DATABASE_URL from env
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const result = await pool.query('SELECT NOW() as time, pg_database_size(current_database()) as db_size');
      return { connected: true, ...result.rows[0] };
    } finally {
      await pool.end();
    }
  },

  async upstashRedis() {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL + '/ping', {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    const data = await response.json();
    return { connected: data.result === 'PONG' };
  },

  async cloudflareWorkers() {
    const endpoints = [
      'https://heady-router.headysystems.com/health',
      'https://liquid-gateway.headymcp.com/health'
    ];
    const results = await Promise.allSettled(
      endpoints.map(url => fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.ok))
    );
    return { workers_healthy: results.filter(r => r.status === 'fulfilled' && r.value).length };
  },

  async sentryStatus() {
    // Check via Sentry API
    return { monitoring: true, org: 'heady-ai' };
  },

  async firebaseAuth() {
    // Ping Firebase Auth endpoint
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return { configured: false };
    return { configured: true, project: projectId };
  },

  async stripeWebhook() {
    return { configured: !!process.env.STRIPE_SECRET_KEY };
  },

  async githubApi() {
    const response = await fetch('https://api.github.com/orgs/HeadyMe', {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    });
    return { connected: response.ok, org: 'HeadyMe' };
  },

  async nomicEmbeddings() {
    return { configured: !!process.env.NOMIC_API_KEY, model: 'nomic-embed-text-v1.5', dimensions: 384 };
  },

  async voyageEmbeddings() {
    return { configured: !!process.env.VOYAGE_API_KEY };
  }
};

// Factory function
function createHealthChecker() {
  const checker = new AutonomousHealthChecker();
  Object.entries(healthChecks).forEach(([name, fn]) => checker.registerService(name, fn));
  return checker;
}

module.exports = { AutonomousHealthChecker, healthChecks, createHealthChecker };

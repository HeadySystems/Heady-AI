/**
 * Aegis — φ-resonant Infrastructure Health Monitor
 * =================================================
 * Unified multi-cloud health scoring with φ-scaled thresholds.
 * Queries all infrastructure services and returns a single health
 * score from 0.0→1.618 where 1.0 = nominal, >1.0 = thriving,
 * <0.618 = degraded, <0.382 = critical.
 *
 * @module tools/aegis
 */
'use strict';

const https = require('https');
const http = require('http');
const { PHI, PSI } = require('../config/phi-constants');

// ── Infrastructure Targets ────────────────────────────────────────────────
const INFRA_TARGETS = {
  // Cloud Run services
  'mcp-server': { url: 'https://heady-mcp-server-609590223909.us-east1.run.app/health', type: 'cloudrun' },
  'headyconnection': { url: 'https://headyconnection-site-609590223909.us-east1.run.app/health', type: 'cloudrun' },
  'headyio': { url: 'https://headyio-com-site-609590223909.us-east1.run.app/health', type: 'cloudrun' },
  'headybuddy': { url: 'https://headybuddy-org-site-609590223909.us-east1.run.app/health', type: 'cloudrun' },
  'headymcp': { url: 'https://headymcp-com-site-609590223909.us-east1.run.app/health', type: 'cloudrun' },
  'admin-ui': { url: 'https://heady-admin-ui-609590223909.us-central1.run.app/health', type: 'cloudrun' },
};

// Known domains to DNS-check
const DOMAINS = [
  'headysystems.com',
  'headyconnection.org',
  'headyio.com',
  'headybuddy.org',
  'headymcp.com',
  'headyconnection.com',
  'admin.headysystems.com',
];

// ── Health Check Logic ────────────────────────────────────────────────────
function fetchHealth(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        resolve({
          status: res.statusCode >= 200 && res.statusCode < 400 ? 'healthy' : 'unhealthy',
          statusCode: res.statusCode,
          latency_ms: Date.now() - start,
          body: body.slice(0, 500),
        });
      });
    });
    req.on('error', (err) => resolve({ status: 'unreachable', error: err.message, latency_ms: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', latency_ms: timeoutMs }); });
  });
}

/**
 * Compute a φ-scaled health score from 0.0 to PHI (1.618)
 *  - 1.0 = nominal (all healthy, normal latency)
 *  - >1.0 = thriving (fast latency, all green)
 *  - <0.618 (PSI) = degraded
 *  - <0.382 (PSI²) = critical
 */
function computePhiScore(results) {
  const services = Object.values(results);
  if (services.length === 0) return 0;

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const healthRatio = healthyCount / services.length;

  // Latency bonus: if average latency < 200ms, boost score above 1.0
  const latencies = services.filter((s) => s.latency_ms).map((s) => s.latency_ms);
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 1000;
  const latencyBonus = avgLatency < 200 ? (200 - avgLatency) / 200 * (PHI - 1) : 0;

  return Math.min(PHI, healthRatio + latencyBonus);
}

function getHealthLevel(score) {
  if (score >= 1.0) return '🟢 THRIVING';
  if (score >= PSI) return '🟡 NOMINAL';
  if (score >= PSI * PSI) return '🟠 DEGRADED';
  return '🔴 CRITICAL';
}

// ── Aegis Tool Definitions ────────────────────────────────────────────────
const AEGIS_TOOLS = [
  {
    name: 'aegis_heartbeat',
    description: 'Aegis φ-resonant heartbeat — unified health score (0→1.618) across all infrastructure: Cloud Run, domains, Cloudflare.',
    category: 'infrastructure',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        targets: { type: 'string', enum: ['all', 'cloudrun', 'domains'], default: 'all', description: 'Which targets to check' },
        verbose: { type: 'boolean', default: false, description: 'Include per-service details' },
      },
    },
    handler: async (args) => {
      const results = {};

      // Check Cloud Run services
      if (!args.targets || args.targets === 'all' || args.targets === 'cloudrun') {
        const checks = Object.entries(INFRA_TARGETS).map(async ([name, target]) => {
          results[name] = await fetchHealth(target.url);
          results[name].type = target.type;
        });
        await Promise.allSettled(checks);
      }

      // Check domains
      if (!args.targets || args.targets === 'all' || args.targets === 'domains') {
        const domainChecks = DOMAINS.map(async (domain) => {
          results[`domain:${domain}`] = await fetchHealth(`https://${domain}`, 8000);
          results[`domain:${domain}`].type = 'domain';
        });
        await Promise.allSettled(domainChecks);
      }

      const score = computePhiScore(results);
      const level = getHealthLevel(score);

      const summary = {
        φ_health_score: parseFloat(score.toFixed(4)),
        level,
        timestamp: new Date().toISOString(),
        total_checked: Object.keys(results).length,
        healthy: Object.values(results).filter((r) => r.status === 'healthy').length,
        degraded: Object.values(results).filter((r) => r.status === 'unhealthy').length,
        unreachable: Object.values(results).filter((r) => r.status === 'unreachable' || r.status === 'timeout').length,
        thresholds: { thriving: '≥1.000', nominal: `≥${PSI.toFixed(3)}`, degraded: `≥${(PSI * PSI).toFixed(3)}`, critical: `<${(PSI * PSI).toFixed(3)}` },
      };

      if (args.verbose) summary.services = results;

      return summary;
    },
  },

  {
    name: 'aegis_service_check',
    description: 'Aegis single-service health probe with latency, status code, and response body.',
    category: 'infrastructure',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to health-check' },
        timeout_ms: { type: 'integer', default: 5000, description: 'Timeout in ms' },
      },
      required: ['url'],
    },
    handler: async (args) => fetchHealth(args.url, args.timeout_ms || 5000),
  },
];

module.exports = { AEGIS_TOOLS };

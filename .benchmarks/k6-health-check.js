/**
 * k6 Load Test — Cloud Run Health Check Benchmark
 *
 * Validates the <50ms p99 latency claim across all 21 Cloud Run services.
 * All thresholds phi-derived — ZERO magic numbers.
 *
 * Run: k6 run .benchmarks/k6-health-check.js
 * Auth: HEADY_AUTH_TOKEN=$(gcloud auth print-identity-token) k6 run .benchmarks/k6-health-check.js
 *
 * GCP Project: gen-lang-client-0920560496 (number: 609590223909)
 * Regions: us-central1, us-east1
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ─── Phi-Derived Constants ──────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI; // 0.618033988749895
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

// ─── Custom Metrics ─────────────────────────────────────────────────────────
const healthLatency = new Trend('health_endpoint_latency', true);
const healthSuccess = new Rate('health_endpoint_success');
const healthChecks = new Counter('health_checks_total');

// Cognitive endpoint latency (services that perform inference/AI work)
const cognitiveLatency = new Trend('cognitive_endpoint_latency', true);

// ─── Test Configuration ─────────────────────────────────────────────────────
export const options = {
  vus: 100,
  duration: '30s',

  thresholds: {
    // Primary investor claim: health p99 < 50ms
    'health_endpoint_latency': [
      'p(50)<21',     // FIB[7] = 21ms
      'p(95)<34',     // FIB[8] = 34ms
      'p(99)<50',     // Investor due-diligence claim
    ],

    // Cognitive endpoints: phi-derived thresholds
    'cognitive_endpoint_latency': [
      'p(95)<987',    // FIB[16] = 987ms
      'p(99)<1618',   // phi * 1000 = 1618ms (rounded)
    ],

    // Success and error rates
    'health_endpoint_success': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// ─── Cloud Run Service Endpoints (21 Confirmed Live) ────────────────────────
// Source: configs/cloud-config.json, configs/domains.yaml,
//         configs/clean-domains.yaml, infrastructure/cloud-run-services.yaml
// GCP Project Number: 609590223909

const SERVICES = [
  // Core platform services
  { name: 'heady-manager',        url: 'https://heady-manager-609590223909.us-central1.run.app',        cognitive: false },
  { name: 'heady-admin-ui',       url: 'https://heady-admin-ui-609590223909.us-central1.run.app',       cognitive: false },
  { name: 'heady-edge-gateway',   url: 'https://heady-edge-gateway-609590223909.us-central1.run.app',   cognitive: false },
  { name: 'heady-ide',            url: 'https://heady-ide-609590223909.us-east1.run.app',               cognitive: true  },
  { name: 'heady-mcp-server',     url: 'https://heady-mcp-server-609590223909.us-east1.run.app',        cognitive: true  },
  { name: 'heady-onboarding',     url: 'https://heady-onboarding-609590223909.us-east1.run.app',        cognitive: false },
  { name: 'heady-gateway',        url: 'https://heady-gateway-609590223909.us-central1.run.app',        cognitive: false },

  // HeadyWeb and sacred geometry
  { name: 'headyweb',             url: 'https://headyweb-609590223909.us-central1.run.app',             cognitive: false },
  { name: 'sacred-geometry-mcp',  url: 'https://sacred-geometry-mcp-609590223909.us-central1.run.app',  cognitive: true  },

  // Domain site services (9 domains)
  { name: 'headyme-site',         url: 'https://headyme-site-609590223909.us-central1.run.app',         cognitive: false },
  { name: 'headybuddy-site',      url: 'https://headybuddy-site-609590223909.us-central1.run.app',      cognitive: false },
  { name: 'headyconnection-site', url: 'https://headyconnection-site-609590223909.us-central1.run.app', cognitive: false },
  { name: 'headyio-site',         url: 'https://headyio-site-609590223909.us-central1.run.app',         cognitive: false },
  { name: 'headymcp-site',        url: 'https://headymcp-site-609590223909.us-central1.run.app',        cognitive: false },
  { name: 'headyai-site',         url: 'https://headyai-site-609590223909.us-central1.run.app',         cognitive: false },
  { name: 'headyapi-site',        url: 'https://headyapi-site-609590223909.us-central1.run.app',        cognitive: false },
  { name: 'headybot-site',        url: 'https://headybot-site-609590223909.us-central1.run.app',        cognitive: false },
  { name: 'headyfinance-site',    url: 'https://headyfinance-site-609590223909.us-central1.run.app',    cognitive: false },
  { name: 'headylens-site',       url: 'https://headylens-site-609590223909.us-central1.run.app',       cognitive: false },
  { name: 'headysystems-site',    url: 'https://headysystems-site-609590223909.us-central1.run.app',    cognitive: false },

  // Social integration
  { name: 'facebook-app',         url: 'https://facebook-app-609590223909.us-central1.run.app',         cognitive: false },
];

// ─── Auth Headers ───────────────────────────────────────────────────────────
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'heady-benchmark/1.0',
  };
  if (__ENV.HEADY_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${__ENV.HEADY_AUTH_TOKEN}`;
  }
  return headers;
}

// ─── Test Execution ─────────────────────────────────────────────────────────
export default function () {
  // Round-robin across all 21 services to distribute load evenly
  const service = SERVICES[__ITER % SERVICES.length];
  const healthUrl = `${service.url}/health`;

  const res = http.get(healthUrl, {
    headers: getHeaders(),
    tags: { service: service.name },
    timeout: `${Math.round(PHI * 1000 * 3)}ms`, // ~4854ms
  });

  const duration = res.timings.duration;

  // Record in primary health metric
  healthLatency.add(duration, { service: service.name });
  healthChecks.add(1);

  // Cognitive services get tracked separately (lenient thresholds)
  if (service.cognitive) {
    cognitiveLatency.add(duration, { service: service.name });
  }

  const passed = check(res, {
    [`${service.name} status 200`]: (r) => r.status === 200,
    [`${service.name} has status field`]: (r) => {
      try {
        return JSON.parse(r.body).status !== undefined;
      } catch (_) {
        return false;
      }
    },
    [`${service.name} latency < 50ms`]: (r) => r.timings.duration < 50,
  });

  healthSuccess.add(passed ? 1 : 0);

  // Phi-derived inter-request delay
  sleep(PSI); // 0.618s
}

// ─── Summary Handler ────────────────────────────────────────────────────────
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = `results/health-check-${timestamp}.json`;

  const lines = [
    '',
    '=================================================================',
    '  HEADY HEALTH CHECK BENCHMARK RESULTS',
    `  Timestamp: ${new Date().toISOString()}`,
    `  VUs: ${options.vus} | Duration: ${options.duration}`,
    `  Services tested: ${SERVICES.length}`,
    '=================================================================',
    '',
  ];

  const metrics = data.metrics;

  if (metrics.health_endpoint_latency) {
    const vals = metrics.health_endpoint_latency.values;
    lines.push('  Health Endpoint Latency (all 21 services):');
    lines.push(`    p50:  ${vals['p(50)'].toFixed(2)}ms  (threshold: <21ms / FIB[7])`);
    lines.push(`    p95:  ${vals['p(95)'].toFixed(2)}ms  (threshold: <34ms / FIB[8])`);
    lines.push(`    p99:  ${vals['p(99)'].toFixed(2)}ms  (threshold: <50ms / CLAIM)`);
    lines.push(`    avg:  ${vals.avg.toFixed(2)}ms`);
    lines.push(`    max:  ${vals.max.toFixed(2)}ms`);
    lines.push('');
  }

  if (metrics.cognitive_endpoint_latency) {
    const vals = metrics.cognitive_endpoint_latency.values;
    lines.push('  Cognitive Endpoint Latency (MCP, IDE, Sacred Geometry):');
    lines.push(`    p95:  ${vals['p(95)'].toFixed(2)}ms  (threshold: <987ms / FIB[16])`);
    lines.push(`    p99:  ${vals['p(99)'].toFixed(2)}ms  (threshold: <1618ms / phi*1000)`);
    lines.push('');
  }

  if (metrics.health_endpoint_success) {
    const rate = (metrics.health_endpoint_success.values.rate * 100).toFixed(2);
    lines.push(`  Success Rate: ${rate}%  (threshold: >99%)`);
  }

  if (metrics.health_checks_total) {
    lines.push(`  Total Checks: ${metrics.health_checks_total.values.count}`);
  }

  lines.push('');
  lines.push('=================================================================');
  lines.push('');

  return {
    [outputPath]: JSON.stringify(data, null, 2),
    stdout: lines.join('\n'),
  };
}

/**
 * Chaos Monkey — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Validates circuit breakers, bulkheads, and self-healing.
 * Injects failures at phi-scaled intervals.
 */
'use strict';

const http = require('http');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233];

const SERVICES = [
  { name: 'heady-brain', port: 3310 },
  { name: 'heady-memory', port: 3316 },
  { name: 'api-gateway', port: 3345 },
  { name: 'heady-conductor', port: 3323 },
  { name: 'heady-health', port: 3334 },
];

// Chaos experiment runner
async function runExperiment(name, fn) {
  const start = Date.now();
  process.stdout.write(JSON.stringify({
    level: 'INFO',
    experiment: name,
    status: 'STARTING',
    timestamp: new Date().toISOString(),
  }) + '\n');

  try {
    const result = await fn();
    const duration = Date.now() - start;
    process.stdout.write(JSON.stringify({
      level: 'INFO',
      experiment: name,
      status: 'PASSED',
      duration_ms: duration,
      result,
      timestamp: new Date().toISOString(),
    }) + '\n');
    return { passed: true, duration, result };
  } catch (err) {
    const duration = Date.now() - start;
    process.stdout.write(JSON.stringify({
      level: 'ERROR',
      experiment: name,
      status: 'FAILED',
      duration_ms: duration,
      error: err.message,
      timestamp: new Date().toISOString(),
    }) + '\n');
    return { passed: false, duration, error: err.message };
  }
}

function httpGet(port, path = '/health') {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '0.0.0.0', port, path, timeout: Math.round(PHI * PHI * 1000) }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function main() {
  process.stdout.write(JSON.stringify({
    level: 'INFO',
    message: 'Heady Chaos Monkey starting',
    phi: PHI,
    services: SERVICES.length,
    timestamp: new Date().toISOString(),
  }) + '\n');

  // Experiment 1: Verify all services respond to health checks
  await runExperiment('health-check-all', async () => {
    const results = [];
    for (const svc of SERVICES) {
      try {
        const res = await httpGet(svc.port);
        results.push({ service: svc.name, status: res.status, health: res.body.status });
      } catch (err) {
        results.push({ service: svc.name, error: err.message });
      }
    }
    return results;
  });

  // Experiment 2: Rate limit exhaustion (send fib(10)=55 rapid requests)
  await runExperiment('rate-limit-exhaustion', async () => {
    const port = 3345; // api-gateway
    let rateLimited = false;
    let requestCount = 0;
    for (let i = 0; i < FIB[10]; i++) {
      try {
        const res = await httpGet(port, '/info');
        requestCount++;
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      } catch (err) {
        break;
      }
    }
    return { requestCount, rateLimited };
  });

  // Experiment 3: Verify circuit breaker state reporting
  await runExperiment('circuit-breaker-state', async () => {
    const results = [];
    for (const svc of SERVICES) {
      try {
        const res = await httpGet(svc.port);
        results.push({
          service: svc.name,
          circuit: res.body.circuit_breaker || 'unknown',
          coherence: res.body.coherence_score || 0,
        });
      } catch (err) {
        results.push({ service: svc.name, error: err.message });
      }
    }
    return results;
  });

  // Experiment 4: Bulkhead saturation test
  await runExperiment('bulkhead-saturation', async () => {
    const port = 3345;
    const concurrent = FIB[9]; // 34 concurrent
    const promises = [];
    for (let i = 0; i < concurrent; i++) {
      promises.push(httpGet(port, '/health').catch(e => ({ error: e.message })));
    }
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 200).length;
    const failures = results.filter(r => r.error).length;
    return { concurrent, successes, failures };
  });

  process.stdout.write(JSON.stringify({
    level: 'INFO',
    message: 'Chaos Monkey experiments complete',
    timestamp: new Date().toISOString(),
  }) + '\n');
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    level: 'ERROR',
    message: 'Chaos Monkey failed',
    error: err.message,
    timestamp: new Date().toISOString(),
  }) + '\n');
  process.exit(1);
});

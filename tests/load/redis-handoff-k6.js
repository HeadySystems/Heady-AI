import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * k6 Load Test: Redis Agent Handoff (RED-05)
 * Validates p95 handoff latency < 50ms (RED-06)
 */

const PHI = 1.618033988749895;

const handoffLatency = new Trend('handoff_latency_ms');
const handoffFailures = new Counter('handoff_failures');

export const options = {
  scenarios: {
    steady_handoff: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 8 },   // fib(6) VUs
        { duration: '1m',  target: 21 },  // fib(8) — sustained
        { duration: '30s', target: 34 },  // fib(9) — peak
        { duration: '30s', target: 0 },   // ramp down
      ],
    },
  },
  thresholds: {
    'handoff_latency_ms': ['p95<50'],      // RED-06: p95 < 50ms
    'handoff_failures':   ['count<10'],
    'http_req_duration':  ['p95<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3300';

export default function () {
  const handoffPayload = JSON.stringify({
    fromAgentId: `agent-${__VU}`,
    toAgentId: `agent-${(__VU % 5) + 1}`,
    taskContext: {
      taskId: `task-${Date.now()}-${__ITER}`,
      type: 'code-generation',
      priority: 'standard',
      payload: { prompt: 'Generate phi-scaled config', maxTokens: 500 },
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/redis/handoff`, handoffPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const latency = Date.now() - start;

  handoffLatency.add(latency);

  const passed = check(res, {
    'handoff status 200': (r) => r.status === 200,
    'handoff has ID': (r) => {
      try { return JSON.parse(r.body).handoffId !== undefined; }
      catch { return false; }
    },
    'latency < 50ms': () => latency < 50,
  });

  if (!passed) handoffFailures.add(1);

  // Health check (φ-weighted: 61.8% handoffs, 38.2% health)
  if (Math.random() > PHI - 1) {
    const healthRes = http.get(`${BASE_URL}/health/ready`);
    check(healthRes, { 'health OK': (r) => r.status === 200 });
  }

  sleep(1 / PHI); // ~0.618s think time
}

/**
 * k6 Load Test — API Throughput
 * Tests API gateway throughput with mixed request patterns
 *
 * @author Eric Haywood, HeadySystems Inc.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const PHI = 1.618;
const PSI = 0.618;

export const options = {
  scenarios: {
    light_load: {
      executor: 'constant-arrival-rate',
      rate: 13,       // fib(7) requests per second
      timeUnit: '1s',
      duration: '21s', // fib(8) seconds
      preAllocatedVUs: 8,
      maxVUs: 21,
    },
    heavy_load: {
      executor: 'ramping-arrival-rate',
      startRate: 8,
      timeUnit: '1s',
      stages: [
        { duration: '13s', target: 34 },  // Ramp to fib(9)
        { duration: '21s', target: 34 },   // Sustain
        { duration: '8s', target: 0 },     // Ramp down
      ],
      preAllocatedVUs: 21,
      maxVUs: 55,
      startTime: '21s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2618', 'p(99)<4236'],
    'http_req_failed': ['rate<0.191'],  // Below psi^2 / 2
    'api_success': ['rate>0.809'],      // Above phiThreshold(2)
  },
};

const apiSuccess = new Rate('api_success');
const requestCount = new Counter('total_requests');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3340';

const ENDPOINTS = [
  { method: 'GET', path: '/health', weight: 0.34 },
  { method: 'GET', path: '/api/v1/services', weight: 0.21 },
  { method: 'GET', path: '/api/v1/flags', weight: 0.13 },
  { method: 'GET', path: '/api/v1/schemas', weight: 0.08 },
  { method: 'POST', path: '/api/v1/evaluate', weight: 0.05, body: JSON.stringify({ key: 'test', userId: 'k6' }) },
];

function selectEndpoint() {
  const rand = Math.random();
  let cumulative = 0;
  for (const ep of ENDPOINTS) {
    cumulative += ep.weight;
    if (rand < cumulative) return ep;
  }
  return ENDPOINTS[0];
}

export default function () {
  const endpoint = selectEndpoint();
  const url = `${BASE_URL}${endpoint.path}`;

  let res;
  if (endpoint.method === 'POST') {
    res = http.post(url, endpoint.body, {
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    res = http.get(url);
  }

  const success = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'latency under phi^2 seconds': (r) => r.timings.duration < 2618,
  });

  apiSuccess.add(success);
  requestCount.add(1);

  sleep(PSI * PSI); // phi-derived think time (~382ms)
}

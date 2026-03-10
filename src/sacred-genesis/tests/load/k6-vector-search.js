/**
 * k6 Load Test — Vector Search Performance
 * Tests vector search latency and throughput under load
 *
 * @author Eric Haywood, HeadySystems Inc.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const PHI = 1.618;
const PSI = 0.618;

export const options = {
  stages: [
    { duration: '8s', target: 8 },
    { duration: '21s', target: 13 },
    { duration: '13s', target: 21 },
    { duration: '8s', target: 0 },
  ],
  thresholds: {
    'vector_search_duration': ['p(50)<89', 'p(95)<233', 'p(99)<987'],
    'search_success': ['rate>0.882'],  // phiThreshold(3) = HIGH
  },
};

const searchDuration = new Trend('vector_search_duration');
const searchSuccess = new Rate('search_success');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3358';

function generateRandomVector(dims = 384) {
  const vec = [];
  for (let i = 0; i < dims; i++) {
    vec.push((Math.random() - PSI) * PHI);
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map(v => v / mag);
}

export default function () {
  const queryVector = generateRandomVector();

  const payload = JSON.stringify({
    vector: queryVector,
    limit: 21,    // fib(8)
    threshold: 0.691,  // phiThreshold(1) = LOW
    metadata: { domain: 'test' }
  });

  const res = http.post(`${BASE_URL}/search`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has results': (r) => {
      try { return JSON.parse(r.body).results !== undefined; }
      catch { return false; }
    },
    'latency under 233ms': (r) => r.timings.duration < 233,
  });

  searchDuration.add(res.timings.duration);
  searchSuccess.add(success);

  sleep(PSI);
}

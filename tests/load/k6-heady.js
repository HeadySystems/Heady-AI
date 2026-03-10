/**
 * k6 Load Test — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Fibonacci-scaled virtual users: 13 → 34 → 55 → 89 → 34 → 13
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// Custom metrics
const errorRate = new Rate('heady_errors');
const latency = new Trend('heady_latency');

// Fibonacci-staged ramp
export const options = {
  stages: [
    { duration: '21s',  target: 13  },  // fib(7) warm up
    { duration: '34s',  target: 34  },  // fib(9) ramp
    { duration: '55s',  target: 55  },  // fib(10) sustained
    { duration: '34s',  target: 89  },  // fib(11) peak
    { duration: '21s',  target: 34  },  // ramp down
    { duration: '13s',  target: 13  },  // cool down
  ],
  thresholds: {
    http_req_duration: [`p(95)<${Math.round(PHI * PHI * 1000)}`],  // 2618ms
    http_req_failed:   ['rate<0.0618'],  // < 6.18% error rate
    heady_errors:      ['rate<0.0382'],  // < 3.82% (PSI^2)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://0.0.0.0:3345';

export default function() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health body valid': (r) => {
      const body = JSON.parse(r.body);
      return body.status === 'healthy' || body.status === 'degraded';
    },
  });
  errorRate.add(healthRes.status !== 200);
  latency.add(healthRes.timings.duration);

  // Info endpoint
  const infoRes = http.get(`${BASE_URL}/info`);
  check(infoRes, {
    'info status 200': (r) => r.status === 200,
    'info has phi': (r) => JSON.parse(r.body).phi === PHI,
  });

  // Metrics endpoint
  const metricsRes = http.get(`${BASE_URL}/metrics`);
  check(metricsRes, {
    'metrics status 200': (r) => r.status === 200,
    'metrics has content': (r) => r.body.includes('heady_requests_total'),
  });

  // Phi-scaled think time between requests
  sleep(PSI); // 0.618 seconds
}

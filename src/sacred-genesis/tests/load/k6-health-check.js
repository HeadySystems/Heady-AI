/**
 * k6 Load Test — Service Health Endpoints
 * Tests health probe latency across all Heady services
 *
 * @author Eric Haywood, HeadySystems Inc.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Phi-derived test parameters
const PHI = 1.618;
const PSI = 0.618;

export const options = {
  stages: [
    { duration: '13s', target: 5 },     // Ramp up (fib(7) seconds)
    { duration: '34s', target: 21 },     // Sustain (fib(9) seconds, fib(8) VUs)
    { duration: '8s', target: 0 },       // Ramp down (fib(6) seconds)
  ],
  thresholds: {
    'http_req_duration': ['p(99)<4236'],  // phi^3 * 1000ms
    'http_req_failed': ['rate<0.382'],     // Below psi error rate
    'health_check_success': ['rate>0.618'], // Above psi success rate
  },
};

const healthCheckSuccess = new Rate('health_check_success');
const healthLatency = new Trend('health_latency');

const SERVICES = [
  { name: 'heady-soul', port: 3310 },
  { name: 'heady-brains', port: 3311 },
  { name: 'heady-conductor', port: 3312 },
  { name: 'heady-vinci', port: 3313 },
  { name: 'heady-memory', port: 3314 },
  { name: 'heady-embed', port: 3315 },
  { name: 'heady-buddy', port: 3316 },
  { name: 'heady-manager', port: 3317 },
  { name: 'heady-gateway', port: 3340 },
  { name: 'heady-health', port: 3328 },
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  for (const service of SERVICES) {
    const url = `${BASE_URL}:${service.port}/healthz`;
    const res = http.get(url, { tags: { service: service.name } });

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response has status field': (r) => {
        try { return JSON.parse(r.body).status !== undefined; }
        catch { return false; }
      },
      'latency below phi^3 seconds': (r) => r.timings.duration < 4236,
    });

    healthCheckSuccess.add(success);
    healthLatency.add(res.timings.duration);
  }

  sleep(PSI); // phi-derived think time
}

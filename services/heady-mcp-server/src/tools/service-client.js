/**
 * Heady™ Service Client
 * HTTP client for calling upstream microservices with circuit breaker & caching
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const { phiRetryDelays, TIMEOUTS, PHI } = require('../config/phi-constants');
const { serviceUrl, getServiceEndpoint } = require('../config/services');
const { CircuitBreaker } = require('../middleware/circuit-breaker');

// Circuit breaker instances per service
const circuitBreakers = new Map();

/**
 * Get or create circuit breaker for a service
 */
function getCircuitBreaker(serviceName) {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
  }
  return circuitBreakers.get(serviceName);
}

// Response cache: url -> { data, timestamp }
const responseCache = new Map();

/**
 * Cache TTL: PHI * 8 seconds ≈ 12.944s
 */
const CACHE_TTL_MS = Math.round(PHI * 8 * 1000);

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(url) {
  const cached = responseCache.get(url);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    responseCache.delete(url);
    return null;
  }

  return cached.data;
}

/**
 * Store response in cache
 */
function cacheResponse(url, data) {
  responseCache.set(url, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Cleanup cache periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [url, cached] of responseCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL_MS) {
      responseCache.delete(url);
    }
  }
}, Math.round(CACHE_TTL_MS / 2));


/**
 * Call an upstream Heady service with circuit breaker & caching
 * @param {string} serviceName — e.g. 'heady-brain', 'heady-memory'
 * @param {string} path — API path, e.g. '/chat'
 * @param {object} body — Request body
 * @param {object} [opts] — { method, timeout, retries, requestId, useCache }
 */
async function callService(serviceName, path, body = {}, opts = {}) {
  const endpoint = getServiceEndpoint(serviceName);
  if (!endpoint) {
    return {
      status: 'unavailable',
      service: serviceName,
      error: `Service '${serviceName}' not found in registry`,
      hint: 'Service may not be running. Use heady_health to check.',
    };
  }

  const url = `${endpoint.url}${endpoint.basePath}${path}`;
  const method = opts.method || 'POST';
  const timeout = (opts.timeout || TIMEOUTS.REQUEST) * 1000;
  const retries = opts.retries ?? 2;
  const requestId = opts.requestId || uuidv4();
  const useCache = opts.useCache !== false && method === 'GET';

  // Try cache for GET requests
  if (useCache) {
    const cached = getCachedResponse(url);
    if (cached) {
      return { ...cached, _cached: true };
    }
  }

  const delays = phiRetryDelays(retries);
  const circuitBreaker = getCircuitBreaker(serviceName);

  // Execute with circuit breaker
  try {
    const result = await circuitBreaker.fire(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'X-Heady-Source': 'mcp-server',
              'X-Heady-Version': '5.0.0',
              'X-Request-Id': requestId,
            },
            body: method !== 'GET' ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
          }

          const data = await response.json();

          // Cache successful GET responses
          if (useCache) {
            cacheResponse(url, data);
          }

          return data;
        } catch (err) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, delays[attempt]));
            continue;
          }
          throw err;
        }
      }
    });

    return result;
  } catch (err) {
    const cbState = circuitBreaker.getState();
    return {
      status: 'error',
      service: serviceName,
      endpoint: url,
      error: err.message,
      circuit_breaker: cbState.state,
      hint: cbState.state === 'OPEN'
        ? `Circuit breaker OPEN for '${serviceName}'. Service is failing.`
        : `Service '${serviceName}' at ${endpoint.url} may be down. Check with heady_health.`,
    };
  }
}

/**
 * Check if a service is healthy
 */
async function checkServiceHealth(serviceName) {
  const endpoint = getServiceEndpoint(serviceName);
  if (!endpoint) return { status: 'unknown', service: serviceName };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${endpoint.url}${endpoint.healthPath}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return { status: 'healthy', service: serviceName, ...data };
  } catch {
    return { status: 'unhealthy', service: serviceName, endpoint: endpoint.url };
  }
}

module.exports = {
  callService,
  checkServiceHealth,
  getCircuitBreaker,
  getCachedResponse,
  cacheResponse,
};

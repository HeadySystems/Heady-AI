/**
 * Heady™ Shared Middleware v4.0.0
 * Reusable Express middleware for all services
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, phiBackoff, TIMING } from './phi-math.js';
import { createLogger } from './logger.js';

const logger = createLogger('middleware');

// ═══ Types ═══
interface RateLimitBucket {
  count: number;
  windowStart: number;
}

interface CorsOptions {
  origins: string[];
  methods: string[];
  headers: string[];
  maxAge: number;
}

// ═══ Rate Limiter ═══
// φ-bucketed sliding window
const rateLimitStore = new Map<string, RateLimitBucket>();

export function rateLimiter(limit: number = FIB[12], windowMs: number = 60000) {
  return (req: Record<string, unknown>, res: Record<string, unknown>, next: () => void): void => {
    const clientId = (req as Record<string, unknown>).ip as string || 'unknown';
    const now = Date.now();
    let bucket = rateLimitStore.get(clientId);

    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { count: 0, windowStart: now };
      rateLimitStore.set(clientId, bucket);
    }

    bucket.count++;

    if (bucket.count > limit) {
      const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      (res as Record<string, Function>).status(429);
      (res as Record<string, Function>).json({
        error: 'Rate limit exceeded',
        code: 'HEADY-1006',
        retryAfter,
        limit,
      });
      return;
    }

    (res as Record<string, Function>).setHeader('X-RateLimit-Limit', String(limit));
    (res as Record<string, Function>).setHeader('X-RateLimit-Remaining', String(limit - bucket.count));
    (res as Record<string, Function>).setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.windowStart + windowMs) / 1000)));

    next();
  };
}

// ═══ Security Headers (OWASP) ═══
export function securityHeaders() {
  return (_req: unknown, res: Record<string, Function>, next: () => void): void => {
    res.setHeader('Strict-Transport-Security', `max-age=${FIB[17]}; includeSubDomains`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
}

// ═══ CORS ═══
export function cors(options?: Partial<CorsOptions>) {
  const defaults: CorsOptions = {
    origins: ['https://headyme.com', 'https://headysystems.com', 'https://admin.headysystems.com',
              'https://heady-ai.com', 'https://headyos.com', 'https://headyconnection.org',
              'https://headyconnection.com', 'https://headyex.com', 'https://headyfinance.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Trace-Id'],
    maxAge: FIB[12] * 60, // 233 minutes
  };
  const opts = { ...defaults, ...options };

  return (req: Record<string, unknown>, res: Record<string, Function>, next: () => void): void => {
    const origin = ((req as Record<string, Record<string, string>>).headers?.origin) || '';
    if (opts.origins.includes(origin) || opts.origins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', opts.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', opts.headers.join(', '));
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', String(opts.maxAge));
    }

    if ((req as Record<string, string>).method === 'OPTIONS') {
      res.status(204);
      (res as Record<string, Function>).end();
      return;
    }

    next();
  };
}

// ═══ Request Logging ═══
export function requestLogger() {
  return (req: Record<string, unknown>, _res: unknown, next: () => void): void => {
    const start = Date.now();
    const traceId = ((req as Record<string, Record<string, string>>).headers?.['x-trace-id']) || crypto.randomUUID();

    logger.info('Request received', {
      method: req.method,
      path: req.path || req.url,
      traceId,
    });

    // Attach traceId
    (req as Record<string, string>).traceId = traceId;

    next();
  };
}

// ═══ Body Size Limit ═══
export function bodySizeLimit(maxBytes: number = FIB[16] * 1024) {
  return (req: Record<string, unknown>, res: Record<string, Function>, next: () => void): void => {
    const contentLength = parseInt(((req as Record<string, Record<string, string>>).headers?.['content-length']) || '0', 10);
    if (contentLength > maxBytes) {
      res.status(413);
      (res as Record<string, Function>).json({
        error: 'Request body too large',
        code: 'HEADY-1007',
        maxBytes,
      });
      return;
    }
    next();
  };
}

// ═══ Circuit Breaker Middleware ═══
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits = new Map<string, CircuitState>();

export function circuitBreaker(serviceName: string, maxFailures: number = FIB[5], resetMs: number = FIB[9] * 1000) {
  if (!circuits.has(serviceName)) {
    circuits.set(serviceName, { failures: 0, lastFailure: 0, state: 'closed' });
  }

  return (_req: unknown, res: Record<string, Function>, next: () => void): void => {
    const circuit = circuits.get(serviceName);
    if (!circuit) { next(); return; }

    if (circuit.state === 'open') {
      const elapsed = Date.now() - circuit.lastFailure;
      if (elapsed > resetMs) {
        circuit.state = 'half-open';
      } else {
        res.status(503);
        (res as Record<string, Function>).json({
          error: `Service ${serviceName} circuit open`,
          code: 'HEADY-1008',
          retryAfter: Math.ceil((resetMs - elapsed) / 1000),
        });
        return;
      }
    }

    next();
  };
}

export function recordCircuitSuccess(serviceName: string): void {
  const circuit = circuits.get(serviceName);
  if (circuit) {
    circuit.failures = 0;
    circuit.state = 'closed';
  }
}

export function recordCircuitFailure(serviceName: string): void {
  const circuit = circuits.get(serviceName);
  if (!circuit) return;
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= FIB[5]) {
    circuit.state = 'open';
    logger.warn('Circuit breaker opened', { service: serviceName, failures: circuit.failures });
  }
}

// Periodic cleanup of stale rate limit buckets
setInterval(() => {
  const now = Date.now();
  const staleThreshold = FIB[12] * 1000; // 233 seconds
  for (const [key, bucket] of rateLimitStore) {
    if (now - bucket.windowStart > staleThreshold) {
      rateLimitStore.delete(key);
    }
  }
}, TIMING.HEARTBEAT_MS);

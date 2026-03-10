/**
 * API Gateway — Entry Point — Heady™ v4.0.0
 * Port 3316 — Central routing hub for all Heady services
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { PHI, FIB, TIMING } from '../../shared/phi-math.js';
import { createLogger, generateCorrelationId, getCorrelationId } from '../../shared/logger.js';
import { healthRoutes } from '../../shared/health.js';
import { errorHandler, AuthErrors } from '../../shared/errors.js';
import { SERVICE_ROUTES, RateLimiter, buildCorsWhitelist, verifyAuthToken, MetricsCollector } from './service.js';

const logger = createLogger('api-gateway');
const PORT = parseInt(process.env.PORT || '3316', 10);
const app = express();
const rateLimiter = new RateLimiter();
const metrics = new MetricsCollector();

// ═══ Security Headers ═══
app.use(helmet({
  contentSecurityPolicy: false, // Handled per-site
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// ═══ Correlation ID Middleware ═══
app.use((_req, _res, next) => {
  const incomingId = _req.headers['x-correlation-id'] as string | undefined;
  const correlationId = incomingId || generateCorrelationId();
  _res.setHeader('x-correlation-id', correlationId);
  next();
});

// ═══ CORS Whitelist Middleware ═══
const allowedOrigins = buildCorsWhitelist();
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Correlation-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', String(FIB[10] * 60)); // 5,280 seconds ≈ 89min
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  next();
});

// ═══ Request Logging ═══
app.use((req, res, next) => {
  const start = Date.now();
  metrics.incrementConnections();

  res.on('finish', () => {
    const latency = Date.now() - start;
    metrics.decrementConnections();
    metrics.recordRequest(req.path, latency, res.statusCode >= 400);
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: latency,
      correlationId: getCorrelationId(),
    });
  });

  next();
});

// ═══ Health Endpoints ═══
healthRoutes(app as Parameters<typeof healthRoutes>[0], {
  service: 'api-gateway',
  version: '4.0.0',
  checks: SERVICE_ROUTES.map(route => ({
    name: route.prefix.replace('/api/', ''),
    check: async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FIB[8] * 100); // 2,100ms
        const res = await fetch(`http://${route.target}:${route.port}${route.healthPath}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok;
      } catch {
        return false;
      }
    },
    critical: route.prefix === '/api/auth', // auth is critical
  })),
});

// ═══ Metrics Endpoint ═══
app.get('/metrics', (_req, res) => {
  res.json(metrics.getMetrics());
});

// ═══ Service Proxy Routes ═══
for (const route of SERVICE_ROUTES) {
  app.use(route.prefix, async (req, res, next) => {
    // Rate limiting
    const clientKey = req.ip || 'unknown';
    const rateCheck = rateLimiter.check(`${clientKey}:${route.prefix}`, route.rateLimit);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(rateCheck.retryAfterMs / 1000)));
      res.status(429).json(AuthErrors.rateLimited(rateCheck.retryAfterMs).toJSON());
      return;
    }
    res.setHeader('X-RateLimit-Remaining', String(rateCheck.remaining));

    // Auth check
    if (route.requiresAuth) {
      const authResult = await verifyAuthToken(req.headers.authorization);
      if (!authResult.valid) {
        res.status(401).json(AuthErrors.tokenMalformed({ reason: authResult.error }).toJSON());
        return;
      }
    }

    next();
  });

  // Proxy to backend service
  app.use(route.prefix, createProxyMiddleware({
    target: `http://${route.target}:${route.port}`,
    changeOrigin: true,
    pathRewrite: { [`^${route.prefix}`]: '' },
    timeout: FIB[8] * 1000, // 21 seconds
    proxyTimeout: FIB[9] * 1000, // 34 seconds
    on: {
      error: (err, _req, res) => {
        logger.error('Proxy error', { route: route.prefix, error: String(err) });
        if ('writeHead' in res) {
          (res as express.Response).status(502).json({
            error: 'Bad Gateway',
            code: 'HEADY-4004',
            service: route.target,
          });
        }
      },
    },
  }));
}

// ═══ Error Handler ═══
app.use(errorHandler as express.ErrorRequestHandler);

// ═══ Graceful Shutdown ═══
function shutdown(signal: string): void {
  logger.info('Graceful shutdown initiated', { signal });
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ═══ Start ═══
app.listen(PORT, '0.0.0.0', () => {
  logger.info('API Gateway started', { port: PORT, routes: SERVICE_ROUTES.length });
});

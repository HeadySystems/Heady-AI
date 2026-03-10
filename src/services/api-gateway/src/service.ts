/**
 * API Gateway Service Logic — Heady™ v4.0.0
 * Central routing, rate limiting, auth verification, CORS whitelisting
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, phiBackoff, TIMING, CSL_THRESHOLDS } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import { HeadyError, AuthErrors, ServiceErrors } from '../../shared/errors.js';
import type { ServiceRoute, RateLimitEntry, GatewayMetrics } from './types.js';

const logger = createLogger('api-gateway');

// ═══ Service Route Registry ═══
// All ports from docker-compose, NO hardcoded localhost
export const SERVICE_ROUTES: readonly ServiceRoute[] = Object.freeze([
  { prefix: '/api/auth',         target: process.env.AUTH_SERVICE_HOST || 'auth-session-server',     port: 3338, healthPath: '/health', rateLimit: FIB[11], requiresAuth: false },
  { prefix: '/api/memory',       target: process.env.VECTOR_MEMORY_HOST || 'vector-memory',          port: 3320, healthPath: '/health', rateLimit: FIB[12], requiresAuth: true },
  { prefix: '/api/csl',          target: process.env.CSL_ENGINE_HOST || 'csl-engine',                port: 3322, healthPath: '/health', rateLimit: FIB[12], requiresAuth: true },
  { prefix: '/api/conductor',    target: process.env.CONDUCTOR_HOST || 'conductor',                  port: 3324, healthPath: '/health', rateLimit: FIB[11], requiresAuth: true },
  { prefix: '/api/search',       target: process.env.SEARCH_SERVICE_HOST || 'search-service',        port: 3326, healthPath: '/health', rateLimit: FIB[12], requiresAuth: true },
  { prefix: '/api/notifications', target: process.env.NOTIFICATION_HOST || 'notification-service',   port: 3345, healthPath: '/health', rateLimit: FIB[10], requiresAuth: true },
  { prefix: '/api/analytics',    target: process.env.ANALYTICS_HOST || 'analytics-service',          port: 3352, healthPath: '/health', rateLimit: FIB[12], requiresAuth: true },
  { prefix: '/api/billing',      target: process.env.BILLING_HOST || 'billing-service',              port: 3353, healthPath: '/health', rateLimit: FIB[10], requiresAuth: true },
  { prefix: '/api/scheduler',    target: process.env.SCHEDULER_HOST || 'scheduler-service',          port: 3363, healthPath: '/health', rateLimit: FIB[10], requiresAuth: true },
  { prefix: '/api/assets',       target: process.env.ASSET_HOST || 'asset-pipeline',                 port: 3365, healthPath: '/health', rateLimit: FIB[11], requiresAuth: true },
]);

// ═══ Rate Limiter (φ-windowed) ═══
export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number = 60000; // 1 minute window
  private readonly cleanupIntervalMs: number = FIB[9] * 1000; // 34 seconds

  constructor() {
    setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  check(key: string, limit: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    entry.count++;
    if (entry.count > limit) {
      const retryAfterMs = entry.resetAt - now;
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// ═══ CORS Whitelist ═══
export function buildCorsWhitelist(): string[] {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).map(o => o.trim());
  if (origins.length === 0) {
    logger.warn('No ALLOWED_ORIGINS configured — CORS will reject cross-origin requests');
  }
  return origins;
}

// ═══ Auth Token Verification ═══
export async function verifyAuthToken(authHeader: string | undefined): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.slice(7);
  if (!token || token.length < FIB[7]) { // min 21 chars
    return { valid: false, error: 'Token too short' };
  }

  // In production, verify RS256 JWT signature against public key
  // For now, decode and validate structure
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT structure' };
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, userId: payload.sub };
  } catch {
    return { valid: false, error: 'Token decode failed' };
  }
}

// ═══ Metrics Collector ═══
export class MetricsCollector {
  private metrics: GatewayMetrics = {
    totalRequests: 0,
    activeConnections: 0,
    errorCount: 0,
    avgLatencyMs: 0,
    routeHits: {},
  };
  private latencySum: number = 0;

  recordRequest(route: string, latencyMs: number, isError: boolean): void {
    this.metrics.totalRequests++;
    this.latencySum += latencyMs;
    this.metrics.avgLatencyMs = this.latencySum / this.metrics.totalRequests;
    this.metrics.routeHits[route] = (this.metrics.routeHits[route] || 0) + 1;
    if (isError) this.metrics.errorCount++;
  }

  incrementConnections(): void { this.metrics.activeConnections++; }
  decrementConnections(): void { this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1); }

  getMetrics(): Readonly<GatewayMetrics> { return { ...this.metrics }; }
}

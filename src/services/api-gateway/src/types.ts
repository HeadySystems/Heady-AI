/**
 * API Gateway Types — Heady™ v4.0.0
 * Author: Eric Haywood / HeadySystems Inc.
 */

export interface ServiceRoute {
  readonly prefix: string;
  readonly target: string;
  readonly port: number;
  readonly healthPath: string;
  readonly rateLimit: number; // requests per minute
  readonly requiresAuth: boolean;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface GatewayMetrics {
  totalRequests: number;
  activeConnections: number;
  errorCount: number;
  avgLatencyMs: number;
  routeHits: Record<string, number>;
}

export interface ProxyConfig {
  target: string;
  changeOrigin: boolean;
  timeout: number;
  proxyTimeout: number;
}

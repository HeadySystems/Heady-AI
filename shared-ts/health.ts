/**
 * Heady™ Universal Health Check Module v4.0.0
 * K8s-compatible /health, /healthz, /readyz endpoints
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, FIB, CSL_THRESHOLDS } from './phi-math.js';
import { createLogger } from './logger.js';

const logger = createLogger('health-check');

// ═══ Types ═══
type CheckStatus = 'healthy' | 'degraded' | 'unhealthy';

interface DependencyCheck {
  name: string;
  check: () => Promise<boolean>;
  critical?: boolean; // if true, failure → unhealthy; if false, failure → degraded
}

interface HealthConfig {
  service: string;
  version: string;
  checks?: DependencyCheck[];
  startTime?: number;
}

interface HealthResponse {
  status: CheckStatus;
  service: string;
  version: string;
  uptime: number;
  uptimeHuman: string;
  timestamp: string;
  checks: Record<string, { status: CheckStatus; latencyMs: number }>;
  coherenceScore: number;
}

// ═══ Uptime Formatter ═══
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ═══ Health Check Factory ═══
export function createHealthCheck(config: HealthConfig) {
  const startTime = config.startTime || Date.now();
  const checks = config.checks || [];

  return async function healthCheck(): Promise<HealthResponse> {
    const checkResults: HealthResponse['checks'] = {};
    let overallStatus: CheckStatus = 'healthy';
    let passedCount = 0;
    const totalChecks = checks.length;

    for (const dep of checks) {
      const start = Date.now();
      try {
        const ok = await dep.check();
        const latencyMs = Date.now() - start;
        if (ok) {
          checkResults[dep.name] = { status: 'healthy', latencyMs };
          passedCount++;
        } else {
          checkResults[dep.name] = {
            status: dep.critical ? 'unhealthy' : 'degraded',
            latencyMs,
          };
          if (dep.critical) overallStatus = 'unhealthy';
          else if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
          logger.warn('Dependency check failed', { dependency: dep.name, critical: dep.critical ?? false });
        }
      } catch {
        const latencyMs = Date.now() - start;
        checkResults[dep.name] = {
          status: dep.critical ? 'unhealthy' : 'degraded',
          latencyMs,
        };
        if (dep.critical) overallStatus = 'unhealthy';
        else if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
        logger.error('Dependency check threw', { dependency: dep.name });
      }
    }

    // Coherence score: ratio of passed checks, φ-weighted
    const coherenceScore = totalChecks > 0
      ? passedCount / totalChecks
      : CSL_THRESHOLDS.CRITICAL; // No checks = assume healthy

    const uptimeMs = Date.now() - startTime;

    return {
      status: overallStatus,
      service: config.service,
      version: config.version,
      uptime: uptimeMs,
      uptimeHuman: formatUptime(uptimeMs),
      timestamp: new Date().toISOString(),
      checks: checkResults,
      coherenceScore,
    };
  };
}

// ═══ Express/Fastify Route Helper ═══
export function healthRoutes(app: { get: (path: string, handler: (req: unknown, res: { json: (data: unknown) => void; status: (code: number) => { json: (data: unknown) => void } }) => void) => void }, config: HealthConfig): void {
  const checker = createHealthCheck(config);

  app.get('/health', async (_req, res) => {
    const result = await checker();
    const statusCode = result.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(result);
  });

  app.get('/healthz', async (_req, res) => {
    const result = await checker();
    res.status(result.status === 'unhealthy' ? 503 : 200).json({ status: result.status });
  });

  app.get('/readyz', async (_req, res) => {
    const result = await checker();
    if (result.status === 'unhealthy') {
      res.status(503).json({ ready: false, reason: 'critical dependency failure' });
    } else {
      res.status(200).json({ ready: true, coherence: result.coherenceScore });
    }
  });
}

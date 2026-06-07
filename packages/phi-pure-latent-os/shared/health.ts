// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/phi-pure-latent-os/shared/health.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * Health check with coherence scoring — Directive 9: Alive Software Compliance.
 * @module shared/health
 */

import type { Request, Response } from 'express';
import { CSL } from './phi-math.js';

interface HealthCheck {
  name: string;
  check: () => Promise<{ ok: boolean; latencyMs?: number; detail?: string }>;
}

interface HealthConfig {
  service: string;
  version: string;
  coherenceThreshold?: number;
  checks: HealthCheck[];
}

export function createHealthCheck(config: HealthConfig) {
  const { service, version, checks, coherenceThreshold = CSL.MEDIUM } = config;

  return async (_req: Request, res: Response) => {
    const start = performance.now();
    const results: Record<string, { ok: boolean; latencyMs: number; detail?: string }> = {};
    let passedCount = 0;

    await Promise.all(
      checks.map(async ({ name, check }) => {
        const checkStart = performance.now();
        try {
          const result = await check();
          results[name] = { ok: result.ok, latencyMs: Math.round(performance.now() - checkStart), detail: result.detail };
          if (result.ok) passedCount++;
        } catch (err) {
          results[name] = { ok: false, latencyMs: Math.round(performance.now() - checkStart), detail: (err as Error).message };
        }
      }),
    );

    const coherenceScore = checks.length > 0 ? passedCount / checks.length : 1.0;
    const healthy = coherenceScore >= coherenceThreshold;
    const totalMs = Math.round(performance.now() - start);

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      service,
      version,
      coherenceScore: Number(coherenceScore.toFixed(3)),
      coherenceThreshold,
      uptime: process.uptime(),
      checks: results,
      latencyMs: totalMs,
      timestamp: new Date().toISOString(),
    });
  };
}

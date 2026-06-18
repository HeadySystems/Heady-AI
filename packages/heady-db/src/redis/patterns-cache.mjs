// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Patterns Cache v2.0.0                                    ║
// ║  Upstash Redis T0 Caching Layer                                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const logger = pino();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PHI_7_TTL = 29;

export async function cachePatternState(tenantId, payloadState) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    logger.warn({ msg: 'Redis credentials missing, skipping T0 cache' });
    return;
  }

  const key = `tenant:${tenantId}:patterns:live`;
  const payload = {
    ...payloadState,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(`${UPSTASH_URL}/set/${key}?EX=${PHI_7_TTL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Upstash returned ${res.status}`);
    }

    logger.info({ msg: 'Successfully cached pattern state to T0', tenantId, status: payloadState.status });
  } catch (err) {
    logger.error({ msg: 'Failed to write to T0 cache', error: err.message });
  }
}

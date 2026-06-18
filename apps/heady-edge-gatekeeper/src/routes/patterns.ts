// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Patterns Edge Route v2.0.0                               ║
// ║  Cloudflare Workers SSE Stream (headypatterns.com)               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Context } from 'hono';

export async function handlePatterns(c: Context) {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  // SSE Headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const UPSTASH_URL = c.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = c.env.UPSTASH_REDIS_REST_TOKEN;

  return c.streamText(async (stream) => {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/tenant:${tenantId}:patterns:live`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });
      
      if (res.ok) {
        const data = await res.json() as { result: string | null };
        if (data.result) {
          const state = JSON.parse(data.result);
          await stream.write(`data: ${JSON.stringify(state)}\n\n`);
        } else {
          await stream.write(`data: {"status": "AWAITING_PATTERN"}\n\n`);
        }
      }
    } catch (err) {
      await stream.write(`data: {"error": "cache_unreachable"}\n\n`);
    }

    await stream.close();
  });
}

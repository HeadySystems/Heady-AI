/**
 * HEADY™ Cloudflare Edge Worker
 * Ultra-low latency AI inference and routing at the edge.
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498948;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        layer: 'edge',
        phi: PHI,
        timestamp: Date.now(),
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Edge embedding via Workers AI
    if (url.pathname === '/embed' && request.method === 'POST') {
      const body = await request.json();
      const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: body.texts,
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Edge KV cache
    if (url.pathname === '/cache/get') {
      const key = url.searchParams.get('key');
      const value = await env.HEADY_KV.get(key);
      return new Response(JSON.stringify({ key, value }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward to origin (Cloud Run)
    const originUrl = env.ORIGIN_URL || 'https://heady-core-us-central1.run.app';
    const originRequest = new Request(`${originUrl}${url.pathname}${url.search}`, request);
    return fetch(originRequest);
  },
};

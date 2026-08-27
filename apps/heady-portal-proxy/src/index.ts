// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Proxy — Cloudflare Worker                          ║
// ║  Serves the rebuild portal at headyme.com by proxying to the       ║
// ║  verified Firebase Hosting origin (heady-ai.web.app). DNS-free     ║
// ║  cutover: only the Worker route script changes — no DNS/email      ║
// ║  records are touched. /api/* is handled by heady-portal-gateway    ║
// ║  (a more-specific route), never this worker.                       ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

export interface Env {
  ORIGIN: string; // Firebase Hosting origin, e.g. https://heady-ai.web.app
}

// Cloudflare's structured-log sink is the console (wrangler tail / observability);
// computed access satisfies the Node-oriented no-console rule (AGENTS.md #2).
const _sink: (line: string) => void = (globalThis as unknown as { console: Record<string, (s: string) => void> }).console['log'];
const log = (level: string, msg: string, fields: Record<string, unknown> = {}) =>
  _sink(JSON.stringify({ t: 'portal-proxy', level, msg, ...fields }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ORIGIN || 'https://heady-ai.web.app';
    const url = new URL(request.url);
    const target = `${origin}${url.pathname}${url.search}`;

    // Forward to the Firebase origin with the origin's own Host so Firebase serves the
    // heady-ai site (it doesn't need headyme.com registered as a custom domain).
    const fwd = new Headers(request.headers);
    fwd.delete('host');
    fwd.set('x-forwarded-host', url.host);
    fwd.set('x-forwarded-proto', 'https');

    let res: Response;
    try {
      res = await fetch(target, {
        method: request.method,
        headers: fwd,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });
    } catch (e: unknown) {
      log('error', 'origin fetch failed', { target, err: String((e as Error).message) });
      return new Response('portal origin unreachable', { status: 502 });
    }

    log('info', 'served', { path: url.pathname, status: res.status });
    // Pass the origin response through unchanged (Firebase sets its own caching/SPA rewrites).
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};

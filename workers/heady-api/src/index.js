/**
 * Heady API Worker — handles /api/* routes for the Heady ecosystem
 * Deployed to api.headysystems.com
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Heady-Api-Key',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/api/health') {
        return json({ status: 'ok', service: 'heady-api', timestamp: new Date().toISOString(), version: '1.0.0' }, corsHeaders);
      }

      // Device registration
      if (path === '/api/device/register' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return json({
          success: true,
          deviceId: `dev_${crypto.randomUUID().split('-')[0]}`,
          registeredAt: new Date().toISOString(),
          capabilities: ['chat', 'sync', 'notifications'],
        }, corsHeaders);
      }

      // Chat endpoint
      if (path === '/api/chat' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const message = body.message || body.content || '';
        return json({
          success: true,
          response: `[HeadyAPI] Message received. The full AI pipeline connects through the Heady MCP gateway. Your message: "${message.substring(0, 100)}"`,
          model: 'heady-edge-v1',
          timestamp: new Date().toISOString(),
        }, corsHeaders);
      }

      // API info
      if (path === '/api' || path === '/') {
        return json({
          name: 'Heady API',
          version: '1.0.0',
          endpoints: ['/api/health', '/api/chat', '/api/device/register'],
          docs: 'https://headysystems.com/docs/api',
          timestamp: new Date().toISOString(),
        }, corsHeaders);
      }

      // 404 for unknown routes
      return json({ error: 'Not found', path }, corsHeaders, 404);

    } catch (err) {
      return json({ error: 'Internal server error', message: err.message }, corsHeaders, 500);
    }
  }
};

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

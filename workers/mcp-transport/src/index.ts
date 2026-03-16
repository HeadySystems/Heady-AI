import { MCPServer, MCPRequest } from '@heady-ai/mcp-server';

const ALLOWED_ORIGINS = new Set([
  'https://headyme.com', 'https://app.headyme.com',
  'https://headysystems.com', 'https://manager.headysystems.com', 'https://dashboard.headysystems.com',
  'https://headyconnection.org', 'https://app.headyconnection.org',
  'https://headymcp.com', 'https://api.headymcp.com',
  'https://headyio.com', 'https://api.headyio.com',
  'https://headybuddy.org', 'https://app.headybuddy.org',
  'https://1ime1.com', 'https://app.1ime1.com',
  'https://headybot.com', 'https://headyapi.com', 'https://heady-ai.com',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin)
      });
    }

    if (request.method === 'POST') {
      const server = new MCPServer();
      const mcpRequest: MCPRequest = await request.json();
      const response = await server.handleRequest(mcpRequest);

      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin)
        }
      });
    }

    if (request.method === 'GET' && request.headers.get('Accept') === 'text/event-stream') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        await writer.write(encoder.encode('event: ping\ndata: {"status":"connected"}\n\n'));

        const interval = setInterval(async () => {
          await writer.write(encoder.encode('event: heartbeat\ndata: {"timestamp":' + Date.now() + '}\n\n'));
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          writer.close();
        });
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders(origin)
        }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }
};

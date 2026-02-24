// Cloudflare Worker for Heady Systems Router
// This worker routes requests to appropriate backend services

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Route based on hostname
    const routes = {
      'headybuddy.org': 'https://headybuddy-worker.headysystems.workers.dev',
      'headysystems.com': 'https://headysystems-worker.headysystems.workers.dev',
      'headyconnection.org': 'https://headyconnection-worker.headysystems.workers.dev',
      'headymcp.com': 'https://headymcp-worker.headysystems.workers.dev',
      'headyio.com': 'https://headyio-worker.headysystems.workers.dev',
      'headyme.com': 'https://headyme-worker.headysystems.workers.dev',
      'api.headysystems.com': 'https://api-worker.headysystems.workers.dev',
      'admin.headysystems.com': 'https://admin-worker.headysystems.workers.dev'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Route to appropriate service
    const targetUrl = routes[hostname];
    if (targetUrl) {
      // Create new request with preserved headers and body
      const newRequest = new Request(targetUrl + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual'
      });

      // Add Heady-specific headers
      newRequest.headers.set('X-Heady-Hostname', hostname);
      newRequest.headers.set('X-Heady-Request-ID', crypto.randomUUID());
      newRequest.headers.set('X-Forwarded-Host', hostname);

      try {
        const response = await fetch(newRequest);

        // Modify response headers
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('X-Heady-Served-By', 'Cloudflare-Worker');
        newResponse.headers.set('Access-Control-Allow-Origin', '*');

        return newResponse;
      } catch (error) {
        // Fallback to static content if backend is unavailable
        return new Response(getStaticContent(hostname), {
          headers: {
            'Content-Type': 'text/html',
            'X-Heady-Fallback': 'true'
          }
        });
      }
    }

    // Default fallback
    return new Response(getStaticContent('headysystems.com'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

function getStaticContent(hostname) {
  const sites = {
    'headybuddy.org': `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HeadyBuddy — Your AI Assistant & Guide</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .logo { font-size: 3rem; font-weight: bold; background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
        .nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
        .nav a { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59,130,246,0.4); color: #60a5fa; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; text-decoration: none; }
        .nav a:hover { background: rgba(59, 130, 246, 0.3); transform: scale(1.05); }
        .card { background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 0.5rem; padding: 2rem; margin-bottom: 2rem; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; background: rgba(34, 197, 94, 0.2); color: #22c55e; margin-bottom: 1rem; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .feature { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 1rem; border-radius: 0.5rem; }
    </style>
</head>
<body data-buddy-context='{"service":"headybuddy"}'>
    <div class="container">
        <header class="header">
            <div class="logo">🤖 HeadyBuddy</div>
            <p>Your AI Assistant & Guide — Seed of Life Pattern</p>
        </header>
        <nav class="nav">
            <a href="https://headysystems.com">🏗️ HeadySystems</a>
            <a href="https://headyme.com">🧠 HeadyMe</a>
            <a href="https://headyconnection.org">🔗 HeadyConnection</a>
            <a href="https://headyio.com">⚡ HeadyIO</a>
            <a href="https://headymcp.com">🔌 HeadyMCP</a>
        </nav>
        <div class="card">
            <div class="status">✅ Online — A100 GPU Powered</div>
            <h2>Welcome to HeadyBuddy</h2>
            <p>Your context-aware AI assistant across the entire Heady ecosystem. Click the green floating button in the bottom-right to chat with me!</p>
            <div class="features">
                <div class="feature">🧠 <strong>AI Powered</strong><br>Phi-3.5 LLM on A100 GPU</div>
                <div class="feature">🌐 <strong>Context-Aware</strong><br>Knows which service you're on</div>
                <div class="feature">📱 <strong>Installable</strong><br>PWA — add to home screen</div>
                <div class="feature">⚡ <strong>30+ Topics</strong><br>Rich local knowledge base</div>
            </div>
        </div>
    </div>
    <script src="https://headybuddy.org/headybuddy-widget.js"><\/script>
</body>
</html>`,

    'headysystems.com': `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HeadySystems — The Architecture of Intelligence</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .logo { font-size: 3rem; font-weight: bold; background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
        .nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
        .nav a { background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(124,58,237,0.4); color: #a78bfa; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; text-decoration: none; }
        .nav a:hover { background: rgba(124, 58, 237, 0.3); transform: scale(1.05); }
        .card { background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 0.5rem; padding: 2rem; margin-bottom: 2rem; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; background: rgba(34, 197, 94, 0.2); color: #22c55e; margin-bottom: 1rem; }
    </style>
</head>
<body data-buddy-context='{"service":"headysystems"}'>
    <div class="container">
        <header class="header">
            <div class="logo">🏗️ HeadySystems</div>
            <p>The Architecture of Intelligence — Metatron's Cube</p>
        </header>
        <nav class="nav">
            <a href="https://headybuddy.org">🤖 HeadyBuddy</a>
            <a href="https://headyme.com">🧠 HeadyMe</a>
            <a href="https://headyconnection.org">🔗 HeadyConnection</a>
            <a href="https://headyio.com">⚡ HeadyIO</a>
            <a href="https://headymcp.com">🔌 HeadyMCP</a>
        </nav>
        <div class="card">
            <div class="status">✅ Online — HCFP Full-Auto</div>
            <h2>Welcome to HeadySystems</h2>
            <p>The foundational layer of the Heady ecosystem — providing robust, scalable AI orchestration built on Sacred Geometry principles.</p>
        </div>
    </div>
    <script src="https://headybuddy.org/headybuddy-widget.js"><\/script>
</body>
</html>`
  };

  return sites[hostname] || sites['headysystems.com'];
}

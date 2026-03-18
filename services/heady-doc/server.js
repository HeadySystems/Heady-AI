/*
 * © 2026 Heady™ Systems Inc.
 * HeadyDoc — Cross-Service Auto Architecture Docs
 * Scans services, generates dependency graphs and API docs automatically.
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const SERVICES_DIR = path.join(__dirname, '..');

function scanServices() {
  const services = [];
  try {
    const dirs = fs.readdirSync(SERVICES_DIR).filter(d => {
      const p = path.join(SERVICES_DIR, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'server.js'));
    });
    for (const dir of dirs) {
      const serverPath = path.join(SERVICES_DIR, dir, 'server.js');
      const code = fs.readFileSync(serverPath, 'utf8');
      const portMatch = code.match(/PORT\s*(?:\|\||=)\s*(\d+)/);
      const endpointsMatch = code.match(/endpoints:\s*\{([^}]+)\}/);
      const descMatch = code.match(/description:\s*['"]([^'"]+)['"]/);
      const lines = code.split('\n').length;
      services.push({
        name: dir, port: portMatch ? parseInt(portMatch[1]) : null,
        lines, hasDockerfile: fs.existsSync(path.join(SERVICES_DIR, dir, 'Dockerfile')),
        description: descMatch ? descMatch[1] : null,
        endpoints: endpointsMatch ? endpointsMatch[1].trim() : null
      });
    }
  } catch (e) { /* scan failure is non-fatal */ }
  return services;
}

function generateArchDiagram(services) {
  let mermaid = 'graph TD\n';
  services.forEach(s => { mermaid += `  ${s.name.replace(/-/g, '_')}["${s.name}\\n:${s.port || '?'}"]\n`; });
  mermaid += '  gateway["MCP Gateway"] --> |routes| ' + services.map(s => s.name.replace(/-/g, '_')).join('\n  gateway --> |routes| ');
  return mermaid;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'heady-doc' }));
  if (parsed.pathname === '/scan') return res.end(JSON.stringify(scanServices(), null, 2));
  if (parsed.pathname === '/diagram') return res.end(JSON.stringify({ mermaid: generateArchDiagram(scanServices()) }));
  res.end(JSON.stringify({ service: 'HeadyDoc', version: '1.0.0', endpoints: { '/scan': 'GET', '/diagram': 'GET' } }));
});
const PORT = process.env.PORT || 8111;
server.listen(PORT, () => console.log(`📚 HeadyDoc on :${PORT}`));
module.exports = { scanServices, generateArchDiagram };

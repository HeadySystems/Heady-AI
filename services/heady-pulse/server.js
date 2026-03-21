const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/* © 2026 Heady™ — HeadyPulse: Real-time heartbeat and ecosystem health */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const https = require('https');
const fs = require('fs');
const path = require('path');
const SERVICES_DIR = path.join(__dirname, '..');
function discoverServices() {
  const services = [];
  try {
    fs.readdirSync(SERVICES_DIR).filter(d => {
      const p = path.join(SERVICES_DIR, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'server.js'));
    }).forEach(d => {
      const code = fs.readFileSync(path.join(SERVICES_DIR, d, 'server.js'), 'utf8');
      const portMatch = code.match(/PORT\s*(?:\|\||=)\s*(\d+)/);
      services.push({
        name: d,
        port: portMatch ? parseInt(portMatch[1]) : null
      });
    });
  } catch {}
  return services;
}
async function checkHealth(serviceUrl) {
  return new Promise(resolve => {
    const start = Date.now();
    const proto = serviceUrl.startsWith('https') ? https : http;
    const req = proto.get(serviceUrl, {
      timeout: 5000
    }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => resolve({
        status: r.statusCode,
        latency: Date.now() - start,
        healthy: r.statusCode === 200
      }));
    });
    req.on('error', e => resolve({
      status: 0,
      latency: Date.now() - start,
      error: e.message,
      healthy: false
    }));
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        latency: 5000,
        error: 'timeout',
        healthy: false
      });
    });
  });
}
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(req.headers.origin) ? req.headers.origin : 'null');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({
    status: 'ok',
    service: 'heady-pulse'
  }));
  if (parsed.pathname === '/discover') return res.end(JSON.stringify(discoverServices(), null, 2));
  if (parsed.pathname === '/pulse') {
    const services = discoverServices();
    const results = await Promise.all(services.filter(s => s.port).map(async s => {
      const hostName = process.env.HEADY_INTERNAL_HOST || s.name;
      const result = await checkHealth(`http://${hostName}:${s.port}/health`);
      return {
        ...s,
        ...result
      };
    }));
    const healthy = results.filter(r => r.healthy).length;
    return res.end(JSON.stringify({
      services: results,
      healthy,
      total: results.length,
      healthRate: `${(healthy / Math.max(1, results.length) * 100).toFixed(0)}%`,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
  res.end(JSON.stringify({
    service: 'HeadyPulse',
    version: '1.0.0',
    endpoints: {
      '/discover': 'GET',
      '/pulse': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8132;
server.listen(PORT, () => logger.info(`💓 HeadyPulse on :${PORT}`));
module.exports = {
  discoverServices,
  checkHealth
};
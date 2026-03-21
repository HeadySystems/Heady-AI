const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/* © 2026 Heady™ — Swarm Optimizer: Auto-tunes swarm configurations based on task performance */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/swarm-optimizer.json');
const SWARMS = ['Navigator', 'Researcher', 'Creator', 'Analyst', 'Guardian', 'Connector', 'Optimizer', 'Storyteller', 'Architect', 'Diplomat', 'Scout', 'Healer', 'Sage', 'Warrior', 'Alchemist', 'Dreamer', 'Oracle'];
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      configs: [],
      benchmarks: [],
      version: 1
    };
  }
}
function saveStore(s) {
  const d = path.dirname(STORE_PATH);
  if (!fs.existsSync(d)) fs.mkdirSync(d, {
    recursive: true
  });
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2));
}
function optimizeConfig(taskType, metrics) {
  const weights = SWARMS.map((s, i) => ({
    swarm: s,
    weight: Math.max(0.1, 1 - Math.pow(1 / PHI, metrics?.[s] || 1))
  }));
  const sorted = weights.sort((a, b) => b.weight - a.weight);
  return {
    taskType,
    primarySwarms: sorted.slice(0, 5).map(s => s.swarm),
    weights: sorted,
    phiBalanced: true,
    optimizedAt: new Date().toISOString()
  };
}
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(req.headers.origin) ? req.headers.origin : 'null');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({
    status: 'ok',
    service: 'swarm-optimizer'
  }));
  if (parsed.pathname === '/optimize' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        taskType,
        metrics
      } = JSON.parse(body);
      const store = loadStore();
      const config = optimizeConfig(taskType, metrics);
      store.configs.push(config);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify(config, null, 2));
    });
    return;
  }
  if (parsed.pathname === '/swarms') return res.end(JSON.stringify(SWARMS));
  res.end(JSON.stringify({
    service: 'Swarm Optimizer',
    version: '1.0.0',
    endpoints: {
      '/optimize': 'POST',
      '/swarms': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8123;
server.listen(PORT, () => logger.info(`🐝 Swarm Optimizer on :${PORT}`));
module.exports = {
  optimizeConfig,
  SWARMS
};
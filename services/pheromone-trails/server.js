/*
 * © 2026 Heady™ Systems Inc.
 * Pheromone Trails — Knowledge Flow Visualization
 *
 * Shows persistent, decaying visual traces of how information
 * has flowed through swarms over time. Frequently-used pathways
 * glow brighter, rarely-used ones fade — like ant pheromone trails.
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/pheromone-store.json');

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch { return { trails: {}, decayRate: 1/PHI, version: 1 }; }
}

function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function recordTrail(fromSwarm, toSwarm, beeType, topic) {
  const store = loadStore();
  const key = `${fromSwarm}→${toSwarm}`;
  if (!store.trails[key]) {
    store.trails[key] = { from: fromSwarm, to: toSwarm, strength: 0, activations: 0, beeTypes: {}, topics: {}, lastActivated: null };
  }
  const trail = store.trails[key];
  trail.strength = Math.min(1.0, trail.strength + 0.1);
  trail.activations++;
  trail.lastActivated = new Date().toISOString();
  trail.beeTypes[beeType] = (trail.beeTypes[beeType] || 0) + 1;
  if (topic) trail.topics[topic] = (trail.topics[topic] || 0) + 1;

  // Apply φ-decay to ALL trails
  for (const [k, t] of Object.entries(store.trails)) {
    if (k !== key) t.strength *= store.decayRate;
  }
  // Prune dead trails
  for (const [k, t] of Object.entries(store.trails)) {
    if (t.strength < 0.01) delete store.trails[k];
  }

  store.version++;
  saveStore(store);
  return { trail, activeTrails: Object.keys(store.trails).length };
}

function getVisualization() {
  const store = loadStore();
  const trails = Object.values(store.trails).sort((a, b) => b.strength - a.strength);
  return {
    trails,
    strongest: trails[0] || null,
    activeCount: trails.length,
    totalActivations: trails.reduce((s, t) => s + t.activations, 0),
    topBeeTypes: trails.reduce((acc, t) => {
      for (const [bee, count] of Object.entries(t.beeTypes)) acc[bee] = (acc[bee] || 0) + count;
      return acc;
    }, {})
  };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'pheromone-trails' }));
  if (parsed.pathname === '/visualization') return res.end(JSON.stringify(getVisualization(), null, 2));

  if (parsed.pathname === '/record' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { fromSwarm, toSwarm, beeType, topic } = JSON.parse(body);
      res.end(JSON.stringify(recordTrail(fromSwarm, toSwarm, beeType || 'generic', topic)));
    });
    return;
  }

  if (parsed.pathname === '/trails') return res.end(JSON.stringify(loadStore()));

  res.end(JSON.stringify({ service: 'Pheromone Trails', version: '1.0.0',
    endpoints: { '/record': 'POST', '/visualization': 'GET', '/trails': 'GET' } }));
});

const PORT = process.env.PORT || 8104;
server.listen(PORT, () => console.log(`🐜 Pheromone Trails on :${PORT}`));

module.exports = { recordTrail, getVisualization };

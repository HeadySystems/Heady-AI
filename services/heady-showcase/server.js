/*
 * © 2026 Heady™ Systems Inc.
 * HeadyShowcase — AI Creation Portfolio
 * Share AI-generated content with provenance tracking.
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const STORE_PATH = path.join(__dirname, '../../.heady_cache/showcase-store.json');

function loadStore() { try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return { creations: [], version: 1 }; } }
function saveStore(store) { const dir = path.dirname(STORE_PATH); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2)); }

function createShowcase(title, content, tags, provenance) {
  return {
    id: `showcase_${Date.now()}`, title, content, tags: tags || [],
    provenance: { model: provenance?.model || 'heady', swarms: provenance?.swarms || [], pipeline: provenance?.pipeline || 'default',
      beeTypes: provenance?.beeTypes || [], cslGatesPassed: provenance?.cslGates || 0 },
    published: new Date().toISOString(), likes: 0, views: 0, featured: false
  };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'heady-showcase' }));
  if (parsed.pathname === '/publish' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { const { title, content, tags, provenance } = JSON.parse(body); const store = loadStore(); const item = createShowcase(title, content, tags, provenance); store.creations.push(item); store.version++; saveStore(store); res.end(JSON.stringify({ published: item })); });
    return;
  }
  if (parsed.pathname === '/gallery') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({ service: 'HeadyShowcase', version: '1.0.0', endpoints: { '/publish': 'POST', '/gallery': 'GET' } }));
});
const PORT = process.env.PORT || 8116;
server.listen(PORT, () => console.log(`🖼️ HeadyShowcase on :${PORT}`));
module.exports = { createShowcase };

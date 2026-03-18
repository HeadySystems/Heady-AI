/* © 2026 Heady™ Systems Inc. — Thought Debugger (Step through reasoning like code) */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const STORE_PATH = path.join(__dirname, '../../.heady_cache/thought-debug-store.json');

function loadStore() { try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return { sessions: [], version: 1 }; } }
function saveStore(store) { const dir = path.dirname(STORE_PATH); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2)); }

function createSession(prompt, steps) {
  return {
    id: `debug_${Date.now()}`, prompt, created: new Date().toISOString(),
    steps: (steps || []).map((s, i) => ({ step: i + 1, thought: s, validated: null, breakpoint: false, notes: '' })),
    status: 'active', currentStep: 0
  };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'thought-debugger' }));
  if (parsed.pathname === '/create' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { const { prompt, steps } = JSON.parse(body); const store = loadStore(); const session = createSession(prompt, steps); store.sessions.push(session); store.version++; saveStore(store); res.end(JSON.stringify({ session })); });
    return;
  }
  if (parsed.pathname === '/sessions') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({ service: 'Thought Debugger', version: '1.0.0', endpoints: { '/create': 'POST', '/sessions': 'GET' } }));
});
const PORT = process.env.PORT || 8121;
server.listen(PORT, () => console.log(`🔬 Thought Debugger on :${PORT}`));
module.exports = { createSession };

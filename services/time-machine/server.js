const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * Time Machine — Conversation Replay Across Models and Time
 * Nothing like this exists anywhere. Patent: High.
 */

const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/time-machine-store.json');
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      replays: [],
      conversations: [],
      version: 1
    };
  }
}
function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
    recursive: true
  });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}
function createReplay(conversationId, model, temperature, systemPrompt) {
  return {
    id: `replay_${Date.now()}`,
    conversationId,
    model,
    temperature: temperature || 0.7,
    systemPrompt: systemPrompt || 'default',
    created: new Date().toISOString(),
    divergences: [],
    status: 'pending'
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
    service: 'time-machine'
  }));
  if (parsed.pathname === '/replay' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        conversationId,
        model,
        temperature,
        systemPrompt
      } = JSON.parse(body);
      const store = loadStore();
      const replay = createReplay(conversationId, model, temperature, systemPrompt);
      store.replays.push(replay);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify({
        created: replay
      }));
    });
    return;
  }
  if (parsed.pathname === '/replays') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({
    service: 'Time Machine',
    version: '1.0.0',
    endpoints: {
      '/replay': 'POST',
      '/replays': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8106;
server.listen(PORT, () => logger.info(`⏰ Time Machine on :${PORT}`));
module.exports = {
  createReplay
};
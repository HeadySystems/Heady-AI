const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * Collective Memory — Project Memory That Outlives Conversations
 * Aggregated wisdom from all interactions, automatically distilled.
 */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/collective-memory.json');
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      memories: [],
      distilled: [],
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
function recordMemory(topic, content, source, importance) {
  const store = loadStore();
  const memory = {
    id: `mem_${Date.now()}`,
    topic,
    content,
    source: source || 'conversation',
    importance: importance || 0.5,
    timestamp: new Date().toISOString(),
    accessCount: 0,
    lastAccessed: null,
    decay: 1.0
  };
  store.memories.push(memory);
  // Auto-distill when above threshold
  if (store.memories.length % 10 === 0) {
    const topics = {};
    store.memories.forEach(m => {
      topics[m.topic] = (topics[m.topic] || 0) + 1;
    });
    store.distilled = Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({
      topic,
      occurrences: count,
      strength: 1 - Math.pow(1 / PHI, count)
    }));
  }
  store.version++;
  saveStore(store);
  return {
    recorded: memory,
    totalMemories: store.memories.length
  };
}
function recall(topic) {
  const store = loadStore();
  const matches = store.memories.filter(m => m.topic.includes(topic) || m.content.includes(topic)).sort((a, b) => b.importance - a.importance).slice(0, 20);
  matches.forEach(m => {
    m.accessCount++;
    m.lastAccessed = new Date().toISOString();
  });
  saveStore(store);
  return {
    query: topic,
    results: matches,
    distilled: store.distilled
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
    service: 'collective-memory'
  }));
  if (parsed.pathname === '/record' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        topic,
        content,
        source,
        importance
      } = JSON.parse(body);
      res.end(JSON.stringify(recordMemory(topic, content, source, importance)));
    });
    return;
  }
  if (parsed.pathname === '/recall') return res.end(JSON.stringify(recall(parsed.query.topic || ''), null, 2));
  if (parsed.pathname === '/all') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({
    service: 'Collective Memory',
    version: '1.0.0',
    endpoints: {
      '/record': 'POST',
      '/recall?topic=': 'GET',
      '/all': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8119;
server.listen(PORT, () => logger.info(`🧠 Collective Memory on :${PORT}`));
module.exports = {
  recordMemory,
  recall
};
const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/* © 2026 Heady™ — Context Weaver: Intelligently manages conversation context windows */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/context-weaver.json');
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      sessions: [],
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
function weaveContext(messages, maxTokens) {
  maxTokens = maxTokens || 4096;
  const scored = messages.map((m, i) => {
    const recency = 1 - Math.pow(1 / PHI, (messages.length - i) * 0.3);
    const importance = m.importance || 0.5;
    const relevance = m.relevance || 0.5;
    const score = recency * 0.4 + importance * 0.35 + relevance * 0.25;
    return {
      ...m,
      score,
      estimatedTokens: Math.ceil(m.content.length / 4)
    };
  });
  const sorted = scored.sort((a, b) => b.score - a.score);
  let budget = maxTokens;
  const selected = [];
  for (const m of sorted) {
    if (m.estimatedTokens <= budget) {
      selected.push(m);
      budget -= m.estimatedTokens;
    }
  }
  return {
    selectedMessages: selected.sort((a, b) => (a.index || 0) - (b.index || 0)),
    droppedCount: messages.length - selected.length,
    tokenBudgetUsed: maxTokens - budget,
    tokenBudgetRemaining: budget
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
    service: 'context-weaver'
  }));
  if (parsed.pathname === '/weave' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        messages,
        maxTokens
      } = JSON.parse(body);
      res.end(JSON.stringify(weaveContext(messages || [], maxTokens), null, 2));
    });
    return;
  }
  res.end(JSON.stringify({
    service: 'Context Weaver',
    version: '1.0.0',
    endpoints: {
      '/weave': 'POST {messages,maxTokens}'
    }
  }));
});
const PORT = process.env.PORT || 8125;
server.listen(PORT, () => logger.info(`🧶 Context Weaver on :${PORT}`));
module.exports = {
  weaveContext
};
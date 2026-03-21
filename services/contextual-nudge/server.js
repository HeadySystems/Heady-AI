const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * Contextual Nudge Engine — Right information at the right moment
 * Proactive suggestions based on user patterns, not reactive Q&A.
 */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/nudge-store.json');
const NUDGE_TYPES = {
  productivity: {
    cooldown: 30 * 60000,
    templates: ['Time for a focused work session?', 'Your most productive hours are approaching', 'Consider batching similar tasks']
  },
  learning: {
    cooldown: 120 * 60000,
    templates: ['Review yesterday\'s learnings (spaced repetition)', 'New content available in your interest areas', 'Time for a knowledge check']
  },
  wellness: {
    cooldown: 60 * 60000,
    templates: ['Take a stretch break', 'Hydration reminder', 'Consider a mindful moment']
  },
  social: {
    cooldown: 240 * 60000,
    templates: ['Reach out to a connection you haven\'t talked to recently', 'Share your recent achievement']
  },
  creative: {
    cooldown: 180 * 60000,
    templates: ['Capture a random idea before it fades', 'Try looking at your current problem from a different angle']
  }
};
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      nudges: [],
      preferences: {},
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
function generateNudge(context) {
  const type = context?.type || 'productivity';
  const config = NUDGE_TYPES[type] || NUDGE_TYPES.productivity;
  const template = config.templates[Math.floor(Math.random() * config.templates.length)];
  return {
    id: `nudge_${Date.now()}`,
    type,
    message: template,
    urgency: 1 / PHI,
    generated: new Date().toISOString()
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
    service: 'contextual-nudge'
  }));
  if (parsed.pathname === '/nudge') {
    const nudge = generateNudge(parsed.query);
    return res.end(JSON.stringify(nudge));
  }
  if (parsed.pathname === '/types') return res.end(JSON.stringify(NUDGE_TYPES, null, 2));
  res.end(JSON.stringify({
    service: 'Contextual Nudge Engine',
    version: '1.0.0',
    endpoints: {
      '/nudge?type=': 'GET',
      '/types': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8118;
server.listen(PORT, () => logger.info(`💡 Contextual Nudge on :${PORT}`));
module.exports = {
  generateNudge,
  NUDGE_TYPES
};
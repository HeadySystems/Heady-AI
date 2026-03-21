const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * HeadyMentor — Life-Skill Mentoring with Swarm Wisdom
 * Each mentor = a swarm configuration optimized for specific life domains.
 */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/mentor-store.json');
const MENTOR_DOMAINS = {
  career: {
    swarms: ['Navigator', 'Strategist', 'Scout'],
    principles: ['Goal setting', 'Network building', 'Skill gap analysis']
  },
  finance: {
    swarms: ['Analyst', 'Optimizer', 'Guardian'],
    principles: ['Budgeting', 'Investing basics', 'Risk assessment']
  },
  health: {
    swarms: ['Healer', 'Optimizer', 'Sage'],
    principles: ['Habit stacking', 'Sleep hygiene', 'Stress management']
  },
  relationships: {
    swarms: ['Diplomat', 'Connector', 'Storyteller'],
    principles: ['Active listening', 'Boundary setting', 'Empathy']
  },
  creativity: {
    swarms: ['Creator', 'Dreamer', 'Alchemist'],
    principles: ['Creative blocks', 'Inspiration sources', 'Iterative refinement']
  },
  learning: {
    swarms: ['Researcher', 'Sage', 'Oracle'],
    principles: ['Spaced repetition', 'Feynman technique', 'Active recall']
  },
  leadership: {
    swarms: ['Navigator', 'Warrior', 'Diplomat'],
    principles: ['Vision casting', 'Decision making', 'Team building']
  },
  mindfulness: {
    swarms: ['Oracle', 'Healer', 'Dreamer'],
    principles: ['Meditation basics', 'Journaling', 'Gratitude practice']
  }
};
function getMentorSession(domain, topic) {
  const config = MENTOR_DOMAINS[domain] || MENTOR_DOMAINS.learning;
  return {
    id: `session_${Date.now()}`,
    domain,
    topic,
    mentor: config,
    started: new Date().toISOString(),
    phiPacedLessons: config.principles.map((p, i) => ({
      lesson: p,
      intensity: Math.pow(PHI, -(i + 1)),
      order: i + 1
    }))
  };
}
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
function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
    recursive: true
  });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
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
    service: 'heady-mentor'
  }));
  if (parsed.pathname === '/domains') return res.end(JSON.stringify(MENTOR_DOMAINS, null, 2));
  if (parsed.pathname === '/session' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        domain,
        topic
      } = JSON.parse(body);
      const store = loadStore();
      const session = getMentorSession(domain, topic);
      store.sessions.push(session);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify({
        session
      }));
    });
    return;
  }
  res.end(JSON.stringify({
    service: 'HeadyMentor',
    version: '1.0.0',
    endpoints: {
      '/domains': 'GET',
      '/session': 'POST'
    }
  }));
});
const PORT = process.env.PORT || 8115;
server.listen(PORT, () => logger.info(`🧙 HeadyMentor on :${PORT}`));
module.exports = {
  getMentorSession,
  MENTOR_DOMAINS
};
const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * Parallel Universe — Multi-Branch Conversation Forking
 *
 * No platform forks a conversation into N simultaneous branches
 * with different personas and lets you merge results back together.
 * CSL gates evaluate semantic coherence across branches for optimal merge.
 */

const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/parallel-universe-store.json');
const PERSONAS = {
  researcher: {
    style: 'analytical',
    temperature: 0.3,
    focus: 'accuracy and depth'
  },
  creative: {
    style: 'imaginative',
    temperature: 0.9,
    focus: 'novelty and beauty'
  },
  critic: {
    style: 'critical',
    temperature: 0.2,
    focus: 'weaknesses and risks'
  },
  strategist: {
    style: 'strategic',
    temperature: 0.5,
    focus: 'plans and outcomes'
  },
  philosopher: {
    style: 'reflective',
    temperature: 0.7,
    focus: 'meaning and implications'
  },
  pragmatist: {
    style: 'practical',
    temperature: 0.4,
    focus: 'actionable next steps'
  },
  optimist: {
    style: 'positive',
    temperature: 0.6,
    focus: 'opportunities and potential'
  }
};
function fork(conversationId, prompt, branches) {
  const branchConfigs = branches || ['researcher', 'creative', 'critic'];
  const universe = {
    id: `universe_${Date.now()}`,
    conversationId,
    prompt,
    created: new Date().toISOString(),
    branches: branchConfigs.map((persona, i) => ({
      id: `branch_${i}`,
      persona,
      config: PERSONAS[persona] || PERSONAS.researcher,
      spiralPosition: {
        angle: i / branchConfigs.length * Math.PI * 2,
        radius: 100 + i * 30 * PHI
      },
      response: null,
      coherenceScore: null
    })),
    merged: null,
    status: 'forked'
  };
  return universe;
}
function evaluateCoherence(branches) {
  // Semantic coherence: how well do branches agree?
  // Simplified — real implementation would use embeddings
  let totalScore = 0;
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      if (branches[i].response && branches[j].response) {
        // Word overlap as basic coherence proxy
        const wordsA = new Set(branches[i].response.toLowerCase().split(/\W+/));
        const wordsB = new Set(branches[j].response.toLowerCase().split(/\W+/));
        const intersection = [...wordsA].filter(w => wordsB.has(w) && w.length > 3).length;
        const union = new Set([...wordsA, ...wordsB]).size;
        totalScore += intersection / Math.max(1, union);
      }
    }
  }
  const pairs = branches.length * (branches.length - 1) / 2;
  return pairs > 0 ? totalScore / pairs : 0;
}
function merge(universe) {
  const coherence = evaluateCoherence(universe.branches);
  universe.merged = {
    coherenceScore: coherence,
    phiOptimalThreshold: 1 / PHI,
    isCoherent: coherence > 1 / PHI,
    bestBranch: universe.branches.sort((a, b) => (b.coherenceScore || 0) - (a.coherenceScore || 0))[0]?.persona,
    mergedAt: new Date().toISOString()
  };
  universe.status = 'merged';
  return universe;
}
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      universes: [],
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
    service: 'parallel-universe'
  }));
  if (parsed.pathname === '/personas') return res.end(JSON.stringify(PERSONAS, null, 2));
  if (parsed.pathname === '/fork' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        conversationId,
        prompt,
        branches
      } = JSON.parse(body);
      const store = loadStore();
      const universe = fork(conversationId || 'default', prompt, branches);
      store.universes.push(universe);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify({
        created: universe
      }));
    });
    return;
  }
  if (parsed.pathname === '/universes') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({
    service: 'Parallel Universe',
    version: '1.0.0',
    endpoints: {
      '/fork': 'POST',
      '/personas': 'GET',
      '/universes': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8105;
server.listen(PORT, () => logger.info(`🌌 Parallel Universe on :${PORT}`));
module.exports = {
  fork,
  merge,
  evaluateCoherence,
  PERSONAS
};
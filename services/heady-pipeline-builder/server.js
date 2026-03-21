const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * HeadyPipeline Builder — Visual DAG Editing Done Right
 *
 * Current tools (Dify 58K stars, Flowise 30K, Langflow 42K)
 * all create visual spaghetti above 20 nodes.
 * HeadyPipeline uses golden spiral layouts for natural hierarchy.
 * The 22-stage HCFullPipeline is the reference implementation.
 */

const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const TAU = Math.PI * 2;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/pipeline-store.json');

// ── 22-Stage HCFullPipeline Reference ────────────────────────────────
const HC_FULL_PIPELINE = [{
  stage: 1,
  name: 'Ingest',
  type: 'input',
  desc: 'Raw input capture and normalization'
}, {
  stage: 2,
  name: 'Tokenize',
  type: 'process',
  desc: 'Semantic tokenization with φ-scaling'
}, {
  stage: 3,
  name: 'Intent Route',
  type: 'router',
  desc: 'CSL gate intent classification'
}, {
  stage: 4,
  name: 'Context Load',
  type: 'memory',
  desc: 'Load from 3-tier vector memory'
}, {
  stage: 5,
  name: 'Swarm Dispatch',
  type: 'swarm',
  desc: 'Assign to appropriate swarm(s)'
}, {
  stage: 6,
  name: 'Research',
  type: 'agent',
  desc: 'Knowledge gathering and fact-check'
}, {
  stage: 7,
  name: 'Create',
  type: 'agent',
  desc: 'Content generation and synthesis'
}, {
  stage: 8,
  name: 'Analyze',
  type: 'agent',
  desc: 'Pattern recognition and evaluation'
}, {
  stage: 9,
  name: 'CSL Gate α',
  type: 'gate',
  desc: 'First quality/coherence checkpoint'
}, {
  stage: 10,
  name: 'Refine',
  type: 'process',
  desc: 'Iterative improvement loop'
}, {
  stage: 11,
  name: 'Cross-Validate',
  type: 'process',
  desc: 'Multi-model consensus check'
}, {
  stage: 12,
  name: 'CSL Gate β',
  type: 'gate',
  desc: 'Second quality checkpoint'
}, {
  stage: 13,
  name: 'Personalize',
  type: 'process',
  desc: 'Adapt to user preferences/personality'
}, {
  stage: 14,
  name: 'Emotional Scan',
  type: 'process',
  desc: 'Emotional intelligence integration'
}, {
  stage: 15,
  name: 'Safety Filter',
  type: 'filter',
  desc: 'Content safety and alignment check'
}, {
  stage: 16,
  name: 'Format',
  type: 'render',
  desc: 'Output formatting and structuring'
}, {
  stage: 17,
  name: 'Enrich',
  type: 'process',
  desc: 'Add citations, links, metadata'
}, {
  stage: 18,
  name: 'CSL Gate γ',
  type: 'gate',
  desc: 'Final quality gate with φ-threshold'
}, {
  stage: 19,
  name: 'Memory Write',
  type: 'memory',
  desc: 'Store results in vector memory'
}, {
  stage: 20,
  name: 'Learn',
  type: 'feedback',
  desc: 'Update learning engine patterns'
}, {
  stage: 21,
  name: 'Render',
  type: 'output',
  desc: 'Final response delivery'
}, {
  stage: 22,
  name: 'HeadyDistiller',
  type: 'post',
  desc: 'Post-response knowledge distillation'
}];
function goldenSpiralLayout(nodes, width = 800, height = 600) {
  const cx = width / 2,
    cy = height / 2;
  return nodes.map((node, i) => {
    const angle = i * TAU * PHI; // Golden angle
    const r = Math.sqrt(i + 1) * 30;
    return {
      ...node,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      size: 20 + (nodes.length - i) * 0.5 // Larger at center
    };
  });
}
function createPipeline(name, stages) {
  const pipeline = {
    id: `pipe_${Date.now()}`,
    name,
    created: new Date().toISOString(),
    stages: stages || HC_FULL_PIPELINE.slice(0, 10),
    layout: null,
    version: 1,
    runs: 0
  };
  pipeline.layout = goldenSpiralLayout(pipeline.stages);
  return pipeline;
}
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      pipelines: [],
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
    service: 'heady-pipeline-builder'
  }));
  if (parsed.pathname === '/reference') return res.end(JSON.stringify({
    stages: HC_FULL_PIPELINE,
    layout: goldenSpiralLayout(HC_FULL_PIPELINE)
  }));
  if (parsed.pathname === '/create' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        name,
        stages
      } = JSON.parse(body);
      const store = loadStore();
      const pipeline = createPipeline(name, stages);
      store.pipelines.push(pipeline);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify({
        created: pipeline
      }));
    });
    return;
  }
  if (parsed.pathname === '/pipelines') return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({
    service: 'HeadyPipeline Builder',
    version: '1.0.0',
    description: 'Visual DAG editing with golden spiral layouts — 22-stage HCFullPipeline reference',
    endpoints: {
      '/reference': 'GET (22-stage HCFullPipeline)',
      '/create': 'POST',
      '/pipelines': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8103;
server.listen(PORT, () => logger.info(`🔧 HeadyPipeline Builder on :${PORT}`));
module.exports = {
  createPipeline,
  goldenSpiralLayout,
  HC_FULL_PIPELINE
};
const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/* © 2026 Heady™ Systems Inc. — Knowledge Graph Visualizer */
const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const PHI = 1.618033988749895;
const TAU = Math.PI * 2;
function generateGraph(nodes, edges) {
  const positioned = nodes.map((n, i) => {
    const angle = i * TAU / (PHI * PHI);
    const r = Math.sqrt(i + 1) * 60;
    return {
      ...n,
      x: 400 + r * Math.cos(angle),
      y: 300 + r * Math.sin(angle),
      size: 8 + (n.weight || 1) * 3
    };
  });
  return {
    nodes: positioned,
    edges: edges || [],
    stats: {
      nodeCount: nodes.length,
      edgeCount: (edges || []).length,
      density: edges ? 2 * edges.length / (nodes.length * (nodes.length - 1)) : 0
    }
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
    service: 'knowledge-graph'
  }));
  if (parsed.pathname === '/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        nodes,
        edges
      } = JSON.parse(body);
      res.end(JSON.stringify(generateGraph(nodes || [], edges)));
    });
    return;
  }
  if (parsed.pathname === '/demo') {
    const demoNodes = Array.from({
      length: 15
    }, (_, i) => ({
      id: i,
      label: `Concept ${i + 1}`,
      weight: Math.random() * 3 + 1
    }));
    const demoEdges = demoNodes.slice(1).map((n, i) => ({
      from: Math.floor(i / 2),
      to: n.id,
      strength: Math.random()
    }));
    return res.end(JSON.stringify(generateGraph(demoNodes, demoEdges), null, 2));
  }
  res.end(JSON.stringify({
    service: 'Knowledge Graph Visualizer',
    version: '1.0.0',
    endpoints: {
      '/generate': 'POST',
      '/demo': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8120;
server.listen(PORT, () => logger.info(`🕸️ Knowledge Graph on :${PORT}`));
module.exports = {
  generateGraph
};
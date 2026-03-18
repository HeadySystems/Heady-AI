'use strict';

/**
 * heady_topology_query — Query Sacred Geometry topology, find shortest path
 * between nodes, get ring membership, calculate geometric coherence scores.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const TOPOLOGY = {
  center: { ring: 'center', nodes: ['HeadySoul'], weight: FIB[8] },
  inner: { ring: 'inner', nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci', 'HeadyAutoSuccess'], weight: FIB[7] },
  middle: { ring: 'middle', nodes: ['JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS', 'PYTHIA'], weight: FIB[6] },
  outer: { ring: 'outer', nodes: ['BRIDGE', 'MUSE', 'SENTINEL', 'NOVA', 'JANITOR', 'SOPHIA', 'CIPHER', 'LENS'], weight: FIB[5] },
  governance: { ring: 'governance', nodes: ['HeadyCheck', 'HeadyAssure', 'HeadyAware', 'HeadyPatterns', 'HeadyMC', 'HeadyRisks'], weight: FIB[6] },
};

const RING_ORDER = ['center', 'inner', 'middle', 'outer', 'governance'];

function buildAdjacency() {
  const adj = {};
  const allNodes = [];
  const nodeRing = {};
  for (const [ring, data] of Object.entries(TOPOLOGY)) {
    for (const node of data.nodes) {
      allNodes.push(node);
      nodeRing[node] = ring;
      adj[node] = adj[node] || {};
      for (const peer of data.nodes) {
        if (peer !== node) adj[node][peer] = PSI;
      }
    }
  }
  for (let i = 0; i < RING_ORDER.length - 1; i++) {
    const ringA = TOPOLOGY[RING_ORDER[i]];
    const ringB = TOPOLOGY[RING_ORDER[i + 1]];
    for (const a of ringA.nodes) {
      for (const b of ringB.nodes) {
        adj[a] = adj[a] || {};
        adj[b] = adj[b] || {};
        adj[a][b] = PHI;
        adj[b][a] = PHI;
      }
    }
  }
  for (const gNode of TOPOLOGY.governance.nodes) {
    for (const node of allNodes) {
      if (nodeRing[node] !== 'governance') {
        adj[gNode] = adj[gNode] || {};
        adj[node] = adj[node] || {};
        adj[gNode][node] = PHI * PSI;
        adj[node][gNode] = PHI * PSI;
      }
    }
  }
  return { adj, allNodes, nodeRing };
}

function dijkstra(adj, source, target) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  for (const n of Object.keys(adj)) dist[n] = Infinity;
  dist[source] = 0;
  while (true) {
    let u = null;
    let best = Infinity;
    for (const n of Object.keys(dist)) {
      if (!visited.has(n) && dist[n] < best) { best = dist[n]; u = n; }
    }
    if (!u || u === target) break;
    visited.add(u);
    for (const [v, w] of Object.entries(adj[u] || {})) {
      const alt = dist[u] + w;
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }
  const path = [];
  let cur = target;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  if (path[0] !== source) return { path: [], distance: Infinity };
  return { path, distance: dist[target] };
}

function geometricCoherence(nodeRing, nodes) {
  if (!nodes.length) return 0;
  const ringWeights = nodes.map(n => TOPOLOGY[nodeRing[n]]?.weight || 0);
  const mean = ringWeights.reduce((a, b) => a + b, 0) / ringWeights.length;
  const variance = ringWeights.reduce((a, w) => a + (w - mean) ** 2, 0) / ringWeights.length;
  const normalized = 1 / (1 + variance / (FIB[8] * PHI));
  return Math.min(1, normalized * PHI * PSI + PSI * PSI);
}

function correlationId() {
  return `topo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 1000 && code < 2000) return 'TOPOLOGY_ERROR';
  if (code >= 2000 && code < 3000) return 'PATH_ERROR';
  return 'UNKNOWN_ERROR';
}

const name = 'heady_topology_query';

const description = 'Query Sacred Geometry topology: find shortest path between nodes, get ring membership, calculate geometric coherence scores across the Heady ecosystem.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['shortest_path', 'ring_membership', 'coherence_score', 'list_nodes', 'neighbors'], description: 'Query action to perform' },
    source: { type: 'string', description: 'Source node name (for shortest_path)' },
    target: { type: 'string', description: 'Target node name (for shortest_path)' },
    node: { type: 'string', description: 'Node name (for ring_membership, neighbors)' },
    nodes: { type: 'array', items: { type: 'string' }, description: 'Node list (for coherence_score)' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();
  const { adj, allNodes, nodeRing } = buildAdjacency();

  try {
    switch (params.action) {
      case 'shortest_path': {
        if (!params.source || !params.target) throw { code: 2001, message: 'source and target required' };
        if (!adj[params.source]) throw { code: 1001, message: `Unknown node: ${params.source}` };
        if (!adj[params.target]) throw { code: 1002, message: `Unknown node: ${params.target}` };
        const result = dijkstra(adj, params.source, params.target);
        const csl = result.distance < Infinity ? Math.max(CSL.MINIMUM, 1 - result.distance / (FIB[8] * PHI)) : 0;
        return { jsonrpc: '2.0', result: { path: result.path, distance: Number(result.distance.toFixed(6)), hops: result.path.length - 1, csl_confidence: Number(csl.toFixed(6)), correlation_id: cid, timestamp: ts } };
      }
      case 'ring_membership': {
        if (!params.node) throw { code: 1003, message: 'node required' };
        const ring = nodeRing[params.node];
        if (!ring) throw { code: 1004, message: `Unknown node: ${params.node}` };
        const data = TOPOLOGY[ring];
        return { jsonrpc: '2.0', result: { node: params.node, ring, ring_weight: data.weight, peers: data.nodes.filter(n => n !== params.node), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }
      case 'coherence_score': {
        const nodes = params.nodes || allNodes;
        const valid = nodes.filter(n => nodeRing[n]);
        const score = geometricCoherence(nodeRing, valid);
        return { jsonrpc: '2.0', result: { coherence: Number(score.toFixed(6)), node_count: valid.length, invalid_nodes: nodes.filter(n => !nodeRing[n]), csl_confidence: score >= CSL.HIGH ? CSL.CRITICAL : score >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM, correlation_id: cid, timestamp: ts } };
      }
      case 'list_nodes': {
        const rings = {};
        for (const [ring, data] of Object.entries(TOPOLOGY)) rings[ring] = { nodes: data.nodes, weight: data.weight };
        return { jsonrpc: '2.0', result: { rings, total_nodes: allNodes.length, phi_ratio: PHI, csl_confidence: CSL.CRITICAL, correlation_id: cid, timestamp: ts } };
      }
      case 'neighbors': {
        if (!params.node) throw { code: 1005, message: 'node required' };
        if (!adj[params.node]) throw { code: 1006, message: `Unknown node: ${params.node}` };
        const neighbors = Object.entries(adj[params.node]).map(([n, w]) => ({ node: n, ring: nodeRing[n], weight: Number(w.toFixed(6)) }));
        neighbors.sort((a, b) => a.weight - b.weight);
        return { jsonrpc: '2.0', result: { node: params.node, ring: nodeRing[params.node], neighbors, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }
      default:
        throw { code: 1000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 1999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Internal topology error', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  const { allNodes, nodeRing } = buildAdjacency();
  const coherence = geometricCoherence(nodeRing, allNodes);
  return { status: coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: Number(coherence.toFixed(6)), node_count: allNodes.length, ring_count: RING_ORDER.length, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };

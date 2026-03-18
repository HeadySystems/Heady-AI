'use strict';

/**
 * heady_knowledge_propagate — Mycelium-network knowledge sharing across
 * disconnected Heady instances via gossip protocols and embedding diffusion.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };
const EMBEDDING_DIM = 384;

const networkNodes = new Map();
const messageLog = [];
let msgSeq = 0;

function correlationId() {
  return `mycel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 10000 && code < 10500) return 'PROPAGATION_INPUT_ERROR';
  if (code >= 10500 && code < 11000) return 'PROPAGATION_NETWORK_ERROR';
  return 'UNKNOWN_ERROR';
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateEmbedding(text) {
  const vec = new Float32Array(EMBEDDING_DIM);
  const h = hashSimple(text);
  for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] = Math.sin((h + i) * PHI) * PSI;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function registerNode(nodeId, config) {
  const node = {
    id: nodeId,
    knowledge: [],
    peers: new Set(),
    config: config || {},
    seen_messages: new Set(),
    gossip_count: 0,
    created_at: new Date().toISOString(),
  };
  networkNodes.set(nodeId, node);
  return node;
}

function propagateGossip(sourceId, knowledge, ttl) {
  const source = networkNodes.get(sourceId);
  if (!source) throw { code: 10501, message: `Node not found: ${sourceId}` };

  const msgId = `msg_${++msgSeq}_${Date.now().toString(36)}`;
  const embedding = generateEmbedding(typeof knowledge === 'string' ? knowledge : JSON.stringify(knowledge));
  const message = { id: msgId, source: sourceId, knowledge, embedding, ttl, created_at: new Date().toISOString(), hops: 0 };

  const reached = new Set([sourceId]);
  const queue = [{ nodeId: sourceId, hop: 0 }];
  const deliveries = [];

  source.knowledge.push({ content: knowledge, embedding, received_at: message.created_at, from: 'self' });
  source.seen_messages.add(msgId);

  while (queue.length > 0) {
    const { nodeId, hop } = queue.shift();
    if (hop >= ttl) continue;
    const node = networkNodes.get(nodeId);
    if (!node) continue;

    for (const peerId of node.peers) {
      if (reached.has(peerId)) continue;
      reached.add(peerId);

      const peer = networkNodes.get(peerId);
      if (!peer || peer.seen_messages.has(msgId)) continue;

      peer.seen_messages.add(msgId);
      const relevance = peer.knowledge.length > 0
        ? Math.max(...peer.knowledge.map(k => cosineSimilarity(embedding, k.embedding)))
        : CSL.MEDIUM;
      const decay = Math.pow(PSI, hop + 1);
      const effectiveRelevance = relevance * decay;

      if (effectiveRelevance >= CSL.MINIMUM * PSI) {
        peer.knowledge.push({ content: knowledge, embedding, received_at: new Date().toISOString(), from: sourceId, hops: hop + 1 });
        peer.gossip_count++;
        deliveries.push({ node: peerId, hops: hop + 1, relevance: Number(effectiveRelevance.toFixed(6)), decay: Number(decay.toFixed(6)) });
        queue.push({ nodeId: peerId, hop: hop + 1 });
      }
    }
  }

  messageLog.push({ ...message, deliveries: deliveries.length });
  return { message_id: msgId, deliveries, nodes_reached: reached.size, total_network_size: networkNodes.size };
}

function diffuseEmbeddings(iterations) {
  const nodes = Array.from(networkNodes.values()).filter(n => n.knowledge.length > 0);
  const results = [];

  for (let iter = 0; iter < iterations; iter++) {
    let totalDrift = 0;
    for (const node of nodes) {
      for (const peerId of node.peers) {
        const peer = networkNodes.get(peerId);
        if (!peer || peer.knowledge.length === 0) continue;
        const peerAvg = new Float32Array(EMBEDDING_DIM);
        for (const k of peer.knowledge) for (let i = 0; i < EMBEDDING_DIM; i++) peerAvg[i] += k.embedding[i];
        for (let i = 0; i < EMBEDDING_DIM; i++) peerAvg[i] /= peer.knowledge.length;

        for (const k of node.knowledge) {
          const sim = cosineSimilarity(k.embedding, peerAvg);
          const alpha = PSI * Math.pow(PSI, iter);
          for (let i = 0; i < EMBEDDING_DIM; i++) k.embedding[i] = k.embedding[i] * (1 - alpha) + peerAvg[i] * alpha;
          const norm = Math.sqrt(k.embedding.reduce((s, v) => s + v * v, 0));
          if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) k.embedding[i] /= norm;
          totalDrift += Math.abs(1 - sim);
        }
      }
    }
    results.push({ iteration: iter, total_drift: Number(totalDrift.toFixed(6)), phi_decay: Number(Math.pow(PSI, iter).toFixed(6)) });
  }
  return results;
}

const name = 'heady_knowledge_propagate';

const description = 'Mycelium-network knowledge sharing across Heady instances via gossip protocols and 384D embedding diffusion. Register nodes, connect peers, propagate knowledge with phi-decayed relevance.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['register', 'connect', 'propagate', 'diffuse', 'query', 'network_status'], description: 'Network action' },
    node_id: { type: 'string', description: 'Node identifier' },
    peer_id: { type: 'string', description: 'Peer node to connect to' },
    knowledge: { description: 'Knowledge to propagate (string or object)' },
    ttl: { type: 'number', description: 'Propagation hop limit (default: Fib(4)=3)' },
    diffusion_iterations: { type: 'number', description: 'Embedding diffusion iterations (default: Fib(4)=3)' },
    query_text: { type: 'string', description: 'Text to search for across the network' },
    config: { type: 'object' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'register': {
        if (!params.node_id) throw { code: 10001, message: 'node_id required' };
        if (networkNodes.has(params.node_id)) throw { code: 10002, message: `Node already exists: ${params.node_id}` };
        const node = registerNode(params.node_id, params.config);
        return { jsonrpc: '2.0', result: { node_id: node.id, registered: true, network_size: networkNodes.size, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'connect': {
        if (!params.node_id || !params.peer_id) throw { code: 10003, message: 'node_id and peer_id required' };
        const node = networkNodes.get(params.node_id);
        const peer = networkNodes.get(params.peer_id);
        if (!node) throw { code: 10502, message: `Node not found: ${params.node_id}` };
        if (!peer) throw { code: 10503, message: `Peer not found: ${params.peer_id}` };
        node.peers.add(params.peer_id);
        peer.peers.add(params.node_id);
        return { jsonrpc: '2.0', result: { connected: [params.node_id, params.peer_id], node_peers: node.peers.size, peer_peers: peer.peers.size, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'propagate': {
        if (!params.node_id) throw { code: 10004, message: 'node_id required' };
        if (!params.knowledge) throw { code: 10005, message: 'knowledge required' };
        const ttl = params.ttl || FIB[4];
        const result = propagateGossip(params.node_id, params.knowledge, ttl);
        const coverage = result.nodes_reached / (result.total_network_size || 1);
        return { jsonrpc: '2.0', result: { ...result, coverage: Number(coverage.toFixed(6)), phi_reach: Number((coverage * PHI).toFixed(6)), csl_confidence: coverage >= PSI ? CSL.HIGH : CSL.MEDIUM, correlation_id: cid, timestamp: ts } };
      }

      case 'diffuse': {
        const iterations = params.diffusion_iterations || FIB[4];
        const results = diffuseEmbeddings(iterations);
        return { jsonrpc: '2.0', result: { diffusion_log: results, iterations_completed: results.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'query': {
        if (!params.query_text) throw { code: 10006, message: 'query_text required' };
        const queryEmb = generateEmbedding(params.query_text);
        const results = [];
        for (const [nodeId, node] of networkNodes) {
          for (const k of node.knowledge) {
            const sim = cosineSimilarity(queryEmb, k.embedding);
            if (sim >= CSL.MINIMUM) results.push({ node: nodeId, content: k.content, similarity: Number(sim.toFixed(6)), received_at: k.received_at });
          }
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return { jsonrpc: '2.0', result: { matches: results.slice(0, FIB[6]), total_matches: results.length, csl_confidence: results.length > 0 ? CSL.HIGH : CSL.MEDIUM, correlation_id: cid, timestamp: ts } };
      }

      case 'network_status': {
        const nodes = [];
        for (const [id, n] of networkNodes) nodes.push({ id, peers: n.peers.size, knowledge_count: n.knowledge.length, gossip_count: n.gossip_count });
        return { jsonrpc: '2.0', result: { nodes, total_nodes: networkNodes.size, total_messages: messageLog.length, total_knowledge: nodes.reduce((s, n) => s + n.knowledge_count, 0), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 10000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 10999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Knowledge propagation failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', network_nodes: networkNodes.size, messages_sent: messageLog.length, embedding_dim: EMBEDDING_DIM, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };

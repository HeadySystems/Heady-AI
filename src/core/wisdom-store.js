// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Wisdom Store — Long-term Knowledge Retention with Graph Structure
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, normalize, sha256, phiFusionWeights,
  deterministicRandom, SEED
} from '../shared/phi-math-v2.js';
import { textToEmbedding, cslAND, DIM } from '../shared/csl-engine-v2.js';

class WisdomNode {
  constructor(id, content, embedding, category) {
    this.id = id;
    this.content = content;
    this.embedding = embedding;
    this.category = category;
    this.importance = CSL_THRESHOLDS.MEDIUM;
    this.accessCount = 0;
    this.lastAccessed = Date.now();
    this.createdAt = Date.now();
    this.connections = new Map();
    this.metadata = {};
  }

  updateImportance(score) {
    const weights = phiFusionWeights(3);
    this.importance = weights[0] * score + weights[1] * this.importance + weights[2] * (this.accessCount / FIB[10]);
  }
}

class WisdomStore {
  #nodes;
  #categories;
  #maxNodes;
  #pruneThreshold;
  #importanceWeights;

  constructor() {
    this.#nodes = new Map();
    this.#categories = new Map();
    this.#maxNodes = FIB[20]; // 6765
    this.#pruneThreshold = CSL_THRESHOLDS.MINIMUM;
    this.#importanceWeights = {
      importance: PSI2 + PSI3,   // ≈ 0.486 (replaces 0.5)
      recency:    PSI3 + PSI3 * PSI, // ≈ 0.300
      relevance:  PSI3 * PSI2,  // ≈ 0.214 (sums ≈ 1.0)
    };
  }

  async store(content, category = 'general', metadata = {}) {
    const embedding = textToEmbedding(content);
    const id = await sha256(content + ':' + Date.now());

    const node = new WisdomNode(id, content, embedding, category);
    node.metadata = metadata;

    const related = this.#findRelatedNodes(embedding, FIB[5]);
    for (const rel of related) {
      const strength = cosineSimilarity(embedding, rel.embedding);
      if (strength >= CSL_THRESHOLDS.LOW) {
        node.connections.set(rel.id, strength);
        rel.connections.set(id, strength);
      }
    }

    this.#nodes.set(id, node);

    if (!this.#categories.has(category)) {
      this.#categories.set(category, new Set());
    }
    this.#categories.get(category).add(id);

    if (this.#nodes.size > this.#maxNodes) {
      await this.prune();
    }

    return { id, connections: node.connections.size, category };
  }

  recall(query, limit = FIB[6], category = null) {
    const queryEmb = typeof query === 'string' ? textToEmbedding(query) : query;
    let candidates = Array.from(this.#nodes.values());

    if (category) {
      const catIds = this.#categories.get(category);
      if (catIds) {
        candidates = candidates.filter(n => catIds.has(n.id));
      }
    }

    const scored = candidates.map(node => {
      node.accessCount++;
      node.lastAccessed = Date.now();

      const relevance = cosineSimilarity(queryEmb, node.embedding);
      const recencyScore = Math.exp(-((Date.now() - node.lastAccessed) / (FIB[12] * 60000)));
      const compositeScore =
        this.#importanceWeights.importance * node.importance +
        this.#importanceWeights.recency * recencyScore +
        this.#importanceWeights.relevance * relevance;

      return { node, relevance, recencyScore, compositeScore };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    return scored.slice(0, limit).map(s => ({
      id: s.node.id,
      content: s.node.content,
      category: s.node.category,
      relevance: s.relevance,
      compositeScore: s.compositeScore,
      connections: s.node.connections.size,
    }));
  }

  async prune(threshold = null) {
    const pruneT = threshold || this.#pruneThreshold;
    const now = Date.now();
    const maxAge = FIB[12] * 24 * 60 * 60 * 1000; // 144 days
    const pruned = [];

    for (const [id, node] of this.#nodes) {
      const age = now - node.createdAt;
      const ageRatio = age / maxAge;
      const retentionScore = node.importance * (1 - ageRatio * PSI);

      if (retentionScore < pruneT && node.accessCount < FIB[5]) {
        for (const [connId] of node.connections) {
          const connNode = this.#nodes.get(connId);
          if (connNode) connNode.connections.delete(id);
        }

        const catSet = this.#categories.get(node.category);
        if (catSet) catSet.delete(id);

        this.#nodes.delete(id);
        pruned.push(id);
      }
    }

    return { pruned: pruned.length, remaining: this.#nodes.size };
  }

  getWisdomGraph() {
    const nodes = [];
    const edges = [];

    for (const [id, node] of this.#nodes) {
      nodes.push({
        id, category: node.category, importance: node.importance,
        connections: node.connections.size, accessCount: node.accessCount,
      });
      for (const [connId, strength] of node.connections) {
        if (id < connId) {
          edges.push({ from: id, to: connId, strength });
        }
      }
    }

    return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
  }

  findRelated(query, limit = FIB[6]) {
    const queryEmb = typeof query === 'string' ? textToEmbedding(query) : query;
    return this.#findRelatedNodes(queryEmb, limit).map(n => ({
      id: n.id, content: n.content, category: n.category,
      similarity: cosineSimilarity(queryEmb, n.embedding),
    }));
  }

  getCategories() {
    const result = {};
    for (const [cat, ids] of this.#categories) {
      result[cat] = ids.size;
    }
    return result;
  }

  getStats() {
    return {
      totalNodes: this.#nodes.size,
      totalCategories: this.#categories.size,
      maxCapacity: this.#maxNodes,
      utilizationPct: (this.#nodes.size / this.#maxNodes) * 100,
    };
  }

  #findRelatedNodes(embedding, limit) {
    const scored = Array.from(this.#nodes.values()).map(node => ({
      node,
      similarity: cosineSimilarity(embedding, node.embedding),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit).map(s => s.node);
  }
}

export { WisdomStore, WisdomNode };
export default WisdomStore;

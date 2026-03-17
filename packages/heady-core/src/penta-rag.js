/**
 * Heady™ PentaRAG — 5-Layer Memory Routing
 * L1: Redis KV exact match → L2: Qdrant semantic cache → L3: Memory recall
 * L4: Neon session memory → L5: pgvector HNSW full retrieval
 * Patent coverage: HS-052 (Shadow Memory Persistence)
 * @module core/memory/penta-rag
 */
import { CSL, PHI, TIMING } from '../constants/phi.js';

export class PentaRAG {
  constructor({ redis, qdrant, neon, embedder, sessionId, logger }) {
    this.redis = redis; this.qdrant = qdrant; this.neon = neon;
    this.embedder = embedder; this.sessionId = sessionId;
    this.log = logger ?? console;
    this.stats = { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, total: 0 };
  }

  async retrieve(query, options = {}) {
    const start = Date.now(); this.stats.total++;
    const embedding = await this.embedder(query);
    const cacheKey = this.#hashQuery(query);
    const l1 = await this.redis?.get(`prag:l1:${cacheKey}`);
    if (l1) { this.stats.l1++; return this.#respond(JSON.parse(l1), 'L1', start); }
    const l2result = await this.#semanticCacheSearch(embedding, query);
    if (l2result) {
      this.stats.l2++;
      await this.redis?.setex(`prag:l1:${cacheKey}`, 300, JSON.stringify(l2result.payload));
      return this.#respond(l2result.payload, 'L2', start);
    }
    if (options.allowMemoryRecall && this.#isFactualQuery(query)) {
      this.stats.l3++;
      return this.#respond({ source: 'memory_recall', query }, 'L3', start);
    }
    const l4result = await this.#sessionMemorySearch(embedding, query);
    if (l4result && l4result.confidence > CSL.BOOST) {
      this.stats.l4++; return this.#respond(l4result, 'L4', start);
    }
    const l5result = await this.#fullRetrieval(embedding, query, options);
    this.stats.l5++;
    await this.#warmCaches(embedding, query, l5result);
    return this.#respond(l5result, 'L5', start);
  }

  async #semanticCacheSearch(embedding, query) {
    if (!this.qdrant) return null;
    const results = await this.qdrant.search('heady_semantic_cache', { vector: embedding, limit: 1, score_threshold: CSL.BOOST });
    return results[0] ?? null;
  }

  async #sessionMemorySearch(embedding, query) {
    if (!this.neon) return null;
    const rows = await this.neon.query(
      `SELECT content, metadata, 1 - (embedding <=> $1::vector) AS confidence FROM heady_session_memory WHERE session_id = $2 AND 1 - (embedding <=> $1::vector) > $3 ORDER BY embedding <=> $1::vector LIMIT 3`,
      [JSON.stringify(embedding), this.sessionId, CSL.INCLUDE]
    );
    return rows[0] ?? null;
  }

  async #fullRetrieval(embedding, query, { topK = 5 } = {}) {
    const rows = await this.neon.query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS similarity FROM heady_knowledge WHERE 1 - (embedding <=> $1::vector) > $2 ORDER BY embedding <=> $1::vector LIMIT $3`,
      [JSON.stringify(embedding), CSL.INCLUDE, topK]
    );
    return { chunks: rows, query, source: 'pgvector' };
  }

  async #warmCaches(embedding, query, result) {
    await this.qdrant?.upsert('heady_semantic_cache', { points: [{ id: this.#hashQuery(query), vector: embedding, payload: result }] }).catch(() => {});
    await this.neon?.query(
      `INSERT INTO heady_session_memory (session_id, content, embedding, metadata) VALUES ($1, $2, $3::vector, $4) ON CONFLICT (session_id, content) DO NOTHING`,
      [this.sessionId, query, JSON.stringify(embedding), JSON.stringify({ ts: Date.now() })]
    ).catch(() => {});
  }

  #isFactualQuery(q) { return /^(what is|who is|when was|define|explain)\b/i.test(q); }
  #hashQuery(q) { let h=0x9e3779b9; for(let i=0;i<q.length;i++) h=Math.imul(h^q.charCodeAt(i),0x9e3779b1); return (h>>>0).toString(16); }
  #respond(data, layer, start) { return { data, layer, latencyMs: Date.now()-start, stats: {...this.stats} }; }
  getCacheHitRate() { const{l1,l2,l3,l4,total}=this.stats; return total>0?(l1+l2+l3+l4)/total:0; }
}

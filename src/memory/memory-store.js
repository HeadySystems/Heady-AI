import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// ── 384D Embedding Generation ────────────────────────────────────────────────

const DIMS = 384;

/**
 * Deterministic local embedding: FNV-1a hash → 384D unit vector.
 * Zero external dependencies, always available as fallback.
 */
function localEmbed(text) {
  const vec = new Float32Array(DIMS);
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // LCG expansion to fill 384 dimensions
  let s = h >>> 0;
  for (let i = 0; i < DIMS; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    vec[i] = (s / 0xFFFFFFFF) * 2 - 1; // [-1, 1]
  }
  // L2 normalize
  let mag = 0;
  for (let i = 0; i < DIMS; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag > 0) for (let i = 0; i < DIMS; i++) vec[i] /= mag;
  return Array.from(vec);
}

/**
 * OpenAI embedding via text-embedding-3-small (truncated to 384D).
 * Returns null if API key unavailable or call fails.
 */
async function openaiEmbed(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: 'text-embedding-3-small', dimensions: DIMS }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data[0].embedding; // Already 384D from dimensions param
  } catch {
    return null;
  }
}

/**
 * Generate 384D embedding: tries OpenAI first, falls back to local deterministic.
 */
async function generateEmbedding(text) {
  const vec = await openaiEmbed(text);
  if (vec) return { embedding: vec, provider: 'openai' };
  return { embedding: localEmbed(text), provider: 'local' };
}

// ── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const PSI = 0.618033988749895; // Minimum relevance gate

// ── MemoryStore ──────────────────────────────────────────────────────────────

class MemoryStore {
  constructor() {
    this.storePath = process.env.MEMORY_STORE_PATH || './data/memory';
    this.memories = [];
    this._ensureDirectory();
    this._loadFromDisk();
  }

  _ensureDirectory() {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
  }

  _loadFromDisk() {
    const indexPath = path.join(this.storePath, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        this.memories = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        logger.info(`[MemoryStore] Loaded ${this.memories.length} memories from disk`);
      } catch (err) {
        logger.error(`[MemoryStore] Failed to load index: ${err.message}`);
        this.memories = [];
      }
    }
  }

  _saveToDisk() {
    const indexPath = path.join(this.storePath, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(this.memories, null, 2));
  }

  getStatus() {
    return {
      memories: this.memories.length,
      storePath: this.storePath,
      maxEntries: parseInt(process.env.MEMORY_MAX_ENTRIES) || 100000,
      embeddedCount: this.memories.filter(m => m.embedding).length,
      dimensions: DIMS,
    };
  }

  async ingest(content, metadata = {}) {
    const { embedding, provider } = await generateEmbedding(content);

    const memory = {
      id: uuidv4(),
      content,
      metadata,
      embedding,
      embeddingProvider: provider,
      createdAt: new Date().toISOString(),
    };
    this.memories.push(memory);
    this._saveToDisk();
    logger.info(`[MemoryStore] Ingested memory ${memory.id} (${provider} ${DIMS}D)`);
    return { success: true, id: memory.id, provider, dimensions: DIMS };
  }

  async query(queryText, limit = 10) {
    const { embedding: queryVec } = await generateEmbedding(queryText);

    // Vector similarity search with CSL gate
    const scored = this.memories
      .filter(m => m.embedding)
      .map(m => ({
        ...m,
        score: cosineSimilarity(queryVec, m.embedding),
      }))
      .filter(m => m.score >= PSI) // CSL gate: ψ ≈ 0.618 minimum relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length > 0) {
      // Strip embeddings from response (large arrays)
      return scored.map(({ embedding, ...rest }) => rest);
    }

    // Fallback: text search if no vector matches above threshold
    return this.memories
      .filter(m => m.content.toLowerCase().includes(queryText.toLowerCase()))
      .slice(0, limit)
      .map(({ embedding, ...rest }) => ({ ...rest, score: null }));
  }
}

export { MemoryStore };

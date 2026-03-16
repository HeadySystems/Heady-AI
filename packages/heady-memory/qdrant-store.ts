// packages/heady-memory/qdrant-store.ts
// Extracted from qdrant/qdrant-js (Apache 2.0)
// Production HNSW vector store for Heady CSL latent space
//
// HEADY_BRAND:BEGIN
// © 2026 HeadySystems Inc. — Qdrant HNSW Vector Store
// HEADY_BRAND:END

const COLLECTION = 'heady_user_vectors';
const VECTOR_DIM = 384; // CSL engine uses 384-dim by default
const PHI = 1.618033988749895;
const CSL_GATE_THRESHOLD = 1 / PHI; // 0.618...

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export interface MemorySearchResult {
  content: string;
  score: number;
  cslScore: number;
  timestamp: number;
}

export class HeadyQdrantStore {
  private url: string;
  private apiKey?: string;

  constructor(config?: QdrantConfig) {
    this.url = config?.url || process.env.QDRANT_URL || 'https://qdrant.headysystems.com';
    this.apiKey = config?.apiKey || process.env.QDRANT_API_KEY;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['api-key'] = this.apiKey;

    const res = await fetch(`${this.url}${path}`, {
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Qdrant error ${res.status}: ${body}`);
    }
    return res.json();
  }

  async ensureCollection(): Promise<void> {
    // Check if collection exists
    try {
      await this.request(`/collections/${COLLECTION}`);
      return; // already exists
    } catch {
      // Collection doesn't exist — create it
    }

    await this.request(`/collections/${COLLECTION}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
          hnsw_config: {
            m: 16,             // connections per node
            ef_construct: 200, // build quality (higher = better recall)
            full_scan_threshold: 10000,
          },
        },
        optimizers_config: {
          default_segment_number: 4,
        },
      }),
    });

    // Create payload index for user-scoped search
    await this.request(`/collections/${COLLECTION}/index`, {
      method: 'PUT',
      body: JSON.stringify({
        field_name: 'userId',
        field_schema: 'Keyword',
      }),
    });
  }

  async upsertMemory(
    userId: string,
    content: string,
    vector: number[],
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const pointId = crypto.randomUUID();

    await this.request(`/collections/${COLLECTION}/points`, {
      method: 'PUT',
      body: JSON.stringify({
        wait: true,
        points: [{
          id: pointId,
          vector,
          payload: {
            userId,
            content,
            timestamp: Date.now(),
            cslScore: (metadata as any).cslScore || 0,
            ...metadata,
          },
        }],
      }),
    });

    return pointId;
  }

  async searchUserMemory(
    userId: string,
    queryVector: number[],
    topK = 21 // Fibonacci
  ): Promise<MemorySearchResult[]> {
    const result = await this.request(`/collections/${COLLECTION}/points/query`, {
      method: 'POST',
      body: JSON.stringify({
        query: queryVector,
        limit: topK,
        filter: {
          must: [{ key: 'userId', match: { value: userId } }],
        },
        with_payload: true,
        score_threshold: CSL_GATE_THRESHOLD, // φ⁻¹ = 0.618 — only retrieve above threshold
      }),
    });

    return (result.points || result.result || []).map((p: any) => ({
      content: p.payload?.content || '',
      score: p.score || 0,
      cslScore: p.payload?.cslScore || 0,
      timestamp: p.payload?.timestamp || 0,
    }));
  }

  async bootstrapUserContext(userId: string, queryVector: number[]): Promise<string[]> {
    const memories = await this.searchUserMemory(userId, queryVector, 21);
    return memories.map(m => m.content);
  }

  async deleteUserMemories(userId: string): Promise<void> {
    await this.request(`/collections/${COLLECTION}/points/delete`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          must: [{ key: 'userId', match: { value: userId } }],
        },
      }),
    });
  }

  async getCollectionInfo(): Promise<any> {
    return this.request(`/collections/${COLLECTION}`);
  }
}

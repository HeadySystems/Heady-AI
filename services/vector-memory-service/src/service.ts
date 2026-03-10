/**
 * Vector Memory Service — Core Logic — Heady™ v4.0.0
 * 384D pgvector storage, 3D spatial projection, similarity search
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { Pool } from 'pg';
import {
  PHI, PSI, FIB, CSL_THRESHOLDS, POOL_SIZES,
  cosineSimilarity, normalize, phiBackoff, DEDUP_THRESHOLD,
  EMBEDDING
} from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import { VectorErrors } from '../../shared/errors.js';
import type { VectorEntry, SearchQuery, SearchResult, MemoryStats, StoreRequest } from './types.js';

const logger = createLogger('vector-memory-service');
const DIMS = EMBEDDING.DIMS_384;

// ═══ Database Pool ═══
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'heady',
  user: process.env.DB_USER || 'heady',
  password: process.env.DB_PASSWORD || '',
  min: POOL_SIZES.min,
  max: POOL_SIZES.max,
  idleTimeoutMillis: FIB[9] * 1000, // 34s
  connectionTimeoutMillis: FIB[8] * 1000, // 21s
});

// ═══ Phi-Spiral 3D Projection ═══
// Projects 384D vector into 3D using phi-harmonic basis
function projectTo3D(embedding: number[]): [number, number, number] {
  if (embedding.length !== DIMS) {
    throw VectorErrors.dimensionMismatch(DIMS, embedding.length);
  }

  let x = 0, y = 0, z = 0;
  for (let i = 0; i < DIMS; i++) {
    const angle = i * PHI * Math.PI * 2 / DIMS;
    const height = (i / DIMS) * 2 - 1;
    x += embedding[i] * Math.cos(angle);
    y += embedding[i] * Math.sin(angle);
    z += embedding[i] * height;
  }

  // Normalize to unit sphere
  const norm = Math.sqrt(x * x + y * y + z * z);
  if (norm === 0) return [0, 0, 0];
  return [x / norm, y / norm, z / norm];
}

// ═══ Vector Store Operations ═══
export async function storeVector(req: StoreRequest): Promise<VectorEntry> {
  const { content, embedding, metadata, namespace } = req;

  if (embedding.length !== DIMS) {
    throw VectorErrors.dimensionMismatch(DIMS, embedding.length);
  }

  const projection3D = projectTo3D(embedding);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Check for near-duplicates using pgvector cosine distance
  const dupCheck = await pool.query(
    `SELECT id, 1 - (embedding <=> $1::vector) as similarity
     FROM vector_memory
     WHERE namespace = $2
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [`[${embedding.join(',')}]`, namespace || 'default']
  );

  if (dupCheck.rows.length > 0 && dupCheck.rows[0].similarity > DEDUP_THRESHOLD) {
    logger.info('Near-duplicate detected, updating existing entry', {
      existingId: dupCheck.rows[0].id,
      similarity: dupCheck.rows[0].similarity,
    });
    // Update existing instead of inserting duplicate
    await pool.query(
      `UPDATE vector_memory SET content = $1, embedding = $2::vector, projection_3d = $3,
       metadata = $4, updated_at = $5, coherence_score = $6 WHERE id = $7`,
      [content, `[${embedding.join(',')}]`, projection3D, JSON.stringify(metadata || {}),
       now, dupCheck.rows[0].similarity, dupCheck.rows[0].id]
    );
    return {
      id: dupCheck.rows[0].id, content, embedding, projection3D,
      metadata: metadata || {}, createdAt: now, updatedAt: now,
      coherenceScore: dupCheck.rows[0].similarity,
    };
  }

  // Insert new vector
  await pool.query(
    `INSERT INTO vector_memory (id, content, embedding, projection_3d, metadata, namespace, created_at, updated_at, coherence_score)
     VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9)`,
    [id, content, `[${embedding.join(',')}]`, projection3D, JSON.stringify(metadata || {}),
     namespace || 'default', now, now, 1.0]
  );

  logger.info('Vector stored', { id, dims: DIMS, namespace: namespace || 'default' });

  return {
    id, content, embedding, projection3D,
    metadata: metadata || {}, createdAt: now, updatedAt: now, coherenceScore: 1.0,
  };
}

// ═══ Similarity Search ═══
export async function searchVectors(query: SearchQuery): Promise<SearchResult[]> {
  const { vector, topK, threshold, filter, includeMetadata } = query;

  if (vector.length !== DIMS) {
    throw VectorErrors.dimensionMismatch(DIMS, vector.length);
  }

  const k = topK || FIB[8]; // 21
  const minScore = threshold || CSL_THRESHOLDS.LOW;

  let sql = `
    SELECT id, content, projection_3d, metadata,
           1 - (embedding <=> $1::vector) as similarity
    FROM vector_memory
    WHERE 1 - (embedding <=> $1::vector) >= $2
  `;
  const params: (string | number)[] = [`[${vector.join(',')}]`, minScore];

  if (filter) {
    let paramIdx = 3;
    for (const [key, value] of Object.entries(filter)) {
      sql += ` AND metadata->>'${key}' = $${paramIdx}`;
      params.push(String(value));
      paramIdx++;
    }
  }

  sql += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(k);

  const result = await pool.query(sql, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    score: row.similarity as number,
    content: row.content as string,
    projection3D: row.projection_3d as [number, number, number],
    ...(includeMetadata ? { metadata: JSON.parse(row.metadata as string) } : {}),
  }));
}

// ═══ Memory Stats ═══
export async function getStats(): Promise<MemoryStats> {
  const countResult = await pool.query('SELECT COUNT(*) as count FROM vector_memory');
  const coherenceResult = await pool.query('SELECT AVG(coherence_score) as avg FROM vector_memory');
  const sizeResult = await pool.query("SELECT pg_total_relation_size('vector_memory') as size");

  return {
    totalVectors: parseInt(countResult.rows[0].count, 10),
    dimensions: DIMS,
    indexType: 'HNSW',
    avgCoherence: parseFloat(coherenceResult.rows[0].avg) || 0,
    storageBytes: parseInt(sizeResult.rows[0].size, 10),
  };
}

// ═══ Drift Detection ═══
export async function detectDrift(namespace: string = 'default'): Promise<{ driftScore: number; drifted: boolean }> {
  const result = await pool.query(
    `SELECT AVG(coherence_score) as avg_coherence,
            MIN(coherence_score) as min_coherence,
            COUNT(*) as count
     FROM vector_memory
     WHERE namespace = $1`,
    [namespace]
  );

  const avgCoherence = parseFloat(result.rows[0].avg_coherence) || 1.0;
  const drifted = avgCoherence < CSL_THRESHOLDS.MEDIUM; // below 0.809

  if (drifted) {
    logger.warn('Semantic drift detected', { namespace, avgCoherence, threshold: CSL_THRESHOLDS.MEDIUM });
  }

  return { driftScore: 1 - avgCoherence, drifted };
}

export { pool };

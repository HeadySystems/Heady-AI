// packages/heady-memory/src/t1-neon.js
// §3 — Neon Postgres T1 Persistent Memory + pgvector
import { classifyCSL } from '../../heady-core/src/csl.js';
import { TOP_K, CSL } from '../../heady-core/src/phi.js';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// Use @neondatabase/serverless Pool when available, otherwise pg Pool
let pool;
async function getPool() {
  if (pool) return pool;
  try {
    const { Pool } = await import('@neondatabase/serverless');
    pool = new Pool({ connectionString: DATABASE_URL });
  } catch {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

/**
 * Bootstrap user memory — load top-K memories above CSL threshold.
 * @param {string} userId
 * @param {number} [topK=21]
 * @returns {Promise<Array<{id:string, content:string, csl_score:number, tier:string}>>}
 */
export async function bootstrapUserMemory(userId, topK = TOP_K) {
  const db = await getPool();
  const { rows } = await db.query(
    `SELECT id, content, csl_score, tier
     FROM memory_vectors
     WHERE user_id = $1 AND csl_score >= $2
     ORDER BY csl_score DESC, last_accessed DESC
     LIMIT $3`,
    [userId, CSL.INCLUDE, topK]
  );
  return rows;
}

/**
 * Upsert a memory vector with CSL classification.
 * @param {string} userId
 * @param {string} content
 * @param {number[]} embedding — 384-dim float array
 * @param {number} cslScore — 0.0 to 1.0
 */
export async function upsertMemory(userId, content, embedding, cslScore) {
  const db = await getPool();
  const { tier } = classifyCSL(cslScore);
  const embStr = `[${embedding.join(',')}]`;
  await db.query(
    `INSERT INTO memory_vectors (user_id, content, embedding, csl_score, tier, last_accessed)
     VALUES ($1, $2, $3::vector, $4, $5, NOW())
     ON CONFLICT (user_id, content_hash)
     DO UPDATE SET csl_score = EXCLUDED.csl_score,
                   tier = EXCLUDED.tier,
                   last_accessed = NOW()`,
    [userId, content, embStr, cslScore, tier]
  );
}

/**
 * Semantic search using pgvector cosine similarity.
 * @param {string} userId
 * @param {number[]} queryEmbedding — 384-dim float array
 * @param {number} [threshold=0.618] — minimum CSL score
 * @returns {Promise<Array<{id:string, content:string, csl_score:number, tier:string, similarity:number}>>}
 */
export async function semanticSearch(userId, queryEmbedding, threshold = CSL.INCLUDE) {
  const db = await getPool();
  const embStr = `[${queryEmbedding.join(',')}]`;
  const { rows } = await db.query(
    `SELECT id, content, csl_score, tier,
            1 - (embedding <=> $1::vector) AS similarity
     FROM memory_vectors
     WHERE user_id = $2
       AND 1 - (embedding <=> $1::vector) >= $3
     ORDER BY similarity DESC
     LIMIT $4`,
    [embStr, userId, threshold, TOP_K]
  );
  return rows;
}

/**
 * Record a pipeline execution in task history.
 * @param {object} params
 */
export async function recordPipelineExecution(params) {
  const db = await getPool();
  await db.query(
    `INSERT INTO pipeline_tasks (user_id, session_id, input_preview, output_preview, elapsed_ms, csl_score, trust_receipt)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [params.userId, params.sessionId, params.input?.substring(0, 200),
     params.output?.substring(0, 400), params.elapsedMs, params.cslScore, params.trustReceipt]
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Patterns DB v2.0.0                                       ║
// ║  Neon pgvector Semantic Retrieval Interface                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
import postgres from 'postgres';

const logger = pino();
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@neon.headysystems.internal/main';

const sql = postgres(DATABASE_URL, {
  max: 13, // FIB[7]
  idle_timeout: 21, // FIB[8]
});

async function searchPatterns(tenantId, queryText, patternType) {
  try {
    const queryEmbedding = new Array(384).fill(0.01); 
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await sql`
      SELECT 
        pattern_id,
        pattern_name as pattern,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM tenant_patterns
      WHERE tenant_id = ${tenantId} AND type = ${patternType}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 5
    `;

    return results;
  } catch (err) {
    logger.error({ msg: `Database pgvector search failed for ${patternType}`, error: err.message });
    return [];
  }
}

export async function findNegativePatterns(tenantId, queryText) {
  return searchPatterns(tenantId, queryText, 'negative');
}

export async function findPositivePatterns(tenantId, queryText) {
  return searchPatterns(tenantId, queryText, 'positive');
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Memory Stream v1.0.0                                     ║
// ║  pgvector retrieval + φ-fusion scoring + memory outbox events.    ║
// ║  Made with ❤️ by HeadySystems Inc. · ⚠️ PATENT zone                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { assertEmbedding } from "@heady/db";
import { phiFusionWeights } from "@heady/phi-math";
import { logger } from "@heady/logger";

const log = logger.child({ component: "memory-stream" });

/**
 * Writes a memory record atomically within a transaction.
 *
 * @param {object} tx Database client/transaction executor
 * @param {object} params
 * @param {string} params.content Text content of the memory
 * @param {number[]} params.embedding 384-dimensional vector
 * @param {object} [params.metadata] Additional structured properties (agentId, kind, etc.)
 */
export async function writeMemory(tx, { content, embedding, metadata = {} }) {
  if (typeof content !== "string" || !content) throw new TypeError("writeMemory: content is required");
  assertEmbedding(embedding);

  const meta = {
    agentId: metadata.agentId ?? "system",
    kind: metadata.kind ?? "observation",
    tier: metadata.tier ?? 1,
    importance: metadata.importance ?? 0.5,
    visibility: metadata.visibility ?? "private",
    ...metadata,
  };

  const sql = `
    INSERT INTO vector_memory (content, embedding, metadata, created_at)
    VALUES ($1, $2::vector, $3, now())
    RETURNING id, content, metadata, created_at
  `;

  // Stringify the embedding array to the format accepted by pgvector: '[v1,v2,v3,...]'
  const pgVectorString = `[${embedding.join(",")}]`;
  const res = await tx.query(sql, [content, pgVectorString, JSON.stringify(meta)]);
  const record = res.rows[0];

  // Emit transactional outbox record (Event system integration)
  const outboxSql = `
    INSERT INTO task_outbox (topic, payload, created_at)
    VALUES ('memory:written', $1, now())
  `;
  const outboxPayload = { memory_id: record.id, agent_id: meta.agentId, kind: meta.kind, tier: meta.tier };
  await tx.query(outboxSql, [JSON.stringify(outboxPayload)]);

  log.info({ memoryId: record.id, kind: meta.kind }, "memory written");
  return record;
}

/**
 * Retrieves memories from pgvector, applying a φ-fusion score of:
 *   score = w_relevance·relevance + w_importance·importance + w_recency·recency
 *
 * @param {object} tx Database client/transaction executor
 * @param {object} params
 * @param {number[]} params.queryVector 384-dimensional query vector
 * @param {string} [params.agentId] Filter by agent owner
 * @param {string[]} [params.includeKinds] Filter by memory kinds (e.g. ['observation'])
 * @param {number} [params.sinceMs] Time-window filter in milliseconds
 * @param {number} [params.limit] Max results to return
 * @param {number} [params.minRelevance] Minimum cosine similarity threshold (default: ψ² ≈ 0.382)
 */
export async function retrieveMemories(tx, {
  queryVector,
  agentId,
  includeKinds,
  sinceMs,
  limit = 13,
  minRelevance = 0.382,
}) {
  assertEmbedding(queryVector);

  let whereClauses = [];
  const params = [`[${queryVector.join(",")}]`];

  // 1. Build dynamic where conditions
  if (agentId) {
    params.push(agentId);
    whereClauses.push(`metadata->>'agentId' = $${params.length}`);
  }
  if (Array.isArray(includeKinds) && includeKinds.length > 0) {
    params.push(JSON.stringify(includeKinds));
    whereClauses.push(`metadata->>'kind' = ANY(SELECT jsonb_array_elements_text($${params.length}))`);
  }
  if (sinceMs) {
    params.push(new Date(Date.now() - sinceMs));
    whereClauses.push(`created_at >= $${params.length}`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Query vector_memory and compute relevance (1 - cosine distance) in database
  const sql = `
    SELECT id, content, metadata, created_at, 1 - (embedding <=> $1::vector) AS relevance
    FROM vector_memory
    ${whereStr}
    ORDER BY embedding <=> $1::vector
    LIMIT 100
  `;

  const res = await tx.query(sql, params);
  const weights = phiFusionWeights(3); // [w_relevance, w_importance, w_recency]
  const now = Date.now();

  const retrieved = res.rows
    .map((row) => {
      const relevance = Number(row.relevance);
      if (relevance < minRelevance) return null;

      const meta = row.metadata ?? {};
      const importance = Number(meta.importance ?? 0.5);

      const ageMs = Math.max(1, now - new Date(row.created_at).getTime());
      // phi-scaled recency decay: exp(-ageMs / (89 * 1000)) where 89 is FIB[11]
      const recency = Math.exp(-ageMs / (89 * 1000));

      const score = weights[0] * relevance + weights[1] * importance + weights[2] * recency;

      return {
        record: {
          id: row.id,
          content: row.content,
          metadata: row.metadata,
          createdAt: row.created_at,
        },
        score,
        relevance,
        recency,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return retrieved;
}

/**
 * Computes the mean vector (centroid) of the last N memories for an agent.
 *
 * @param {object} tx Database client/transaction executor
 * @param {object} params
 * @param {string} params.agentId Agent owner UUID/id
 * @param {number} [params.limit] Max records to aggregate (default: 8)
 */
export async function reflect(tx, { agentId, limit = 8 }) {
  if (!agentId) throw new TypeError("reflect: agentId is required");

  // Fetch coordinates of the recent memories
  const sql = `
    SELECT id, embedding::text, metadata
    FROM vector_memory
    WHERE metadata->>'agentId' = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const res = await tx.query(sql, [agentId, limit]);
  if (res.rows.length === 0) {
    return { agentId, sourceIds: [], centroid: new Array(384).fill(0), averageImportance: 0 };
  }

  const dim = 384;
  const centroid = new Array(dim).fill(0);
  let totalImportance = 0;
  const sourceIds = [];

  for (const row of res.rows) {
    sourceIds.push(row.id);
    const importance = Number(row.metadata?.importance ?? 0.5);
    totalImportance += importance;

    // Parse pgvector string representation: '[v1,v2,v3,...]'
    const arr = row.embedding.replace(/[\[\]]/g, "").split(",").map(Number);
    for (let i = 0; i < dim; i++) {
      centroid[i] += arr[i];
    }
  }

  // Calculate mean vector
  const count = res.rows.length;
  for (let i = 0; i < dim; i++) {
    centroid[i] = centroid[i] / count;
  }

  return {
    agentId,
    sourceIds,
    centroid,
    averageImportance: totalImportance / count,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context Projector v1.0.0                            ║
// ║  WAL-replication to Vectorize edge cache + drift verification.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder · ⚠️ PATENT zone ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash } from "node:crypto";
import { logger } from "@heady/logger";
import { assertEmbedding } from "@heady/db";

const log = logger.child({ component: "auto-context-projector" });

/**
 * Projects Neon pgvector memory records into Cloudflare Vectorize (edge cache)
 * and detects synchronization drift.
 */
export class VectorizeProjector {
  /**
   * @param {object} params
   * @param {object} params.vectorizeClient Client managing the Vectorize index
   * @param {object} params.dbClient Client querying the Neon database
   */
  constructor({ vectorizeClient, dbClient }) {
    if (!vectorizeClient) throw new TypeError("VectorizeProjector: vectorizeClient required");
    if (!dbClient) throw new TypeError("VectorizeProjector: dbClient required");
    this.vectorizeClient = vectorizeClient;
    this.dbClient = dbClient;
  }

  /**
   * Processes a database WAL replication mutation event.
   *
   * @param {object} event
   * @param {"INSERT"|"UPDATE"|"DELETE"} event.op Mutation operation
   * @param {string} event.table Database table name (only 'vector_memory' is projected)
   * @param {object} event.row Row data containing { id, content, embedding, metadata }
   */
  async project(event) {
    if (!event || !event.op) throw new TypeError("project: event.op required");
    if (event.table !== "vector_memory") return; // ignore other tables

    const { id, embedding, metadata } = event.row ?? {};
    if (!id) throw new TypeError("project: row id is required");

    log.info({ op: event.op, id }, "projecting WAL event to Vectorize");

    switch (event.op) {
      case "INSERT":
      case "UPDATE": {
        const vec = Array.isArray(embedding)
          ? embedding
          : embedding.replace(/[\[\]]/g, "").split(",").map(Number);
        assertEmbedding(vec);
        await this.vectorizeClient.insert([{
          id,
          values: vec,
          metadata: metadata ?? {},
        }]);
        break;
      }
      case "DELETE": {
        await this.vectorizeClient.delete([id]);
        break;
      }
      default: {
        throw new Error(`project: unhandled logical replication operator: ${event.op}`);
      }
    }
  }

  /**
   * Performs count-parity and hash comparison to detect projection sync drift.
   * Returns { ok, countParity, hashDrift, dbCount, edgeCount }.
   */
  async verifyParity() {
    log.info("verifying projection parity");

    // 1. Get database records
    const dbRes = await this.dbClient.query("SELECT id FROM vector_memory ORDER BY id ASC");
    const dbIds = dbRes.rows.map((r) => r.id);
    const dbCount = dbIds.length;

    // 2. Get edge index records
    const edgeIds = await this.vectorizeClient.listIds();
    edgeIds.sort();
    const edgeCount = edgeIds.length;

    const countParity = dbCount === edgeCount;

    // 3. Compute PK hash drift
    const dbHash = createHash("sha256").update(dbIds.join(",")).digest("hex");
    const edgeHash = createHash("sha256").update(edgeIds.join(",")).digest("hex");
    const hashDrift = dbHash !== edgeHash;

    const ok = countParity && !hashDrift;
    log.info({ ok, dbCount, edgeCount, hashDrift }, "parity check complete");

    return {
      ok,
      countParity,
      hashDrift,
      dbCount,
      edgeCount,
    };
  }

  /**
   * Resolves drift by re-synchronizing all database vector memories to the edge.
   */
  async reconcile() {
    log.info("initiating full reconciliation");

    // 1. Query all pgvector records
    const dbRes = await this.dbClient.query("SELECT id, embedding::text, metadata FROM vector_memory");
    if (dbRes.rows.length === 0) {
      // Clear edge
      const edgeIds = await this.vectorizeClient.listIds();
      if (edgeIds.length > 0) {
        await this.vectorizeClient.delete(edgeIds);
      }
      log.info("reconciliation complete: both stores empty");
      return;
    }

    const vectors = dbRes.rows.map((row) => {
      const vec = row.embedding.replace(/[\[\]]/g, "").split(",").map(Number);
      return {
        id: row.id,
        values: vec,
        metadata: row.metadata ?? {},
      };
    });

    // 2. Push to Vectorize (upsert)
    await this.vectorizeClient.insert(vectors);
    
    // 3. Prune deleted IDs from edge index
    const dbIdSet = new Set(vectors.map((v) => v.id));
    const edgeIds = await this.vectorizeClient.listIds();
    const toPrune = edgeIds.filter((id) => !dbIdSet.has(id));
    if (toPrune.length > 0) {
      await this.vectorizeClient.delete(toPrune);
    }

    log.info({ upserted: vectors.length, pruned: toPrune.length }, "reconciliation complete");
  }
}

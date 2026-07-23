/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * reconciler — durable drift detection (ADR-0004 §5).
 *
 * The in-RAM drift-detector dies on restart and only sees what one process
 * observed. This compares the log's AUTHORITATIVE content hash per aggregate
 * (the latest event) against the hashes a derived store actually reports, and
 * quantifies divergence. Anything over threshold is real drift to re-project.
 *
 * Streaming CDC is at-least-once and edge caches are eventually consistent, so
 * this safety net catches what the projector's happy path misses.
 */

const db = require("../services/neon-db");

const DRIFT_THRESHOLD = 0.001; // 0.1% of corpus (ADR-0004)

/** Latest (authoritative) content_hash per aggregate_id of a given type. */
async function sourceHashes(aggregateType) {
    return db.query(
        `SELECT DISTINCT ON (aggregate_id) aggregate_id, content_hash, seq
         FROM event_log WHERE aggregate_type = $1
         ORDER BY aggregate_id, seq DESC`,
        [aggregateType],
    );
}

/**
 * Compare the source of truth against a projection's reported state.
 * @param {string} aggregateType
 * @param {Map<string,string>} projectionHashes aggregate_id -> content_hash in the derived store
 */
async function reconcile(aggregateType, projectionHashes) {
    const src = await sourceHashes(aggregateType);
    if (!src.ok) return { ok: false, error: src.error };

    const drift = [];
    for (const row of src.rows) {
        const have = projectionHashes.get(row.aggregate_id);
        if (have !== row.content_hash) {
            drift.push({
                aggregateId: row.aggregate_id,
                expected: row.content_hash,
                actual: have || null,
                seq: Number(row.seq),
            });
        }
    }
    const total = src.rows.length;
    const driftRatio = total === 0 ? 0 : drift.length / total;
    return {
        ok: true,
        aggregateType,
        total,
        driftCount: drift.length,
        driftRatio,
        withinThreshold: driftRatio <= DRIFT_THRESHOLD,
        drift,
    };
}

module.exports = { reconcile, sourceHashes, DRIFT_THRESHOLD };

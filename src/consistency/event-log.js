/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * event-log — the single source of truth (ADR-0004).
 *
 * Every state change is appended here with a monotonic `seq` (the global
 * offset) and a deterministic content hash. The append also writes an outbox
 * row in the SAME transaction, so a downstream projection can never miss an
 * event that committed (the dual-write problem is structurally eliminated).
 *
 * No business code should write to a derived store directly: it appends an
 * event, and projections follow.
 */

const crypto = require("crypto");
const db = require("../services/neon-db");

/** Canonical, order-independent hash of an event's identity + body. */
function hashEvent(evt) {
    const canonical = JSON.stringify({
        aggregateType: evt.aggregateType,
        aggregateId: evt.aggregateId,
        eventType: evt.eventType,
        payload: evt.payload || {},
    });
    return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Append an event using the caller's transaction client. Use this when the
 * event must commit atomically with a business write (the outbox pattern).
 * @param {import('pg').PoolClient} client
 */
async function appendWith(client, evt) {
    if (!evt || !evt.aggregateType || !evt.aggregateId || !evt.eventType) {
        throw new Error("event requires aggregateType, aggregateId, eventType");
    }
    const content_hash = hashEvent(evt);
    const ins = await client.query(
        `INSERT INTO event_log (aggregate_type, aggregate_id, event_type, payload, content_hash, model_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING seq, created_at`,
        [evt.aggregateType, evt.aggregateId, evt.eventType, evt.payload || {}, content_hash, evt.modelId || null],
    );
    const { seq, created_at } = ins.rows[0];
    await client.query(
        `INSERT INTO outbox (event_seq, channel, payload) VALUES ($1, $2, $3)`,
        [seq, evt.channel || evt.aggregateType, {
            eventType: evt.eventType,
            aggregateId: evt.aggregateId,
            payload: evt.payload || {},
            content_hash,
        }],
    );
    return { seq: Number(seq), content_hash, created_at };
}

/** Standalone append (opens its own transaction). */
async function append(evt) {
    const res = await db.transaction((client) => appendWith(client, evt));
    return res.ok ? { ok: true, ...res.result } : res;
}

/** Read events strictly after `afterSeq`, in order. */
async function readFrom(afterSeq = 0, limit = 500) {
    return db.query(
        `SELECT seq, aggregate_type, aggregate_id, event_type, payload, content_hash, model_id, created_at
         FROM event_log WHERE seq > $1 ORDER BY seq ASC LIMIT $2`,
        [afterSeq, limit],
    );
}

/** Highest committed offset (0 if the log is empty). */
async function head() {
    const r = await db.query(`SELECT COALESCE(MAX(seq), 0) AS head FROM event_log`);
    return r.ok ? Number(r.rows[0].head) : 0;
}

module.exports = { append, appendWith, readFrom, head, hashEvent };

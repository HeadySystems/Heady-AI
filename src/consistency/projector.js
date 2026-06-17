/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * projector — the offset-stamped projection runtime (ADR-0004 §2–3).
 *
 * A Projector replays the event log into a derived view (pgvector, Vectorize,
 * a read model, the UI) and records the exact offset it has applied. Because
 * the view is a pure function of the log and the offset is durable, the view
 * is rebuildable by replay and its currency is a checkable predicate:
 *
 *     caughtUp  ⇔  applied_offset >= head(log)
 *
 * "Liquid" = run() is cheap to call continuously; the view tracks the log tail.
 */

const db = require("../services/neon-db");
const log = require("./event-log");

class Projector {
    /**
     * @param {string} name unique projection name (checkpoint key)
     * @param {(event: object, client: import('pg').PoolClient) => Promise<void>} applyFn
     * @param {{batch?: number}} [opts]
     */
    constructor(name, applyFn, opts = {}) {
        if (!name || typeof applyFn !== "function") {
            throw new Error("Projector requires (name, applyFn)");
        }
        this.name = name;
        this.applyFn = applyFn;
        this.batch = opts.batch || 500;
    }

    /** Current durable checkpoint for this projection. */
    async checkpoint() {
        const r = await db.query(
            `SELECT applied_offset, content_hash FROM projection_checkpoints WHERE projection_name = $1`,
            [this.name],
        );
        if (!r.ok || r.rows.length === 0) return { applied_offset: 0, content_hash: null };
        return { applied_offset: Number(r.rows[0].applied_offset), content_hash: r.rows[0].content_hash };
    }

    /**
     * Apply events after the checkpoint. Each event's apply + checkpoint advance
     * commit in ONE transaction, so a crash mid-batch never double-applies or
     * skips: on restart we resume exactly from the last committed offset.
     */
    async run() {
        const start = (await this.checkpoint()).applied_offset;
        const res = await log.readFrom(start, this.batch);
        if (!res.ok) return { ok: false, error: res.error, applied: 0 };

        let applied = 0;
        let atOffset = start;
        for (const evt of res.rows) {
            const txn = await db.transaction(async (client) => {
                await this.applyFn(evt, client);
                await client.query(
                    `INSERT INTO projection_checkpoints (projection_name, applied_offset, content_hash, updated_at)
                     VALUES ($1, $2, $3, now())
                     ON CONFLICT (projection_name)
                     DO UPDATE SET applied_offset = $2, content_hash = $3, updated_at = now()`,
                    [this.name, evt.seq, evt.content_hash],
                );
            });
            if (!txn.ok) return { ok: false, error: txn.error, applied, atOffset };
            applied++;
            atOffset = Number(evt.seq);
        }
        return { ok: true, applied, atOffset };
    }

    /** Is this projection current with the head of the log? */
    async caughtUp() {
        const [head, cp] = await Promise.all([log.head(), this.checkpoint()]);
        return {
            caughtUp: cp.applied_offset >= head,
            head,
            applied: cp.applied_offset,
            lag: head - cp.applied_offset,
        };
    }
}

module.exports = { Projector };

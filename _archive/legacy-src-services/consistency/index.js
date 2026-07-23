/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * consistency — the systems that keep Heady's data globally consistent ALWAYS.
 *
 * Architecture (ADR-0004): one append-only event log is the truth; every
 * derived view is an offset-stamped projection of it, rebuildable by replay.
 * Global consistency is not audited after the fact — it is a checkable
 * predicate (`verify`) that goes red the instant a projection falls behind.
 *
 *   event-log   the single source of truth (+ transactional outbox)
 *   Projector   offset-stamped replay into a derived view
 *   reconcile   durable drift detection vs the log
 *   migrate     forward-only schema application
 *   verify      "is the system consistent right now?" — the fidelity predicate
 */

const log = require("./event-log");
const { Projector } = require("./projector");
const { reconcile, sourceHashes, DRIFT_THRESHOLD } = require("./reconciler");
const { migrate } = require("./migrate");
const db = require("../services/neon-db");

/**
 * The executable definition of "globally consistent right now". Green only when
 * every registered projection has applied the head of the log. Register the
 * real projections (pgvector, Vectorize, read models) as modules are strangled
 * onto the log; with none registered this reports trivially consistent and a
 * truthful head — never a false "100/100".
 * @param {import('./projector').Projector[]} projectors
 */
async function verify(projectors = []) {
    // Probe the log directly: if it is unreachable we are DEGRADED, never green.
    // A fidelity predicate that can't read the truth must not report "consistent".
    const probe = await db.query(`SELECT COALESCE(MAX(seq), 0) AS head FROM event_log`);
    if (!probe.ok) {
        return { consistent: false, degraded: true, error: probe.error, ts: new Date().toISOString() };
    }
    const head = Number(probe.rows[0].head);
    const projections = [];
    for (const p of projectors) {
        projections.push({ projection: p.name, ...(await p.caughtUp()) });
    }
    return {
        consistent: projections.every((c) => c.caughtUp),
        degraded: false,
        head,
        projectionCount: projections.length,
        projections,
        ts: new Date().toISOString(),
    };
}

module.exports = { log, Projector, reconcile, sourceHashes, DRIFT_THRESHOLD, migrate, verify, db };

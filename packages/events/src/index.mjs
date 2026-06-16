// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Events v1.0.0 — typed action/observation bus              ║
// ║  Subject taxonomy + wildcard routing + in-memory bus. NATS-shaped.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Transport-agnostic core: subjects, wildcard matching, a typed envelope, and an
// in-memory bus (testable now). A NATS adapter (`heady-event-bus`) implements the
// same publish/subscribe interface once the `nats` client is installed.

import { ValidationError } from "@heady/shared";

// Canonical subject roots (AGENTS.md: agent.coder.*, heady.observation.*, …).
export const SUBJECT = Object.freeze({
  action: (kind) => `heady.action.${kind}`,
  observation: (kind) => `heady.observation.${kind}`,
  agent: (path) => `agent.${path}`,
  system: (kind) => `heady.system.${kind}`,
});

/** NATS-style wildcard match: `*` = one token, `>` = tail of ≥1 tokens. */
export function subjectMatches(pattern, subject) {
  const p = pattern.split(".");
  const s = subject.split(".");
  for (let i = 0; i < p.length; i++) {
    if (p[i] === ">") return s.length >= i + 1;
    if (i >= s.length) return false;
    if (p[i] === "*") continue;
    if (p[i] !== s[i]) return false;
  }
  return p.length === s.length;
}

/** Build a typed event envelope. `now`/`id` injectable for determinism. */
export function buildEvent(subject, payload, { traceId, source = "heady", now = () => new Date().toISOString(), id } = {}) {
  if (!subject || typeof subject !== "string") throw new ValidationError("event subject required");
  return { subject, payload: payload ?? {}, traceId: traceId ?? null, source, ts: now(), id: id ?? null };
}

/**
 * In-memory event bus implementing the publish/subscribe contract. Handler errors
 * are isolated (one bad subscriber never blocks the others) and collected.
 */
export class InMemoryBus {
  constructor() { this.subs = []; }
  subscribe(pattern, handler) {
    const entry = { pattern, handler };
    this.subs.push(entry);
    return () => { this.subs = this.subs.filter((s) => s !== entry); }; // unsubscribe
  }
  async publish(subjectOrEvent, payload, opts) {
    const event = typeof subjectOrEvent === "string" ? buildEvent(subjectOrEvent, payload, opts) : subjectOrEvent;
    const errors = [];
    let delivered = 0;
    for (const { pattern, handler } of this.subs) {
      if (!subjectMatches(pattern, event.subject)) continue;
      delivered += 1;
      try { await handler(event); } catch (e) { errors.push(e); }
    }
    return { delivered, errors };
  }
}

/**
 * Project transactional-outbox rows (from @heady/db) onto the bus by their topic.
 * Returns the publish results; callers mark rows dispatched on success.
 */
export async function projectOutbox(rows, bus, opts = {}) {
  const results = [];
  for (const row of rows) {
    results.push({ seq: row.seq, ...(await bus.publish(row.topic, row.payload, { ...opts, id: String(row.seq ?? "") })) });
  }
  return results;
}

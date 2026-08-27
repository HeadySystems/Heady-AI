// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Events v1.0.0 — typed action/observation bus              ║
// ║  Subject taxonomy, local projection, and production NATS bus.     ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Transport-agnostic core: subjects, wildcard matching, a typed envelope, an
// in-memory test bus, and the official NATS v3 Node transport for production.

import { connect as connectNats } from "@nats-io/transport-node";
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
 * Production NATS transport with an in-process projection for low-latency SSE.
 * Neon outbox rows remain durable authority; NATS is the inter-service delivery
 * fabric. `noEcho` prevents the publishing process from ingesting its own frame.
 */
export class NatsBus {
  constructor({ servers, name, token, user, pass, log, connectImpl = connectNats } = {}) {
    const normalizedServers = Array.isArray(servers)
      ? servers.map((server) => String(server).trim()).filter(Boolean)
      : String(servers ?? "").split(",").map((server) => server.trim()).filter(Boolean);
    if (normalizedServers.length === 0) throw new ValidationError("NATS servers are required");
    if (normalizedServers.some((server) => /[/][/][^/@]+@/.test(server))) {
      throw new ValidationError("NATS server URLs must not contain credentials");
    }
    this.options = {
      servers: normalizedServers,
      name: String(name ?? "heady-events"),
      noEcho: true,
      pedantic: true,
      ...(token ? { token } : {}),
      ...(user ? { user, pass } : {}),
    };
    this.log = log;
    this.connectImpl = connectImpl;
    this.local = new InMemoryBus();
    this.connection = null;
    this.subscription = null;
    this.consumer = null;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.received = 0;
    this.published = 0;
  }

  subscribe(pattern, handler) {
    return this.local.subscribe(pattern, handler);
  }

  async start() {
    if (this.connection) return;
    this.connection = await this.connectImpl(this.options);
    this.subscription = this.connection.subscribe(">");
    this.consumer = (async () => {
      for await (const message of this.subscription) {
        try {
          const event = JSON.parse(this.decoder.decode(message.data));
          if (!event || event.subject !== message.subject || typeof event.subject !== "string") {
            throw new ValidationError("invalid NATS event envelope");
          }
          this.received += 1;
          await this.local.publish(event);
        } catch (error) {
          this.log?.warn({ err: String(error?.message ?? error), subject: message.subject }, "NATS event rejected");
        }
      }
    })().catch((error) => {
      this.log?.error({ err: String(error?.message ?? error) }, "NATS consumer stopped unexpectedly");
    });
    await this.connection.flush();
  }

  async publish(subjectOrEvent, payload, opts) {
    if (!this.connection || this.connection.isClosed()) throw new Error("NATS transport is not connected");
    const event = typeof subjectOrEvent === "string" ? buildEvent(subjectOrEvent, payload, opts) : subjectOrEvent;
    const localResult = await this.local.publish(event);
    this.connection.publish(event.subject, this.encoder.encode(JSON.stringify(event)));
    if (opts?.flush === true) await this.connection.flush();
    this.published += 1;
    return { ...localResult, transport: "nats", transportReady: true };
  }

  status() {
    return {
      name: "nats",
      ready: Boolean(this.connection && !this.connection.isClosed()),
      servers: this.options.servers.length,
      received: this.received,
      published: this.published,
    };
  }

  async stop() {
    this.subscription?.unsubscribe();
    if (this.connection && !this.connection.isClosed()) await this.connection.drain();
    this.subscription = null;
    this.connection = null;
    await this.consumer;
    this.consumer = null;
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

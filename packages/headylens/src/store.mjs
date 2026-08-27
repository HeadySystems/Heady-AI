// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyLens — Stores v1.0.0                                 ║
// ║  Pluggable record stores: in-memory ring (live tail) + plain      ║
// ║  append-only NDJSON (durable history). PLAIN by design — no       ║
// ║  hash-chain, no signing (that tamper-evidence is the G9 audit-of- ║
// ║  record, deferred). Made with ❤️ by HeadySystems Inc.             ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Retention (ADR-0008): every store is bounded by capacity AND maxAgeMs, and supports erasure
// (`prune` by time, `eraseByTrace` for right-to-erasure). HeadyLens records are derived/diagnostic
// (never the SoR), so dropping them is lossless to the system of record.

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { FIB } from "@heady/phi-math";
import { matchesFilter } from "./record.mjs";

// φ-derived defaults: capacity FIB[18]=2584 records; age window FIB[9]=34 days.
const DEFAULT_CAPACITY = FIB[18];
const DEFAULT_MAX_AGE_MS = FIB[9] * 24 * 60 * 60 * 1000;

function sortByTime(records) {
  return records.sort((a, b) => a.tsMs - b.tsMs);
}

function applyQuery(records, filter = {}) {
  const out = records.filter((r) => matchesFilter(r, filter));
  const limited = filter.limit != null ? out.slice(-Math.max(0, filter.limit)) : out;
  return sortByTime(limited.slice());
}

/** In-memory ring — fast recent query + the source for the live SSE tail. */
export class RingStore {
  constructor({ capacity = DEFAULT_CAPACITY, maxAgeMs = DEFAULT_MAX_AGE_MS, now = Date.now } = {}) {
    this.capacity = capacity;
    this.maxAgeMs = maxAgeMs;
    this.now = now;
    this.records = [];
    this.retentionClass = "diagnostic-volatile";
  }
  #evict() {
    const cutoff = this.now() - this.maxAgeMs;
    if (this.records.length && this.records[0].tsMs < cutoff) {
      this.records = this.records.filter((r) => r.tsMs >= cutoff);
    }
    if (this.records.length > this.capacity) {
      this.records = this.records.slice(this.records.length - this.capacity);
    }
  }
  append(rec) { this.records.push(rec); this.#evict(); return rec; }
  query(filter) { return applyQuery(this.records, filter); }
  prune(beforeMs) { this.records = this.records.filter((r) => r.tsMs >= beforeMs); }
  eraseByTrace(traceId) {
    const before = this.records.length;
    this.records = this.records.filter((r) => r.traceId !== traceId);
    return before - this.records.length;
  }
  get size() { return this.records.length; }
}

/** Durable append-only NDJSON. Plain JSON lines — no signing/chaining (ARBITER: G9 line). */
export class NdjsonStore {
  constructor({ path, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
    if (!path) throw new Error("NdjsonStore requires a file path");
    this.path = path;
    this.maxAgeMs = maxAgeMs;
    this.retentionClass = "diagnostic-durable";
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  #readAll() {
    if (!existsSync(this.path)) return [];
    const out = [];
    for (const line of readFileSync(this.path, "utf8").split("\n")) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch { /* skip a torn line, never throw on read */ }
    }
    return out;
  }
  append(rec) { appendFileSync(this.path, `${JSON.stringify(rec)}\n`); return rec; }
  query(filter) { return applyQuery(this.#readAll(), filter); }
  prune(beforeMs) {
    const kept = this.#readAll().filter((r) => r.tsMs >= beforeMs);
    writeFileSync(this.path, kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""));
    return kept.length;
  }
  eraseByTrace(traceId) {
    const all = this.#readAll();
    const kept = all.filter((r) => r.traceId !== traceId);
    writeFileSync(this.path, kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""));
    return all.length - kept.length;
  }
  get size() { return this.#readAll().length; }
}

/** Fan-out store: append to all, query the primary (first). Used to keep ring + durable in sync. */
export function multiStore(...stores) {
  if (stores.length === 0) throw new Error("multiStore requires at least one store");
  return {
    stores,
    append(rec) { for (const s of stores) s.append(rec); return rec; },
    query(filter) { return stores[0].query(filter); },
    prune(beforeMs) { return stores.map((s) => s.prune(beforeMs)); },
    eraseByTrace(traceId) { return stores.reduce((n, s) => n + s.eraseByTrace(traceId), 0); },
    get size() { return stores[0].size; },
  };
}

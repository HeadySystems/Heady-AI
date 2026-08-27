// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/headylens — public API v1.0.0                      ║
// ║  The connectable lens: tap every substrate → one time-ordered,    ║
// ║  detail-graded, redacted stream → query + live SSE.               ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { RingStore, NdjsonStore, multiStore } from "./store.mjs";
import { createCollector } from "./collector.mjs";

export * from "./record.mjs";
export { RingStore, NdjsonStore, multiStore } from "./store.mjs";
export { createCollector } from "./collector.mjs";
export { createLensServer, startLensServer } from "./server.mjs";

/**
 * One-call setup: a collector backed by an in-memory ring (live tail + fast query) and, when
 * `ndjsonPath` is given, a durable plain NDJSON store alongside it. Wire the taps to your bus /
 * logger / observability after creating it.
 *
 * @param {{ndjsonPath?:string, capacity?:number, maxAgeMs?:number, now?:()=>number}} [opts]
 */
export function createLens(opts = {}) {
  const ring = new RingStore({ capacity: opts.capacity, maxAgeMs: opts.maxAgeMs, now: opts.now });
  const store = opts.ndjsonPath
    ? multiStore(ring, new NdjsonStore({ path: opts.ndjsonPath, maxAgeMs: opts.maxAgeMs }))
    : ring;
  return createCollector({ store, now: opts.now });
}

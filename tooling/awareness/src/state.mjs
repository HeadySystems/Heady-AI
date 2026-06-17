// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Durable State v1.0.0                          ║
// ║  Atomic JSON state for the awareness service under                ║
// ║  .data/awareness/ — reuses the embed-corpus store (ADR-0000:      ║
// ║  reconstructible, tmp+rename, no torn reads). Holds the last       ║
// ║  observed HEAD, run counters, the live context snapshot, and the   ║
// ║  most recent squash proposal. NOT an authority — a projection.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createStore } from "../../embed-corpus/src/store.mjs";

export const STATE_FILES = Object.freeze({
  STATE: "state.json", // last HEAD, counters, run timestamps
  CONTEXT: "context.json", // the current-state snapshot any AI reads
  SQUASH: "squash-proposals.json", // most recent non-destructive squash proposal
});

const EMPTY_STATE = Object.freeze({
  schema: "heady.awareness.state/v1",
  running: false,
  lastSeenHead: null,
  lastReactionAt: null,
  lastTrigger: null,
  counters: { reactions: 0, gateBlocks: 0, jobsEnqueued: 0, errors: 0 },
});

/**
 * Open the awareness state store rooted at `dir` (created on demand).
 * Returns the raw store plus typed read/merge helpers for the state record.
 */
export function openState(dir) {
  const store = createStore(dir);

  const readState = () => ({ ...EMPTY_STATE, ...store.readJson(STATE_FILES.STATE, {}) });

  /** Shallow-merge a patch into the state record (counters merged one level deep). */
  const mergeState = (patch) => {
    const prev = readState();
    const next = {
      ...prev,
      ...patch,
      counters: { ...prev.counters, ...(patch.counters ?? {}) },
    };
    store.writeJson(STATE_FILES.STATE, next);
    return next;
  };

  /** Increment named counters by 1 (or by the given delta) atomically. */
  const bump = (deltas) => {
    const prev = readState();
    const counters = { ...prev.counters };
    for (const [k, v] of Object.entries(deltas)) counters[k] = (counters[k] ?? 0) + v;
    return mergeState({ counters });
  };

  const readContext = () => store.readJson(STATE_FILES.CONTEXT, null);
  const writeContext = (snapshot) => store.writeJson(STATE_FILES.CONTEXT, snapshot);

  const readSquash = () => store.readJson(STATE_FILES.SQUASH, null);
  const writeSquash = (proposal) => store.writeJson(STATE_FILES.SQUASH, proposal);

  return {
    dir: store.dir,
    path: store.path,
    readState,
    mergeState,
    bump,
    readContext,
    writeContext,
    readSquash,
    writeSquash,
  };
}

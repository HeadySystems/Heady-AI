// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Console honeycomb logic tests — node:test, zero deps      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STATE_STYLE, truthNote, summaryToCells, chunkRows,
  applyTransition, toggleDisabled, serializeDisabled, parseDisabled,
} from "../src/components/console-logic.mjs";

const SUMMARY = {
  schema: "console-summary.v1",
  heartbeatMs: 29034,
  counts: {},
  connectors: [
    { id: "a", name: "A", kind: "heady", role: "site", deploy_class: false, expected: "real", state: "healthy" },
    { id: "b", name: "B", kind: "heady", role: "shell", deploy_class: false, expected: "projection", state: "healthy" },
    { id: "c", name: "C", kind: "infra", role: "cache", deploy_class: false, expected: "real", state: "not_connected" },
    { id: "d", name: "D", kind: "infra", role: "scm", deploy_class: true, expected: "real", state: "token_expired" },
  ],
};

test("STATE_STYLE covers every §8 state with signal semantics", () => {
  const states = ["healthy", "degraded", "projection_only", "token_expired", "unreachable", "not_connected", "connecting", "empty"];
  for (const s of states) assert.ok(STATE_STYLE[s], s);
  assert.equal(STATE_STYLE.healthy.color, "#00d4aa"); // teal signal
  assert.equal(STATE_STYLE.healthy.pulse, true); // φ-heartbeat on healthy only
  assert.equal(STATE_STYLE.projection_only.ghost, true); // honest shell, outlined
  assert.equal(STATE_STYLE.token_expired.action, "reauthorize"); // never a dead end
});

test("truthNote flags expected-vs-measured mismatches (anti-masquerade)", () => {
  assert.match(truthNote({ expected: "projection", state: "healthy" }), /answering as real/);
  assert.match(truthNote({ expected: "real", state: "projection_only" }), /only a projection/);
  assert.equal(truthNote({ expected: "real", state: "healthy" }), null);
});

test("summaryToCells maps state→style, session-disable, and notes", () => {
  const cells = summaryToCells(SUMMARY, new Set(["c"]));
  assert.equal(cells.length, 4);
  assert.equal(cells[0].style.color, "#00d4aa");
  assert.match(cells[1].note, /answering as real/);
  assert.equal(cells[2].disabled, true);
  assert.equal(cells[3].style.action, "reauthorize");
  assert.deepEqual(summaryToCells(null), []); // global-error path renders no fake cells
});

test("chunkRows shapes the honeycomb (5-wide with a tail row)", () => {
  const rows = chunkRows(Array.from({ length: 15 }, (_, i) => i), 5);
  assert.deepEqual(rows.map((r) => r.length), [5, 5, 5]);
  assert.deepEqual(chunkRows([1, 2, 3], 2).map((r) => r.length), [2, 1]);
  assert.throws(() => chunkRows([], 0), RangeError);
});

test("applyTransition patches exactly one cell from an SSE frame", () => {
  const next = applyTransition(SUMMARY, { id: "a", to: "unreachable", detail: "ECONNREFUSED" });
  assert.equal(next.connectors[0].state, "unreachable");
  assert.equal(next.connectors[0].detail, "ECONNREFUSED");
  assert.equal(next.connectors[1].state, "healthy"); // untouched
  assert.equal(SUMMARY.connectors[0].state, "healthy"); // immutably
});

test("session disable set: toggle + round-trip through storage", () => {
  let set = new Set();
  set = toggleDisabled(set, "a");
  set = toggleDisabled(set, "b");
  set = toggleDisabled(set, "a");
  assert.deepEqual([...set], ["b"]);
  assert.deepEqual([...parseDisabled(serializeDisabled(set))], ["b"]);
  assert.deepEqual([...parseDisabled("not json")], []); // corrupt storage never breaks the UI
});

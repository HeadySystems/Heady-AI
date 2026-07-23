// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Console honeycomb — pure render logic (no DOM)             ║
// ║  Everything the <heady-console-honeycomb> cell grid needs,          ║
// ║  extracted pure so it unit-tests in node: §8 state→signal map,      ║
// ║  summary→cells (expected-vs-measured truth notes), hex row          ║
// ║  chunking, SSE transition patching, session disable toggling.       ║
// ║  Colors: docs/design/design-tokens.json color.state — SIGNALS,      ║
// ║  not wallpaper (teal healthy · violet degraded/projection · amber   ║
// ║  token-expired · red unreachable). © 2026 HeadySystems Inc.         ║
// ╚══════════════════════════════════════════════════════════════════╝

/** §8 state → visual signal. `pulse` = φ-heartbeat on the cell; `ghost` = outline
 *  fill (a projection is an honest shell, not a lesser light); `action` names the
 *  one-tap affordance the drawer renders (never a dead end). */
export const STATE_STYLE = Object.freeze({
  healthy: { color: "#00d4aa", label: "healthy", pulse: true, ghost: false },
  degraded: { color: "#7c5eff", label: "degraded", pulse: false, ghost: false },
  projection_only: { color: "#7c5eff", label: "projection", pulse: false, ghost: true },
  token_expired: { color: "#ffb020", label: "token expired", pulse: false, ghost: false, action: "reauthorize" },
  unreachable: { color: "#ff5470", label: "unreachable", pulse: false, ghost: false },
  not_connected: { color: "#5a5a6a", label: "not connected", pulse: false, ghost: true },
  connecting: { color: "#5a5a6a", label: "connecting…", pulse: true, ghost: true },
  empty: { color: "#5a5a6a", label: "empty", pulse: false, ghost: true },
});

/** Expected-vs-measured truth note (the anti-masquerade surface, §8). */
export function truthNote(cell) {
  if (cell.expected === "projection" && cell.state === "healthy") {
    return "expected projection — answering as real (verify manifest)";
  }
  if (cell.expected === "real" && cell.state === "projection_only") {
    return "expected real — only a projection is answering";
  }
  return null;
}

/**
 * Summary → render cells. Pure: session-disabled ids arrive as a Set.
 * @returns cells with { …connector, style, disabled, note }
 */
export function summaryToCells(summary, disabledIds = new Set()) {
  if (!summary || !Array.isArray(summary.connectors)) return [];
  return summary.connectors.map((c) => ({
    ...c,
    style: STATE_STYLE[c.state] ?? STATE_STYLE.connecting,
    disabled: disabledIds.has(c.id),
    note: truthNote(c),
  }));
}

/** Chunk cells into honeycomb rows (odd rows render offset by half a cell). */
export function chunkRows(cells, width = 5) {
  if (!Number.isInteger(width) || width < 1) throw new RangeError("chunkRows: width must be a positive integer");
  const rows = [];
  for (let i = 0; i < cells.length; i += width) rows.push(cells.slice(i, i + width));
  return rows;
}

/** Patch one connector's state from an SSE console.connector.state frame. */
export function applyTransition(summary, { id, to, detail = null }) {
  if (!summary || !Array.isArray(summary.connectors)) return summary;
  return {
    ...summary,
    connectors: summary.connectors.map((c) => (c.id === id ? { ...c, state: to, detail: detail ?? c.detail } : c)),
  };
}

/** Toggle a per-session disabled id; returns a NEW Set (state is immutable). */
export function toggleDisabled(disabledIds, id) {
  const next = new Set(disabledIds);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** (De)serialize the session-disabled set for sessionStorage. */
export const serializeDisabled = (set) => JSON.stringify([...set].sort());
export function parseDisabled(raw) {
  try {
    const arr = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

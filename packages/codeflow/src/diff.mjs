// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow line diff v1.0.0                                 ║
// ║  Bounded LCS line diff → unified preview + add/remove counts, for   ║
// ║  the proposal's audit record and the reviewer's eyes.              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { FIB } from '../../phi-math/src/index.mjs';

const PREVIEW_CAP = FIB[15]; // 610 preview lines max

/** LCS-based line diff. Returns { added, removed, preview:[{op,line}] }. */
export function unifiedDiff(oldText, newText) {
  const a = String(oldText ?? '').split('\n');
  const b = String(newText ?? '').split('\n');
  // Cap the table to keep this O(n·m) diff bounded; beyond cap, report a coarse count.
  if (a.length * b.length > 4_000_000) {
    return { added: b.length, removed: a.length, preview: [{ op: 'note', line: 'file too large for inline diff — full replace' }], truncated: true };
  }
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const preview = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { preview.push({ op: ' ', line: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { preview.push({ op: '-', line: a[i] }); removed++; i++; }
    else { preview.push({ op: '+', line: b[j] }); added++; j++; }
  }
  while (i < m) { preview.push({ op: '-', line: a[i++] }); removed++; }
  while (j < n) { preview.push({ op: '+', line: b[j++] }); added++; }
  return { added, removed, preview: preview.slice(0, PREVIEW_CAP), truncated: preview.length > PREVIEW_CAP };
}

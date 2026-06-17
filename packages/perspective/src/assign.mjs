// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — Assignment (AssignPort) v1.0.0              ║
// ║  Route a task to roles by competency-match × perspective weight.    ║
// ║  Every defined role weighs in; the ranking is deterministic.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { tokenize } from './roles.mjs';

/** competency match ∈ [0,1] — fraction of the task's terms the role covers. */
function match(taskTokens, role) {
  if (!taskTokens.length) return 0;
  const comp = new Set(role.competencies);
  const hit = taskTokens.filter((t) => comp.has(t)).length;
  return hit / taskTokens.length;
}

/**
 * Rank roles for a task. score = competencyMatch × role.weight (the role's perspective weight).
 * Returns the full ranked list (deterministic: score desc, then role id) — every role weighs in.
 */
export function assign(task, roles, { topN } = {}) {
  const tokens = tokenize(task);
  const ranked = roles
    .map((role) => {
      const m = match(tokens, role);
      return { role: role.id, kind: role.kind, weight: role.weight, matchTerms: tokens.filter((t) => role.competencies.includes(t)), score: Number((m * role.weight).toFixed(4)) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.role.localeCompare(b.role));
  return topN ? ranked.slice(0, topN) : ranked;
}

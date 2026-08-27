// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scaffold Planner — core v1.0.0                            ║
// ║  Pure plan flattening + decision overlay + integrity verify. Two  ║
// ║  builds: Heady-V1 (legacy) and Heady-AI (rebuild). Shared by the  ║
// ║  heady-scaffold CLI and the AdminUI section (one source of truth).║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// No IO: the plan, the decision overlay, and "does this path exist" are all injected, so the engine
// is unit-testable anywhere. configs/scaffold-plan.json is the immutable source; user accept/defer/
// replan choices are an OVERLAY keyed by option id — never written back into the plan.

export const DECISIONS = Object.freeze(["pending", "accepted", "deferred", "replan"]);

/** Flatten a build's options into a uniform list, regardless of v1 (flat) vs ai (phased) shape. */
export function flattenBuild(plan, buildId) {
  const build = plan?.builds?.[buildId];
  if (!build) throw new Error(`unknown build "${buildId}" (have: ${Object.keys(plan?.builds ?? {}).join(", ")})`);
  const rows = [];
  if (Array.isArray(build.phases)) {
    for (const ph of build.phases) {
      for (const o of ph.options ?? []) {
        rows.push({ id: o.id, title: o.title, group: ph.label, groupId: ph.id, state: o.status ?? "pending", detail: o.detail ?? "", refs: o.refs ?? [] });
      }
    }
  }
  for (const o of build.options ?? []) {
    rows.push({ id: o.id, title: o.title, group: "Legacy layer", groupId: "legacy", state: o.disposition ?? "—", detail: o.detail ?? "", refs: o.refs ?? [] });
  }
  return { build: { id: build.id, label: build.label, kind: build.kind, root: build.root, summary: build.summary }, rows };
}

/** Merge the user's decision overlay onto flattened rows. */
export function applyDecisions(rows, decisions = {}) {
  return rows.map((r) => {
    const d = decisions[r.id];
    return { ...r, decision: d?.decision ?? "pending", note: d?.note ?? null, decidedAt: d?.at ?? null };
  });
}

/** Set one decision in an overlay object (pure; returns a new overlay). */
export function setDecision(decisions, id, decision, note, nowIso) {
  if (!DECISIONS.includes(decision)) throw new Error(`invalid decision "${decision}" (use: ${DECISIONS.join("|")})`);
  return { ...decisions, [id]: { decision, note: note ?? null, at: nowIso } };
}

/** Counts by decision + by state, for the status view. */
export function summarize(rows) {
  const byDecision = { pending: 0, accepted: 0, deferred: 0, replan: 0 };
  const byState = {};
  for (const r of rows) {
    byDecision[r.decision ?? "pending"] = (byDecision[r.decision ?? "pending"] ?? 0) + 1;
    byState[r.state] = (byState[r.state] ?? 0) + 1;
  }
  return { total: rows.length, byDecision, byState };
}

/**
 * Integrity verify (generate-then-verify discipline): catch drift between the plan and reality.
 * `exists(relPath)` is injected. Flags: a "done" option whose referenced package/doc is missing,
 * and any option id collision. Returns { ok, findings:[{id, level, message}] }.
 */
export function verifyPlan(plan, exists) {
  const findings = [];
  const seen = new Set();
  for (const buildId of Object.keys(plan?.builds ?? {})) {
    const { rows } = flattenBuild(plan, buildId);
    for (const r of rows) {
      if (seen.has(r.id)) findings.push({ id: r.id, level: "error", message: `duplicate option id "${r.id}"` });
      seen.add(r.id);
      // A "done" rebuild option should map to a real package directory when its title names one.
      const pkg = (r.title.match(/@heady\/([a-z0-9-]+)/) || [])[1];
      if (r.state === "done" && pkg && !exists(`packages/${pkg}`)) {
        findings.push({ id: r.id, level: "warn", message: `marked done but packages/${pkg} not found — plan may have drifted` });
      }
    }
  }
  return { ok: findings.every((f) => f.level !== "error"), findings };
}

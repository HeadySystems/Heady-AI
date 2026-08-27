// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Rotation Planner v1.0.0                                   ║
// ║  PURE age-based "rotation-due" planner. No crypto, no key         ║
// ║  material, no overlap/cadence — those are patent-zone executor    ║
// ║  mechanics (HS-2026-051+) gated by founder clearance.             ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// ARBITER-cleared (elements 1–2): this only answers "which secrets are past maxAgeDays, and by which
// strategy would they rotate". It deliberately performs NO rotation — generating a new value, writing
// a Secret Manager version, or running the dual-key-overlap/zero-downtime cutover is the BLOCKED
// executor (element 3). Keep this function side-effect-free; adding overlap logic re-enters the zone.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Plan which secrets are due for rotation.
 * @param {ReadonlyArray<object>} registry  entries with optional `rotation: {strategy, maxAgeDays}`
 * @param {Record<string, number>} ages      name → epoch-ms of the last rotation (current version createTime)
 * @param {number} now                        epoch-ms "now"
 * @returns {{due:Array, ok:boolean, byStrategy:Record<string,number>, unknownAge:string[]}}
 */
export function planRotation(registry, ages = {}, now) {
  if (!Number.isFinite(now)) throw new TypeError("planRotation: `now` must be epoch-ms");
  const due = [];
  const unknownAge = [];
  const byStrategy = {};
  for (const spec of registry) {
    if (!spec.rotation) continue; // non-secret / nothing to rotate
    const last = ages[spec.name];
    if (last == null) {
      // No recorded rotation time ⇒ treat as due (never rotated), but flag it so the operator knows
      // the age is unknown rather than measured.
      unknownAge.push(spec.name);
    }
    const ageDays = last == null ? Infinity : Math.floor((now - last) / DAY_MS);
    if (ageDays >= spec.rotation.maxAgeDays) {
      due.push({
        name: spec.name,
        strategy: spec.rotation.strategy,
        ageDays: ageDays === Infinity ? null : ageDays,
        maxAgeDays: spec.rotation.maxAgeDays,
        autoRotatable: spec.rotation.strategy === "internal",
      });
      byStrategy[spec.rotation.strategy] = (byStrategy[spec.rotation.strategy] ?? 0) + 1;
    }
  }
  due.sort((a, b) => a.name.localeCompare(b.name));
  return { due, ok: due.length === 0, byStrategy, unknownAge: unknownAge.sort() };
}

/**
 * Split a rotation plan into what an (ARBITER-cleared) automated rotator could handle vs. what needs
 * a provider API or a human. Pure — purely a classification of the plan, not an executor.
 */
export function partitionPlan(plan) {
  const auto = plan.due.filter((d) => d.autoRotatable);
  const providerAssisted = plan.due.filter((d) => d.strategy === "provider");
  const manual = plan.due.filter((d) => d.strategy === "manual" || d.strategy === "root");
  return { auto, providerAssisted, manual };
}

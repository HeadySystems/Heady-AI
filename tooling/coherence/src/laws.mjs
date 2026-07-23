// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Coverage — the "no toothless law" gate                 ║
// ║  Pure logic behind the coherence kernel's LAW-* checks. Reads the   ║
// ║  law registry (configs/laws.json) and proves: every ENFORCED law    ║
// ║  maps to a real enforcer (a canonical-lib rule id that actually     ║
// ║  exists, or an enforcer module that exists); every canonical rule   ║
// ║  id is claimed by some enforced law (downgrade ratchet — a rule     ║
// ║  can't be silently demoted to advisory); AGENTS.md numbered rules   ║
// ║  are contiguously covered; advisory gaps + known defects surface.   ║
// ║  Dependency-free + pure (rule ids / module-exists injected).        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

const TIERS = ["enforced", "advisory"];

/** Validate the registry shape. @returns {{ok:boolean, errors:string[]}} */
export function validateLawRegistry(reg) {
  const errors = [];
  if (!reg || typeof reg !== "object") return { ok: false, errors: ["registry is not an object"] };
  if (reg.schema !== "laws.v1") errors.push(`registry.schema must be "laws.v1", got ${JSON.stringify(reg.schema)}`);
  if (!Array.isArray(reg.laws) || reg.laws.length === 0) errors.push("registry.laws must be a non-empty array");
  for (const [i, law] of (Array.isArray(reg.laws) ? reg.laws : []).entries()) {
    if (typeof law?.id !== "string" || !law.id) errors.push(`laws[${i}].id must be a non-empty string`);
    if (typeof law?.statement !== "string" || !law.statement) errors.push(`laws[${i}].statement must be a non-empty string`);
    if (!TIERS.includes(law?.tier)) errors.push(`laws[${i}].tier must be one of ${JSON.stringify(TIERS)} (got ${JSON.stringify(law?.tier)})`);
    if (law?.tier === "enforced") {
      const e = law.enforcer;
      const hasLib = e && e.lib === true && Array.isArray(e.ruleIds) && e.ruleIds.length > 0;
      const hasModule = e && typeof e.module === "string" && e.module;
      if (!hasLib && !hasModule) errors.push(`laws[${i}] (${law.id}) is enforced but declares no enforcer (lib+ruleIds or module)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Compute LAW-* findings (coherence kernel finding shape). Pure — IO injected:
 *   registry     parsed configs/laws.json (or null)
 *   libRuleIds   the id of every rule exported by the canonical lib (tooling/enforcers/lib/rules.mjs)
 *   moduleExists (path) => boolean
 * @returns {Array<{id,tier,kind,msg,evidence}>}
 */
export function checkLaws({ registry, libRuleIds = [], moduleExists = () => false }) {
  const findings = [];
  const err = (id, msg, evidence) => findings.push({ id, tier: "error", kind: "contradiction", msg, evidence });
  const info = (id, msg, evidence) => findings.push({ id, tier: "info", kind: "incomplete", msg, evidence });

  if (!registry) { err("LAW-registry", "law registry missing or unreadable (configs/laws.json)", {}); return findings; }
  const shape = validateLawRegistry(registry);
  if (!shape.ok) { for (const e of shape.errors) err("LAW-schema", `law registry invalid: ${e}`, {}); return findings; }

  const lib = new Set(libRuleIds);
  const enforced = registry.laws.filter((l) => l.tier === "enforced");
  const claimed = new Set(); // canonical-lib rule ids claimed by enforced laws

  for (const law of enforced) {
    const e = law.enforcer;
    if (e.lib === true) {
      for (const rid of e.ruleIds) {
        claimed.add(rid);
        if (!lib.has(rid)) err("LAW-enforcer-missing", `law "${law.id}" claims canonical rule "${rid}" that does not exist in the enforcer lib`, { ruleId: rid });
      }
    } else if (!moduleExists(e.module)) {
      err("LAW-enforcer-missing", `law "${law.id}" maps to enforcer module that does not exist`, { module: e.module });
    }
  }

  // Downgrade ratchet: every canonical-lib rule id MUST be claimed by some enforced law,
  // else a rule could be silently demoted to advisory to dodge coverage (STAGE0-self analog).
  for (const rid of libRuleIds) {
    if (!claimed.has(rid)) err("LAW-downgrade", `canonical enforcer rule "${rid}" is not claimed by any enforced law (dodge risk)`, { ruleId: rid });
  }

  // AGENTS.md numbered rules must be CONTIGUOUSLY covered 1..max — a gap means a rule
  // was dropped from the registry (no hardcoded count → no magic number).
  const nums = [...new Set(registry.laws.map((l) => l.agents_md).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  if (nums.length) {
    for (let n = 1; n <= nums[nums.length - 1]; n += 1) {
      if (!nums.includes(n)) err("LAW-uncovered", `AGENTS.md coding rule #${n} is not present in the law registry`, { rule: n });
    }
  }

  // Honest surfacing (INFO, never a false exit-2): advisory gaps + tracked defects.
  for (const law of registry.laws.filter((l) => l.tier === "advisory")) {
    info("LAW-advisory", `law "${law.id}" is declared but has NO static enforcer (advisory)`, { agents_md: law.agents_md ?? null });
  }
  for (const d of registry.known_defects || []) {
    info("LAW-defect", `tracked enforcement defect: ${d.id} (${d.status})`, { surface: d.surface });
  }

  return findings;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scalar Guards — canonical load-bearing numbers             ║
// ║  Pure logic behind the coherence kernel's C-scalar checks. One      ║
// ║  row per tracked fact: prose/config/skill assertions of a canonical ║
// ║  number are cross-checked against the golden record (facts.yaml)    ║
// ║  across SCALAR_SCOPE. The kernel owns the IO (grep over the tree);  ║
// ║  this module owns the semantics (allow filtering, extraction,       ║
// ║  comparison) so the guard contract is unit-testable.                ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// Each guard: factKey (dotted facts.yaml key) · find (ERE for the kernel's grep — MUST co-locate
// the SUBJECT with the number) · extract (JS regex whose group 1 is the asserted number) ·
// allow (regex exempting legit context: drift-marker prose by WORD-BOUNDED token, vision/analysis
// surfaces and test files by PATH prefix — a marker word buried in an identifier never exempts).
// Add a row to track a new number; no other code changes needed.
export const SCALAR_GUARDS = [
  { id: 'C-hcfp-stages', factKey: 'hcfullpipeline.stage_count', label: 'HCFullPipeline stage count',
    find: '[0-9]+[ -][Ss]tage[ -]?(DAG )?HCFullPipeline|HCFullPipeline[^.]{0,40}[0-9]+[ -][Ss]tage|HCFP[^.]{0,24}[0-9]+[ -][Ss]tage',
    extract: /([0-9]+)[ -][Ss]tage/,
    // test files legitimately assert the REJECTION of wrong counts → path-exempt (mirrors C-dropped's isTest)
    allow: /(^|\/)tests?\/|\.(test|spec)\.[cm]?js:|legacy|14 top-level|nested|provenance|\bwas\b|superseded|\bv1\b|older|reduced|buildable|Phase-?3|critical path|off-path|claimed|wrongly|incorrect|drift|disagree|sneak|example|stale/i },
  // ADR-0040: fib(20)=6765 is the enforced runtime concurrency ceiling; 10000 is roadmap language
  // only. Subject co-location: an explicit max_concurrent_* key (any magnitude, so a silently
  // LOWERED ceiling is caught too), or a 4+ digit "N concurrent bee/agent/worker" claim.
  { id: 'C-capacity', factKey: 'capacity.max_concurrent_runtime', label: 'runtime concurrency ceiling',
    find: 'max_concurrent_[a-z_]+.{0,4}[0-9][0-9,]+|[0-9][0-9,]{3,}[ -]concurrent (bee|agent|worker)',
    // the number must sit in subject context (after a max_concurrent_* key or before "concurrent"),
    // so path digits like docs/adr/0040-… are never extracted as the asserted value
    extract: /((?<=max_concurrent_[a-z_]+\W{0,4})[0-9](?:[0-9,]*[0-9])?|[0-9][0-9,]{2,}[0-9](?=[ -]concurrent))/,
    // "drift(" (a call, e.g. the contracts test helper) is NOT the drift-marker word — hence (?!\s*\()
    allow: /^(docs\/(compendium|master-plan|blueprints)|\.agents\/context)\/|(^|\/)tests?\/|\.(test|spec)\.[cm]?js:|\bsuperseded\b|\bdrifts?\b(?!\s*\()|\broadmap\b|\baspirational\b|\btargets?\b|\breadiness\b|\bclaim(s|ed)?\b|\bsoak\b|\bbounded\b|\bvision\b|\bliterals?\b|\breduced\b|\bvocabulary\b|\blegacy\b|\barchived?\b|\bsnapshots?\b/i },
];

/**
 * Pure guard semantics over grep-shaped lines ("path:lineno:content", ROOT-relative).
 * A line violates when it is not exempted by `guard.allow`, `guard.extract` finds an
 * asserted number, and that number differs from the golden-record value.
 * @param {string[]} lines raw grep output lines for `guard.find` (unfiltered)
 * @param {{allow: RegExp, extract: RegExp}} guard a SCALAR_GUARDS row
 * @param {string} want canonical value from facts.yaml, as a string
 * @returns {{line: string, asserted: string}[]} violations, in input order
 */
export function scalarViolations(lines, guard, want) {
  const out = [];
  for (const line of lines) {
    if (guard.allow.test(line)) continue;
    const asserted = line.match(guard.extract)?.[1];
    if (asserted && asserted !== want) out.push({ line, asserted });
  }
  return out;
}

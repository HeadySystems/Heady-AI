// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — normalized shapes (strict validators)          ║
// ║  The org + filing records the loader persists. Strict, dependency- ║
// ║  free (facts-schema idiom): a filing MUST carry provenance         ║
// ║  (source object id + content hash) — no fact without its source.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

export const RETURN_TYPES = Object.freeze(["990", "990-EZ", "990-PF", "990-N"]);

const isStr = (v) => typeof v === "string" && v.length > 0;
const numOrNull = (v) => v === null || (typeof v === "number" && Number.isFinite(v));
const intOrNull = (v) => v === null || (Number.isInteger(v) && v >= 0);
const push = (e, m) => { e.push(m); return false; };

/** Validate a normalized organization. @returns {{ok, errors}} */
export function validateOrg(o) {
  const e = [];
  if (!o || typeof o !== "object") return { ok: false, errors: ["org must be an object"] };
  if (!/^[0-9]{9}$/.test(String(o.ein))) push(e, "org.ein must be 9 digits");
  if (!isStr(o.name)) push(e, "org.name required");
  if (o.state != null && !/^[A-Z]{2}$/.test(String(o.state))) push(e, "org.state must be a 2-letter code or null");
  return { ok: e.length === 0, errors: e };
}

/** Validate a normalized filing — provenance is mandatory. @returns {{ok, errors}} */
export function validateFiling(f) {
  const e = [];
  if (!f || typeof f !== "object") return { ok: false, errors: ["filing must be an object"] };
  if (!/^[0-9]{9}$/.test(String(f.ein))) push(e, "filing.ein must be 9 digits");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.taxPeriodEnd))) push(e, "filing.taxPeriodEnd must be YYYY-MM-DD");
  if (!RETURN_TYPES.includes(f.returnType)) push(e, `filing.returnType must be ${RETURN_TYPES.join("|")}`);
  for (const k of ["totalRevenue", "totalExpenses", "totalAssetsEoy", "totalLiabilitiesEoy", "netAssetsEoy"]) {
    if (!numOrNull(f[k])) push(e, `filing.${k} must be a finite number or null`);
  }
  for (const k of ["votingMembers", "independentMembers"]) {
    if (!intOrNull(f[k])) push(e, `filing.${k} must be a non-negative integer or null`);
  }
  // Provenance — no fact without its source.
  if (!isStr(f.sourceObjectId)) push(e, "filing.sourceObjectId required (provenance)");
  if (!/^[a-f0-9]{64}$/.test(String(f.contentSha256))) push(e, "filing.contentSha256 must be a sha256 hex (provenance)");
  if (f.sourceUrl != null && !String(f.sourceUrl).startsWith("https://")) push(e, "filing.sourceUrl must be https:// or null");
  return { ok: e.length === 0, errors: e };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — normalize parsed 990 → org + filing records    ║
// ║  Binds the parsed fields to their SOURCE (object id + content hash ║
// ║  + optional url) so every persisted fact is provenance-linked, and ║
// ║  validates the result against the strict shapes. Pure.            ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { parse990 } from "./parse.mjs";
import { validateOrg, validateFiling } from "./shapes.mjs";

/**
 * Normalize a raw 990 XML into { org, filing } with provenance, validated.
 * @param {string} xml raw filing XML
 * @param {{sourceObjectId:string, sourceUrl?:string}} source provenance of this filing
 * @returns {{ok:boolean, errors:string[], org:object|null, filing:object|null}}
 */
export function normalize990(xml, source) {
  if (!source || !source.sourceObjectId) throw new TypeError("source.sourceObjectId required (provenance)");
  const p = parse990(xml);

  const org = { ein: p.ein, name: p.name, state: p.state, nteeCode: p.nteeCode ?? null, subsectionCd: p.subsectionCd ?? null, rulingYear: p.rulingYear ?? null };
  const filing = {
    ein: p.ein,
    taxPeriodEnd: p.taxPeriodEnd,
    returnType: p.returnType,
    totalRevenue: p.totalRevenue,
    totalExpenses: p.totalExpenses,
    totalAssetsEoy: p.totalAssetsEoy,
    totalLiabilitiesEoy: p.totalLiabilitiesEoy,
    netAssetsEoy: p.netAssetsEoy,
    votingMembers: p.votingMembers,
    independentMembers: p.independentMembers,
    sourceObjectId: source.sourceObjectId,
    sourceUrl: source.sourceUrl ?? null,
    contentSha256: p.contentSha256,
  };

  const ov = validateOrg(org);
  const fv = validateFiling(filing);
  const errors = [...ov.errors, ...fv.errors];
  return { ok: errors.length === 0, errors, org: ov.ok ? org : null, filing: fv.ok ? filing : null };
}

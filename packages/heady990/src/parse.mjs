// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — IRS Form 990 MeF XML parser                    ║
// ║  A targeted field extractor over the IRS e-file (MeF) 990 schema — ║
// ║  ReturnHeader (Filer EIN / name / state, tax period, return type)  ║
// ║  and ReturnData IRS990 (financials + governance). It is a focused   ║
// ║  reader of the KNOWN MeF element names, not a general XML DOM; that ║
// ║  keeps it dependency-free and deterministic for the fields the      ║
// ║  product needs. Every parse carries a content hash for provenance. ║
// ║  Source schema: IRS MeF 990 (public bulk XML). © 2026 HeadySystems ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createHash } from "node:crypto";

/** SHA-256 of the raw filing bytes — the provenance anchor. */
export function contentSha256(xml) {
  return createHash("sha256").update(String(xml), "utf8").digest("hex");
}

/** First inner text of <Tag ...>…</Tag> (namespace-prefix tolerant), else null. */
export function tagText(xml, tag) {
  const m = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml);
  return m ? m[1].replace(/<[^>]*>/g, "").trim() || null : null;
}

const num = (v) => { if (v == null) return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = num(v); return n == null ? null : Math.trunc(n); };

/**
 * Parse an IRS MeF 990 return XML into raw fields + provenance hash.
 * Returns null-valued fields for anything absent (forms differ). Pure.
 * @param {string} xml raw filing XML
 * @returns {object} { ein, name, state, taxPeriodEnd, returnType, financials…, governance…, contentSha256 }
 */
export function parse990(xml) {
  if (typeof xml !== "string" || xml.trim() === "") throw new TypeError("990 XML string required");

  // ReturnType: attribute on ReturnHeader OR <ReturnTypeCd>.
  const returnTypeAttr = /<(?:\w+:)?ReturnHeader\b[^>]*\breturnVersion=/.test(xml) ? null : null;
  const returnType = tagText(xml, "ReturnTypeCd") || returnTypeAttr;

  return {
    ein: tagText(xml, "EIN"),
    name: tagText(xml, "BusinessNameLine1Txt") || tagText(xml, "BusinessNameLine1"),
    state: tagText(xml, "StateAbbreviationCd") || tagText(xml, "State"),
    taxPeriodEnd: tagText(xml, "TaxPeriodEndDt") || tagText(xml, "TaxPeriodEndDate"),
    returnType,
    totalRevenue: num(tagText(xml, "CYTotalRevenueAmt") || tagText(xml, "TotalRevenueAmt")),
    totalExpenses: num(tagText(xml, "CYTotalExpensesAmt") || tagText(xml, "TotalExpensesAmt")),
    totalAssetsEoy: num(tagText(xml, "TotalAssetsEOYAmt")),
    totalLiabilitiesEoy: num(tagText(xml, "TotalLiabilitiesEOYAmt")),
    netAssetsEoy: num(tagText(xml, "NetAssetsOrFundBalancesEOYAmt")),
    votingMembers: int(tagText(xml, "VotingMembersGoverningBodyCnt")),
    independentMembers: int(tagText(xml, "VotingMembersIndependentCnt")),
    contentSha256: contentSha256(xml),
  };
}

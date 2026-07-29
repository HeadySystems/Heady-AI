// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — DbPort loader (org + filing upsert, one tx)    ║
// ║  Persists a normalized { org, filing } into the heady_990 schema    ║
// ║  through an injected @heady/db DbPort — org + filing in ONE         ║
// ║  transaction. Re-ingest updates in place (990 is refreshable        ║
// ║  public data, keyed by ein+period+return_type). The port is        ║
// ║  injected (composition root owns the connection) so this is unit-   ║
// ║  testable with a fake port. © 2026 HeadySystems Inc.              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { validateOrg, validateFiling } from "./shapes.mjs";

/**
 * Load one normalized filing. Fail-closed: an invalid org/filing is rejected
 * before any write. @param port a DbPort (has .tx(fn) with a pg-shaped client).
 * @returns {Promise<{ein:string, filingId:string}>}
 */
export async function loadFiling(port, { org, filing }) {
  if (!port || typeof port.tx !== "function") throw new TypeError("a DbPort with .tx() is required");
  const ov = validateOrg(org); const fv = validateFiling(filing);
  if (!ov.ok || !fv.ok) throw new Error(`invalid 990 record: ${[...ov.errors, ...fv.errors].join("; ")}`);
  if (org.ein !== filing.ein) throw new Error("org.ein and filing.ein must match");

  return port.tx(async (tx) => {
    await tx.query(
      `INSERT INTO heady_990.organizations (ein, name, state, ntee_code, subsection_cd, ruling_year)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (ein) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state,
         ntee_code = EXCLUDED.ntee_code, subsection_cd = EXCLUDED.subsection_cd,
         ruling_year = EXCLUDED.ruling_year, updated_at = now()`,
      [org.ein, org.name, org.state, org.nteeCode ?? null, org.subsectionCd ?? null, org.rulingYear ?? null],
    );
    const r = await tx.query(
      `INSERT INTO heady_990.filings
         (ein, tax_period_end, return_type, total_revenue, total_expenses, total_assets_eoy,
          total_liabilities_eoy, net_assets_eoy, voting_members, independent_members,
          source_object_id, source_url, content_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (ein, tax_period_end, return_type) DO UPDATE SET
         total_revenue = EXCLUDED.total_revenue, total_expenses = EXCLUDED.total_expenses,
         total_assets_eoy = EXCLUDED.total_assets_eoy, total_liabilities_eoy = EXCLUDED.total_liabilities_eoy,
         net_assets_eoy = EXCLUDED.net_assets_eoy, voting_members = EXCLUDED.voting_members,
         independent_members = EXCLUDED.independent_members, source_object_id = EXCLUDED.source_object_id,
         source_url = EXCLUDED.source_url, content_sha256 = EXCLUDED.content_sha256, ingested_at = now()
       RETURNING id`,
      [filing.ein, filing.taxPeriodEnd, filing.returnType, filing.totalRevenue, filing.totalExpenses,
        filing.totalAssetsEoy, filing.totalLiabilitiesEoy, filing.netAssetsEoy, filing.votingMembers,
        filing.independentMembers, filing.sourceObjectId, filing.sourceUrl, filing.contentSha256],
    );
    return { ein: filing.ein, filingId: r.rows?.[0]?.id ?? null };
  });
}

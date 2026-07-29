// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — 990 Intelligence service (Phase-A A3)      ║
// ║  The origin's product action surface over the 990 data plane:      ║
// ║  hybrid search (keyword tsvector + semantic pgvector, RRF-fused),   ║
// ║  org lookup, and filings — every result provenance-linked. Kernel-  ║
// ║  managed; DbPort + query-embedder injected by the composition root  ║
// ║  (no factory ⇒ disabled: health ok/disabled, routes 503 — dev/tests ║
// ║  never touch a live DB). No embedder ⇒ keyword-only (honest         ║
// ║  degrade). © 2026 HeadySystems Inc. — Eric Haywood, Founder        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { startSpan, captureError, metrics, noopExporter } from "@heady/observability";
import { HEALTH } from "@heady/shared";
import { validateSearchQuery, keywordSql, vectorSql, hydrateSql, rrfFuse } from "@heady/heady990";

const EIN_RE = /^[0-9]{9}$/;

/**
 * Build the 990 service + routes.
 * @param {object} opts
 * @param {() => Promise<object>} [opts.getDbPort] async DbPort factory (null ⇒ disabled)
 * @param {(text:string) => Promise<number[]>} [opts.embedQuery] query embedder (null ⇒ keyword-only)
 */
export function createHeady990Service({ log, getDbPort = null, embedQuery = null, exporter = noopExporter, registry = metrics }) {
  let port = null;
  let lastError = null;
  const disabled = getDbPort === null;

  const service = {
    name: "heady990",
    start: async () => {
      if (disabled) { log.info({}, "heady990: disabled (no DbPort factory)"); return; }
      try {
        port = await getDbPort();
        await port.connect();
        await port.query("SELECT 1");
        lastError = null;
        log.info({ embedder: !!embedQuery }, "heady990: live DbPort connected");
      } catch (err) {
        port = null;
        lastError = String(err?.message ?? err);
        log.warn({ err: lastError }, "heady990: DB unavailable — degraded (503)");
      }
    },
    stop: async () => { if (port) await port.end(); port = null; },
    health: async () => {
      if (port) return { status: HEALTH.OK, mode: embedQuery ? "hybrid" : "keyword-only" };
      if (disabled) return { status: HEALTH.OK, mode: "disabled" };
      return { status: HEALTH.DEGRADED, reason: lastError ?? "db not connected" };
    },
    metrics: async () => ({ searches: registry.snapshot().counters["heady990.searches"] ?? 0 }),
  };

  const unavailable = (res) => res.status(503).json({ error: "heady990_unavailable", reason: disabled ? "990 service disabled (no DbPort)" : (lastError ?? "db not connected") });

  async function rankedEins({ q, limit, state, minRevenue }) {
    // Filters go INTO both candidate queries so state/minRevenue narrow the population
    // BEFORE rank+limit — not as a post-filter on an already-truncated top-N.
    const filters = { limit, state, minRevenue };
    // Keyword ranking always; semantic ranking only when an embedder is wired.
    const kw = keywordSql(q, filters);
    const lists = [];
    const kwRows = await port.query(kw.sql, kw.params);
    lists.push(kwRows.rows.map((r) => r.ein));
    let mode = "keyword-only";
    if (embedQuery) {
      try {
        const vec = await embedQuery(q);
        const vq = vectorSql(vec, filters);
        const vRows = await port.query(vq.sql, vq.params);
        lists.push(vRows.rows.map((r) => r.ein));
        mode = "hybrid";
      } catch (err) {
        log.warn({ err: String(err?.message ?? err) }, "heady990: embed failed — keyword-only for this query");
      }
    }
    return { fused: rrfFuse(lists), mode };
  }

  function routes(app) {
    // GET /990/search?q=&limit=&state=&minRevenue= — hybrid, provenance-linked.
    app.get("/990/search", async (req, res) => {
      const v = validateSearchQuery(req.query);
      if (!v.ok) return res.status(400).json({ error: "invalid_request", details: v.errors });
      if (!port) return unavailable(res);
      const span = startSpan("heady990.search", { hasEmbedder: !!embedQuery }, { exporter, registry });
      try {
        const { fused, mode } = await rankedEins(v.value);
        const top = fused.slice(0, v.value.limit);
        registry.counter("heady990.searches").inc();
        if (top.length === 0) { span.end({ hits: 0 }); return res.json({ query: v.value, mode, count: 0, results: [] }); }
        const scoreByEin = new Map(top.map((t) => [t.id, t.score]));
        const hy = hydrateSql(top.map((t) => t.id));
        const rows = await port.query(hy.sql, hy.params);
        // state/minRevenue were already applied in the candidate SQL (pre-rank). Here we only
        // shape + enforce the contract invariant: a search result MUST carry provenance
        // (a filing-less org has no source lineage) — drop any that can't, never emit null.
        const results = rows.rows
          .map((r) => ({
            ein: r.ein, name: r.name, state: r.state, nteeCode: r.ntee_code,
            latestFiling: r.tax_period_end ? {
              taxPeriodEnd: r.tax_period_end, returnType: r.return_type,
              totalRevenue: r.total_revenue, totalExpenses: r.total_expenses, netAssetsEoy: r.net_assets_eoy,
            } : null,
            score: scoreByEin.get(r.ein) ?? 0,
            provenance: r.source_object_id ? { sourceObjectId: r.source_object_id, sourceUrl: r.source_url, contentSha256: r.content_sha256 } : null,
          }))
          .filter((r) => r.provenance !== null)
          .sort((a, b) => b.score - a.score);
        span.end({ hits: results.length, mode });
        return res.json({ query: v.value, mode, count: results.length, results });
      } catch (err) {
        span.end({ failed: true });
        captureError(err, { route: "GET /990/search" }, { exporter, registry });
        log.error({ err: String(err?.message ?? err) }, "heady990: search failed");
        return res.status(500).json({ error: "search_failed" });
      }
    });

    // GET /990/orgs/:ein — one organization.
    app.get("/990/orgs/:ein", async (req, res) => {
      if (!EIN_RE.test(req.params.ein)) return res.status(400).json({ error: "invalid_request", details: ["ein must be 9 digits"] });
      if (!port) return unavailable(res);
      try {
        const r = await port.query("SELECT ein, name, state, ntee_code, subsection_cd, ruling_year FROM heady_990.organizations WHERE ein = $1", [req.params.ein]);
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ org: r.rows[0] });
      } catch (err) {
        captureError(err, { route: "GET /990/orgs/:ein" }, { exporter, registry });
        return res.status(500).json({ error: "read_failed" });
      }
    });

    // GET /990/orgs/:ein/filings — an org's filings, newest first, with provenance.
    app.get("/990/orgs/:ein/filings", async (req, res) => {
      if (!EIN_RE.test(req.params.ein)) return res.status(400).json({ error: "invalid_request", details: ["ein must be 9 digits"] });
      if (!port) return unavailable(res);
      try {
        const r = await port.query(
          `SELECT tax_period_end, return_type, total_revenue, total_expenses, total_assets_eoy,
                  total_liabilities_eoy, net_assets_eoy, voting_members, independent_members,
                  source_object_id, source_url, content_sha256
           FROM heady_990.filings WHERE ein = $1 ORDER BY tax_period_end DESC`,
          [req.params.ein],
        );
        return res.json({ ein: req.params.ein, count: r.rows.length, filings: r.rows });
      } catch (err) {
        captureError(err, { route: "GET /990/orgs/:ein/filings" }, { exporter, registry });
        return res.status(500).json({ error: "read_failed" });
      }
    });
  }

  return { service, routes };
}

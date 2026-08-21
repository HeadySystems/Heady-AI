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

  function unavailableReason() {
    return disabled ? "990 service disabled (no DbPort)" : (lastError ?? "db not connected");
  }

  function assertAvailable() {
    if (port) return;
    const error = new Error(unavailableReason());
    error.code = "heady990_unavailable";
    throw error;
  }

  function validateEin(ein) {
    if (EIN_RE.test(ein)) return;
    const error = new Error("ein must be 9 digits");
    error.code = "invalid_request";
    error.details = [error.message];
    throw error;
  }

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

  async function search(input) {
    const validated = validateSearchQuery(input);
    if (!validated.ok) {
      const error = new Error("invalid 990 search request");
      error.code = "invalid_request";
      error.details = validated.errors;
      throw error;
    }
    assertAvailable();
    const span = startSpan("heady990.search", { hasEmbedder: !!embedQuery }, { exporter, registry });
    try {
      const { fused, mode } = await rankedEins(validated.value);
      const top = fused.slice(0, validated.value.limit);
      registry.counter("heady990.searches").inc();
      if (top.length === 0) {
        span.end({ hits: 0 });
        return { query: validated.value, mode, count: 0, results: [] };
      }
      const scoreByEin = new Map(top.map((item) => [item.id, item.score]));
      const hydrate = hydrateSql(top.map((item) => item.id));
      const rows = await port.query(hydrate.sql, hydrate.params);
      // state/minRevenue were already applied in the candidate SQL (pre-rank). Here we only
      // shape + enforce the contract invariant: a search result MUST carry provenance
      // (a filing-less org has no source lineage) — drop any that can't, never emit null.
      const results = rows.rows
        .map((row) => ({
          ein: row.ein, name: row.name, state: row.state, nteeCode: row.ntee_code,
          latestFiling: row.tax_period_end ? {
            taxPeriodEnd: row.tax_period_end, returnType: row.return_type,
            totalRevenue: row.total_revenue, totalExpenses: row.total_expenses, netAssetsEoy: row.net_assets_eoy,
          } : null,
          score: scoreByEin.get(row.ein) ?? 0,
          provenance: row.source_object_id ? { sourceObjectId: row.source_object_id, sourceUrl: row.source_url, contentSha256: row.content_sha256 } : null,
        }))
        .filter((result) => result.provenance !== null)
        .sort((left, right) => right.score - left.score);
      span.end({ hits: results.length, mode });
      return { query: validated.value, mode, count: results.length, results };
    } catch (error) {
      span.end({ failed: true });
      captureError(error, { operation: "heady990.search" }, { exporter, registry });
      throw error;
    }
  }

  async function getOrg(ein) {
    validateEin(ein);
    assertAvailable();
    const result = await port.query("SELECT ein, name, state, ntee_code, subsection_cd, ruling_year FROM heady_990.organizations WHERE ein = $1", [ein]);
    if (result.rows.length === 0) {
      const error = new Error("990 organization not found");
      error.code = "not_found";
      throw error;
    }
    return { org: result.rows[0] };
  }

  async function getFilings(ein) {
    validateEin(ein);
    assertAvailable();
    const result = await port.query(
      `SELECT tax_period_end, return_type, total_revenue, total_expenses, total_assets_eoy,
              total_liabilities_eoy, net_assets_eoy, voting_members, independent_members,
              source_object_id, source_url, content_sha256
       FROM heady_990.filings WHERE ein = $1 ORDER BY tax_period_end DESC`,
      [ein],
    );
    return { ein, count: result.rows.length, filings: result.rows };
  }

  function respondError(res, error, fallback) {
    if (error.code === "invalid_request") return res.status(400).json({ error: error.code, details: error.details });
    if (error.code === "heady990_unavailable") return res.status(503).json({ error: error.code, reason: error.message });
    if (error.code === "not_found") return res.status(404).json({ error: error.code });
    return res.status(500).json({ error: fallback });
  }

  function routes(app) {
    // GET /990/search?q=&limit=&state=&minRevenue= — hybrid, provenance-linked.
    app.get("/990/search", async (req, res) => {
      try {
        return res.json(await search(req.query));
      } catch (error) {
        log.error({ err: String(error?.message ?? error) }, "heady990: search failed");
        return respondError(res, error, "search_failed");
      }
    });

    // GET /990/orgs/:ein — one organization.
    app.get("/990/orgs/:ein", async (req, res) => {
      try {
        return res.json(await getOrg(req.params.ein));
      } catch (error) {
        captureError(error, { route: "GET /990/orgs/:ein" }, { exporter, registry });
        return respondError(res, error, "read_failed");
      }
    });

    // GET /990/orgs/:ein/filings — an org's filings, newest first, with provenance.
    app.get("/990/orgs/:ein/filings", async (req, res) => {
      try {
        return res.json(await getFilings(req.params.ein));
      } catch (error) {
        captureError(error, { route: "GET /990/orgs/:ein/filings" }, { exporter, registry });
        return respondError(res, error, "read_failed");
      }
    });
  }

  return {
    service,
    routes,
    availability: () => port ? true : { available: false, reason: unavailableReason() },
    search,
    getOrg,
    getFilings,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — hybrid search (keyword + semantic, RRF-fused)   ║
// ║  Pure query builders + Reciprocal Rank Fusion. The service runs the ║
// ║  keyword (tsvector) and semantic (pgvector) queries via DbPort and  ║
// ║  fuses their rankings here with RRF — no store coupling, so the      ║
// ║  fusion is unit-testable and the SQL is inspectable. k=60 per the    ║
// ║  standard RRF constant. Made with ❤️ by HeadySystems Inc.          ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Standard RRF constant. */
export const RRF_K = 60;

/**
 * Reciprocal Rank Fusion over one-or-more ranked id lists. Each list is an
 * array of ids in rank order (best first). @returns [{id, score}] desc by score.
 * Pure — the core of "hybrid" search: a doc ranked well by EITHER signal rises.
 */
export function rrfFuse(rankedLists, k = RRF_K) {
  if (!Array.isArray(rankedLists)) throw new TypeError("rankedLists must be an array of id arrays");
  if (!(Number.isFinite(k) && k > 0)) throw new Error("k must be positive");
  const scores = new Map();
  for (const list of rankedLists) {
    if (!Array.isArray(list)) continue;
    list.forEach((id, rank) => { scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)); });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score: Math.round(score * 1e6) / 1e6 }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

// Accept a bare number (limit) OR an options bag {limit,state,minRevenue}.
function normalizeOpts(opts) {
  const o = typeof opts === "number" ? { limit: opts } : (opts ?? {});
  const limit = o.limit ?? 20;
  if (!(Number.isInteger(limit) && limit > 0 && limit <= 200)) throw new Error("limit must be 1..200");
  const state = o.state ?? null;
  if (state !== null && !/^[A-Z]{2}$/.test(String(state))) throw new Error("state must be a 2-letter code");
  const minRevenue = o.minRevenue ?? null;
  if (minRevenue !== null && !(Number.isFinite(minRevenue) && minRevenue >= 0)) throw new Error("minRevenue must be >= 0");
  return { limit, state, minRevenue };
}

// Build the shared WHERE filters (state on the org; minRevenue on the LATEST filing).
// Applied to the CANDIDATE population BEFORE rank+limit — never post-filtering a truncated
// top-N (which would drop matching rows that merely ranked past the limit). Returns the
// clause text, its bound params, and the next positional index for LIMIT.
function buildFilters(startIndex, { state, minRevenue }) {
  const clauses = [];
  const params = [];
  let i = startIndex;
  if (state !== null) { clauses.push(`AND o.state = $${i++}`); params.push(state); }
  if (minRevenue !== null) {
    clauses.push(
      `AND COALESCE((SELECT ff.total_revenue FROM heady_990.filings ff
                     WHERE ff.ein = o.ein ORDER BY ff.tax_period_end DESC LIMIT 1), 0) >= $${i++}`,
    );
    params.push(minRevenue);
  }
  return { clause: clauses.join("\n            "), params, nextIndex: i };
}

/**
 * Keyword (tsvector) candidate query → ranked EINs, state/minRevenue applied pre-rank.
 * @param {string} query
 * @param {number|{limit?:number,state?:string|null,minRevenue?:number|null}} [opts]
 * @returns {{sql:string, params:any[]}}
 */
export function keywordSql(query, opts = {}) {
  if (typeof query !== "string" || query.trim() === "") throw new TypeError("query text required");
  const { limit, state, minRevenue } = normalizeOpts(opts);
  const f = buildFilters(2, { state, minRevenue }); // $1 = query text
  return {
    sql: `SELECT o.ein FROM heady_990.organizations o
          WHERE o.search_tsv @@ websearch_to_tsquery('english', $1)
            ${f.clause}
          ORDER BY ts_rank(o.search_tsv, websearch_to_tsquery('english', $1)) DESC
          LIMIT $${f.nextIndex}`,
    params: [query, ...f.params, limit],
  };
}

/**
 * Semantic (pgvector cosine) candidate query → nearest EINs, state/minRevenue applied pre-rank.
 * @param {number[]} embedding 384-dim
 * @param {number|{limit?:number,state?:string|null,minRevenue?:number|null}} [opts]
 * @returns {{sql:string, params:any[]}}
 */
export function vectorSql(embedding, opts = {}) {
  if (!Array.isArray(embedding) || embedding.length !== 384 || embedding.some((x) => !Number.isFinite(x))) {
    throw new TypeError("embedding must be a 384-dim finite vector");
  }
  const { limit, state, minRevenue } = normalizeOpts(opts);
  const f = buildFilters(2, { state, minRevenue }); // $1 = query vector
  return {
    sql: `SELECT o.ein FROM heady_990.organizations o
          WHERE o.embedding IS NOT NULL
            ${f.clause}
          ORDER BY o.embedding <=> $1::vector
          LIMIT $${f.nextIndex}`,
    params: [`[${embedding.join(",")}]`, ...f.params, limit],
  };
}

/** Fetch org + latest filing (with provenance) for a set of EINs, preserving order. Pure builder. */
export function hydrateSql(eins) {
  if (!Array.isArray(eins) || eins.length === 0) throw new TypeError("eins must be a non-empty array");
  const ph = eins.map((_, i) => `$${i + 1}`).join(",");
  return {
    sql: `SELECT o.ein, o.name, o.state, o.ntee_code,
                 f.tax_period_end, f.return_type, f.total_revenue, f.total_expenses,
                 f.net_assets_eoy, f.source_object_id, f.source_url, f.content_sha256
          FROM heady_990.organizations o
          LEFT JOIN LATERAL (
            SELECT * FROM heady_990.filings ff WHERE ff.ein = o.ein
            ORDER BY ff.tax_period_end DESC LIMIT 1
          ) f ON true
          WHERE o.ein IN (${ph})`,
    params: [...eins],
  };
}

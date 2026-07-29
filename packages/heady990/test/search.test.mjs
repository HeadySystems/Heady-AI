// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — hybrid search tests (RRF + query builders)     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { rrfFuse, keywordSql, vectorSql, hydrateSql, RRF_K } from "../src/search.mjs";
import { validateSearchQuery } from "../src/shapes.mjs";

test("rrfFuse rewards docs ranked well by EITHER signal, and dedupes across lists", () => {
  const keyword = ["A", "B", "C"];
  const semantic = ["C", "D", "A"];
  const fused = rrfFuse([keyword, semantic]);
  // A (rank0 + rank2) and C (rank2 + rank0) score highest; both beat single-list B/D.
  const ids = fused.map((f) => f.id);
  assert.equal(ids[0] === "A" || ids[0] === "C", true);
  assert.ok(fused.find((f) => f.id === "A").score > fused.find((f) => f.id === "B").score);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.equal(RRF_K, 60);
});

test("rrfFuse is order-stable and tolerant of empty/absent lists", () => {
  assert.deepEqual(rrfFuse([[], []]), []);
  assert.deepEqual(rrfFuse([["X"]]).map((f) => f.id), ["X"]);
  assert.throws(() => rrfFuse("nope"));
});

test("keywordSql builds a websearch tsvector query with bound params", () => {
  const { sql, params } = keywordSql("food bank", 10);
  assert.match(sql, /websearch_to_tsquery/);
  assert.match(sql, /search_tsv @@/);
  assert.deepEqual(params, ["food bank", 10]);
  assert.throws(() => keywordSql("", 10));
  assert.throws(() => keywordSql("x", 9999));
});

test("keywordSql pushes state + minRevenue into the WHERE (pre-rank, not post-filter)", () => {
  const { sql, params } = keywordSql("hospital", { limit: 20, state: "CA", minRevenue: 1000000 });
  // filters bind BEFORE the LIMIT — so rank+limit sees the filtered population.
  assert.match(sql, /AND o\.state = \$2/);
  assert.match(sql, /total_revenue[\s\S]*>= \$3/);
  assert.match(sql, /LIMIT \$4/);
  assert.deepEqual(params, ["hospital", "CA", 1000000, 20]);
  // no filters ⇒ LIMIT is $2 (back-compat with the bare-number form).
  assert.match(keywordSql("x", { limit: 5 }).sql, /LIMIT \$2/);
  assert.throws(() => keywordSql("x", { state: "California" }));
});

test("vectorSql requires a 384-dim vector and binds it as ::vector", () => {
  const vec = new Array(384).fill(0.1);
  const { sql, params } = vectorSql(vec, 5);
  assert.match(sql, /embedding <=> \$1::vector/);
  assert.equal(params[0].startsWith("[0.1,"), true);
  assert.equal(params[1], 5);
  assert.throws(() => vectorSql(new Array(10).fill(0), 5)); // wrong dim
});

test("vectorSql applies the same pre-rank filters as keywordSql", () => {
  const vec = new Array(384).fill(0.1);
  const { sql, params } = vectorSql(vec, { limit: 8, state: "NY" });
  assert.match(sql, /AND o\.state = \$2/);
  assert.match(sql, /ORDER BY o\.embedding <=> \$1::vector/);
  assert.match(sql, /LIMIT \$3/);
  assert.deepEqual(params, [`[${vec.join(",")}]`, "NY", 8]);
});

test("hydrateSql fetches org + latest filing with provenance columns", () => {
  const { sql, params } = hydrateSql(["123456789", "987654321"]);
  assert.match(sql, /LEFT JOIN LATERAL/);
  assert.match(sql, /source_object_id/);
  assert.match(sql, /content_sha256/);
  assert.deepEqual(params, ["123456789", "987654321"]);
  assert.throws(() => hydrateSql([]));
});

test("validateSearchQuery enforces the API boundary", () => {
  assert.equal(validateSearchQuery({ q: "arts" }).ok, true);
  assert.equal(validateSearchQuery({ q: "arts", limit: 5, state: "ca", minRevenue: "1000" }).value.state, "CA");
  assert.equal(validateSearchQuery({ q: "" }).ok, false);
  assert.equal(validateSearchQuery({ q: "x", limit: 0 }).ok, false);
  assert.equal(validateSearchQuery({ q: "x", state: "California" }).ok, false);
  assert.equal(validateSearchQuery({ q: "x", minRevenue: -1 }).ok, false);
});

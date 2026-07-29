// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — 990 service route tests (A3)              ║
// ║  Fake DbPort + express, no live DB/network: proves hybrid vs       ║
// ║  keyword-only search, provenance in results, and honest disabled.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHeady990Service } from "../src/heady990.mjs";

const noLog = { info: () => {}, warn: () => {}, error: () => {} };

// A fake DbPort that answers the 990 queries from in-memory fixtures.
function fakePort() {
  const orgs = [
    { ein: "111111111", name: "ARTS ALLIANCE", state: "CA", ntee_code: "A20" },
    { ein: "222222222", name: "FOOD BANK OF THE VALLEY", state: "CA", ntee_code: "K31" },
    { ein: "333333333", name: "GOTHAM FOOD RELIEF", state: "NY", ntee_code: "K31" },
  ];
  const filing = (ein) => ({
    ein, tax_period_end: "2023-12-31", return_type: "990", total_revenue: 2450000, total_expenses: 2100000,
    net_assets_eoy: 4500000, total_assets_eoy: 5300000, total_liabilities_eoy: 800000, voting_members: 11, independent_members: 9,
    source_object_id: `obj-${ein}`, source_url: "https://apps.irs.gov/x.xml", content_sha256: "a".repeat(64),
  });
  // Decode the pre-rank filters the candidate SQL pushed down ($1 = query/vector,
  // then optional state, then optional minRevenue, then LIMIT last) and apply them to
  // the fixtures — so this fake honors the SAME filtering the real SQL does.
  const applyFilters = (eins, sql, params) => {
    let idx = 1;
    const state = sql.includes("o.state = $") ? params[idx++] : null;
    const minRevenue = sql.includes(">= $") ? params[idx++] : null;
    return eins.filter((ein) => {
      const o = orgs.find((x) => x.ein === ein);
      if (state && o.state !== state) return false;
      if (minRevenue != null && filing(ein).total_revenue < minRevenue) return false;
      return true;
    });
  };
  return {
    connect: async () => {}, end: async () => {},
    query: async (sql, params) => {
      if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }] };
      if (sql.includes("search_tsv @@")) return { rows: applyFilters(["333333333", "222222222", "111111111"], sql, params).map((ein) => ({ ein })) }; // keyword ranking
      if (sql.includes("embedding <=>")) return { rows: applyFilters(["111111111"], sql, params).map((ein) => ({ ein })) }; // semantic ranking
      if (sql.includes("LEFT JOIN LATERAL")) {
        const eins = params;
        return { rows: orgs.filter((o) => eins.includes(o.ein)).map((o) => ({ ...o, ...filing(o.ein) })) };
      }
      if (sql.includes("FROM heady_990.organizations WHERE ein")) return { rows: orgs.filter((o) => o.ein === params[0]) };
      if (sql.includes("FROM heady_990.filings WHERE ein")) return { rows: [filing(params[0])] };
      return { rows: [] };
    },
  };
}

async function harness({ embedQuery = null } = {}) {
  const svc = createHeady990Service({ log: noLog, getDbPort: async () => fakePort(), embedQuery });
  await svc.service.start();
  const app = express();
  svc.routes(app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { svc, base, close: async () => { server.close(); await svc.service.stop(); } };
}

test("keyword-only search (no embedder) returns provenance-linked results", async () => {
  const h = await harness();
  try {
    assert.equal((await h.svc.service.health()).mode, "keyword-only");
    const res = await fetch(`${h.base}/990/search?q=food`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.mode, "keyword-only");
    assert.ok(body.count >= 1);
    const first = body.results[0];
    assert.ok(first.provenance && /^[a-f0-9]{64}$/.test(first.provenance.contentSha256), "every result carries provenance");
    assert.ok(first.latestFiling, "latest filing is attached");
  } finally { await h.close(); }
});

test("hybrid search (with embedder) fuses keyword + semantic rankings", async () => {
  const embedQuery = async () => new Array(384).fill(0.05);
  const h = await harness({ embedQuery });
  try {
    assert.equal((await h.svc.service.health()).mode, "hybrid");
    const res = await fetch(`${h.base}/990/search?q=arts&limit=10`);
    const body = await res.json();
    assert.equal(body.mode, "hybrid");
    // 111111111 appears in BOTH keyword and semantic lists → should rank top after RRF.
    assert.equal(body.results[0].ein, "111111111");
    assert.ok(body.results[0].score > 0);
  } finally { await h.close(); }
});

test("state + minRevenue filters apply pre-rank; bad query is 400", async () => {
  const h = await harness();
  try {
    const bad = await fetch(`${h.base}/990/search?q=`);
    assert.equal(bad.status, 400);
    // GOTHAM (NY) ranks FIRST by keyword — a post-filter on a truncated top-N could still
    // surface it; the pushdown must exclude it entirely for state=CA.
    const inCA = await (await fetch(`${h.base}/990/search?q=food&state=CA`)).json();
    assert.ok(inCA.results.every((r) => r.state === "CA"), "state pushdown returns only CA orgs");
    assert.ok(!inCA.results.some((r) => r.ein === "333333333"), "out-of-state top-ranked org excluded");
    const filtered = await fetch(`${h.base}/990/search?q=bank&minRevenue=9999999999`);
    assert.equal((await filtered.json()).count, 0, "minRevenue filter excludes below-threshold orgs");
  } finally { await h.close(); }
});

test("org lookup + filings + 404 + ein validation", async () => {
  const h = await harness();
  try {
    assert.equal((await (await fetch(`${h.base}/990/orgs/111111111`)).json()).org.name, "ARTS ALLIANCE");
    assert.equal((await (await fetch(`${h.base}/990/orgs/222222222/filings`)).json()).count, 1);
    assert.equal((await fetch(`${h.base}/990/orgs/12/filings`)).status, 400);
  } finally { await h.close(); }
});

test("disabled (no DbPort factory) → health disabled + routes 503", async () => {
  const svc = createHeady990Service({ log: noLog, getDbPort: null });
  await svc.service.start();
  assert.equal((await svc.service.health()).mode, "disabled");
  const app = express(); svc.routes(app);
  const server = app.listen(0); await new Promise((r) => server.once("listening", r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/990/search?q=x`);
    assert.equal(res.status, 503);
  } finally { server.close(); await svc.service.stop(); }
});

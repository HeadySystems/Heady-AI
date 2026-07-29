// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — parse → normalize → validate → load tests      ║
// ║  Deterministic, no live DB (a fake DbPort records the SQL). Proves ║
// ║  the 990 ingestion end-to-end incl. provenance. © 2026 Heady      ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse990, normalize990, validateFiling, loadFiling } from "../src/index.mjs";
import { SAMPLE_990_XML } from "./fixtures/sample-990.mjs";

test("parse990 extracts the MeF fields + a content hash", () => {
  const p = parse990(SAMPLE_990_XML);
  assert.equal(p.ein, "123456789");
  assert.equal(p.name, "ACME COMMUNITY FOUNDATION");
  assert.equal(p.state, "CA");
  assert.equal(p.taxPeriodEnd, "2023-12-31");
  assert.equal(p.returnType, "990");
  assert.equal(p.totalRevenue, 2450000);
  assert.equal(p.totalExpenses, 2100000);
  assert.equal(p.netAssetsEoy, 4500000);
  assert.equal(p.votingMembers, 11);
  assert.equal(p.independentMembers, 9);
  assert.match(p.contentSha256, /^[a-f0-9]{64}$/);
});

test("content hash is deterministic + changes with the bytes (provenance integrity)", () => {
  assert.equal(parse990(SAMPLE_990_XML).contentSha256, parse990(SAMPLE_990_XML).contentSha256);
  assert.notEqual(parse990(SAMPLE_990_XML).contentSha256, parse990(SAMPLE_990_XML.replace("2450000", "2450001")).contentSha256);
});

test("parse990 rejects empty input; missing fields become null (forms differ)", () => {
  assert.throws(() => parse990(""));
  const p = parse990("<Return><ReturnHeader><Filer><EIN>999888777</EIN></Filer></ReturnHeader></Return>");
  assert.equal(p.ein, "999888777");
  assert.equal(p.totalRevenue, null);
  assert.equal(p.name, null);
});

test("normalize990 produces a valid, provenance-linked {org, filing}", () => {
  const r = normalize990(SAMPLE_990_XML, { sourceObjectId: "202412319349300000", sourceUrl: "https://apps.irs.gov/pub/epostcard/990/x.xml" });
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.org.ein, "123456789");
  assert.equal(r.filing.returnType, "990");
  assert.equal(r.filing.sourceObjectId, "202412319349300000");
  assert.match(r.filing.contentSha256, /^[a-f0-9]{64}$/);
});

test("normalize990 requires a provenance source (fail-closed)", () => {
  assert.throws(() => normalize990(SAMPLE_990_XML, {}));
});

test("validateFiling rejects a missing content hash — no fact without its source", () => {
  const { filing } = normalize990(SAMPLE_990_XML, { sourceObjectId: "obj1" });
  assert.equal(validateFiling({ ...filing, contentSha256: "nope" }).ok, false);
  assert.equal(validateFiling({ ...filing, returnType: "990-X" }).ok, false);
  assert.equal(validateFiling({ ...filing, ein: "12" }).ok, false);
});

test("loadFiling upserts org + filing in ONE transaction (fake DbPort)", async () => {
  const calls = [];
  const fakePort = {
    tx: async (fn) => fn({ query: async (sql, params) => { calls.push({ sql: sql.trim().split(/\s+/).slice(0, 4).join(" "), params }); return { rows: [{ id: "filing-uuid-1" }] }; } }),
  };
  const { org, filing } = normalize990(SAMPLE_990_XML, { sourceObjectId: "obj-42" });
  const res = await loadFiling(fakePort, { org, filing });
  assert.equal(res.ein, "123456789");
  assert.equal(res.filingId, "filing-uuid-1");
  assert.equal(calls.length, 2, "org upsert + filing upsert");
  assert.match(calls[0].sql, /INSERT INTO heady_990.organizations/);
  assert.match(calls[1].sql, /INSERT INTO heady_990.filings/);
  assert.equal(calls[1].params.includes("obj-42"), true, "provenance object id must be persisted");
});

test("loadFiling fails closed on an invalid record (no writes)", async () => {
  const fakePort = { tx: async () => { throw new Error("must not be called"); } };
  await assert.rejects(loadFiling(fakePort, { org: { ein: "bad" }, filing: {} }));
});

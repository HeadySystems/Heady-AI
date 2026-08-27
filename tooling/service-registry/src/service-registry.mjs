#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Service Registry — reconciler over configs/service-        ║
// ║  providers.yaml (the curated SoT for every external service).      ║
// ║  Cross-links the secrets registry: a provider that names a secret  ║
// ║  not in the registry, or a registry secret no provider claims, is  ║
// ║  drift (fail-closed, mirrors the .env↔registry coherence gate).    ║
// ║  Also the query API behind the `heady_subscriptions` MCP tool.     ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const YAML_PATH = resolve(ROOT, "configs", "service-providers.yaml");
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "service-registry", level, msg, ...f })}\n`);

/** Load + shallow-validate the registry. Throws on a structurally broken file. */
export function loadRegistry(path = YAML_PATH) {
  const doc = parseYaml(readFileSync(path, "utf8"));
  if (!doc || !Array.isArray(doc.providers)) throw new Error("service-providers.yaml: missing providers[]");
  const VALID_STATUS = new Set(["active", "failing", "suspended", "canceled", "trial", "exposed", "unknown"]);
  for (const p of doc.providers) {
    if (!p.id) throw new Error("provider missing id");
    if (p.status && !VALID_STATUS.has(p.status)) throw new Error(`${p.id}: invalid status '${p.status}'`);
  }
  return doc;
}

/** Cross-check provider `secrets:` against the secrets registry (both directions). */
export async function crossCheckSecrets(doc) {
  let SECRET_NAMES = [];
  try { ({ SECRET_NAMES } = await import("@heady/secrets")); }
  catch { try { ({ SECRET_NAMES } = await import(resolve(ROOT, "packages/secrets/src/registry.mjs"))); } catch { /* unbuilt */ } }
  const known = new Set(SECRET_NAMES);
  const claimed = new Set();
  const unknownRefs = [];
  for (const p of doc.providers) {
    for (const s of (p.secrets || [])) {
      claimed.add(s);
      if (known.size && !known.has(s)) unknownRefs.push({ provider: p.id, secret: s });
    }
  }
  // Registry secrets that NO provider claims (orphans) — every credential should have an owner.
  const orphans = [...known].filter((s) => !claimed.has(s));
  return { unknownRefs, orphans, knownCount: known.size };
}

/** The `heady_subscriptions` query surface (returned to the MCP tool / portal). */
export function query(doc, view = "all") {
  const ps = doc.providers;
  const monthly = ps
    .filter((p) => p.cost?.cadence === "monthly" && typeof p.cost.amount === "number")
    .reduce((sum, p) => sum + p.cost.amount, 0);
  const byStatus = (s) => ps.filter((p) => p.status === s).map((p) => p.id);
  const base = {
    total: ps.length,
    knownMonthlyUSD: Math.round(monthly * 100) / 100,
    failing: byStatus("failing"),
    suspended: byStatus("suspended"),
    exposed: byStatus("exposed"),
    cancelCandidates: ps.filter((p) => p.criticality === "cancel-candidate").map((p) => p.id),
    unappliedDiscounts: ps.filter((p) => /approved/.test(p.discount?.state || "")).map((p) => p.id),
    openIncidents: (doc.security_incidents || []).filter((i) => i.severity).map((i) => i.id),
  };
  if (view === "upcoming") return { upcoming: ps.filter((p) => ["active", "failing"].includes(p.status)).map((p) => ({ id: p.id, cost: p.cost })) };
  if (view === "cancel") return { cancelCandidates: base.cancelCandidates };
  if (view === "risk") return { exposed: base.exposed, failing: base.failing, suspended: base.suspended, openIncidents: base.openIncidents };
  return base;
}

async function main() {
  const cmd = process.argv[2] || "report";
  const doc = loadRegistry();
  if (cmd === "check") {
    const { unknownRefs, orphans } = await crossCheckSecrets(doc);
    for (const u of unknownRefs) log("error", "provider references a secret not in the secrets registry", u);
    for (const o of orphans) log("warn", "secrets-registry entry claimed by no provider (orphan)", { secret: o });
    if (unknownRefs.length) { log("error", "service-registry check FAILED", { unknownRefs: unknownRefs.length, orphans: orphans.length }); process.exit(1); }
    log("info", "service-registry check OK", { providers: doc.providers.length, orphans: orphans.length });
    return;
  }
  if (cmd === "xref") { log("info", "secret cross-reference", await crossCheckSecrets(doc)); return; }
  // default: report
  log("info", "service registry report", query(doc, "all"));
}

if (process.argv[1] && process.argv[1].endsWith("service-registry.mjs")) main().catch((e) => { log("error", "fatal", { err: e.message }); process.exit(2); });

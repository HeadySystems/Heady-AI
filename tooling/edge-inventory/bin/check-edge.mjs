#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge Inventory Gate CLI v1.0.0                           ║
// ║  Enumerates deployed Cloudflare Workers read-only and fails      ║
// ║  closed on any script this repository does not account for.      ║
// ║  Exit 0 = clean · 2 = undeclared/quarantined code is deployed.   ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { reconcile } from "../src/edge-inventory.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const INVENTORY_PATH = join(ROOT, "configs", "edge-inventory.json");
const API = "https://api.cloudflare.com/client/v4";

const json = process.argv.includes("--json");
const emit = (level, msg, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ t: "edge-inventory", level, msg, ...fields })}\n`);

async function listDeployedScripts({ accountId, token }) {
  const response = await fetch(`${API}/accounts/${accountId}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Cloudflare workers/scripts returned HTTP ${response.status}`);
  const body = await response.json();
  if (!body.success) throw new Error(`Cloudflare API error: ${JSON.stringify(body.errors)?.slice(0, 233)}`);
  return body.result;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    // Fail closed, but distinguish "cannot check" from "checked and clean" —
    // a missing credential must never read as a pass.
    emit("error", "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required — cannot verify the edge");
    return 2;
  }

  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8"));
  const deployed = await listDeployedScripts({ accountId, token });
  const result = reconcile({ deployed, inventory });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 2;
  }

  emit("info", "edge inventory reconciled", result.counts);
  for (const row of result.quarantined) {
    emit("error", "QUARANTINED script is still deployed", { script: row.script, modifiedOn: row.modifiedOn });
  }
  for (const row of result.undeclared) {
    emit("error", "UNDECLARED script — no inventory entry accounts for it", { script: row.script, modifiedOn: row.modifiedOn });
  }
  for (const row of result.missing) {
    emit("warn", "declared script is not deployed", { script: row.script, source: row.source });
  }
  for (const cluster of result.etagClusters) {
    emit("warn", "byte-identical bundle across many scripts", { etag: cluster.etag, count: cluster.count });
  }
  emit(result.ok ? "info" : "error", result.ok
    ? "edge inventory clean — every deployed script is accounted for"
    : "EDGE INVENTORY FAILED — code this repository does not vouch for is answering Heady domains");
  return result.ok ? 0 : 2;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  emit("error", "edge inventory check could not complete", { reason: String(error?.message ?? error) });
  process.exitCode = 2;
});

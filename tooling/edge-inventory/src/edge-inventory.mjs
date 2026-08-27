// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge Inventory Reconciliation v1.0.0                     ║
// ║  SEC-003 step 5. The domain canon (D1–D7) says which domains are ║
// ║  ours; this says whether the CODE answering them is ours.        ║
// ║  Pure functions — no network, no credentials. bin/check-edge.mjs ║
// ║  supplies the live data.                                         ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import { FIB } from "@heady/phi-math";

// An etag shared by this many scripts is reported as a cluster. Legitimate
// router families do share a bundle, so a cluster is a signal to explain, not a
// failure on its own — undeclared scripts are what fail. fib(6) = 8.
export const ETAG_CLUSTER_MIN = FIB[6];

export const DeployedScriptSchema = z.object({
  id: z.string().min(1),
  etag: z.string().min(1).nullish(),
  created_on: z.string().nullish(),
  modified_on: z.string().nullish(),
}).passthrough();

export const DeclaredScriptSchema = z.object({
  script: z.string().min(1),
  // Repository path that produces this script, or null for a script that is
  // deployed but whose provenance is still being established.
  source: z.string().min(1).nullable(),
  status: z.enum(["active", "quarantined", "unprovenanced"]),
  note: z.string().optional(),
}).strict();

export const InventorySchema = z.object({
  schema: z.literal("heady.edge.inventory.v1"),
  account: z.string().min(1),
  scripts: z.array(DeclaredScriptSchema),
}).strict();

/**
 * Reconcile what Cloudflare reports against what the repository declares.
 *
 * Fails closed on anything the repository does not account for. Silence is
 * never treated as approval: a script absent from the inventory is `undeclared`
 * and fails, which is the property SEC-003 §5 asks for.
 */
export function reconcile({ deployed, inventory }) {
  const declaredList = InventorySchema.parse(inventory).scripts;
  const deployedList = z.array(DeployedScriptSchema).parse(deployed);

  const declaredBy = new Map(declaredList.map((entry) => [entry.script, entry]));
  const deployedBy = new Map(deployedList.map((entry) => [entry.id, entry]));

  const undeclared = [];
  const quarantined = [];
  const unprovenanced = [];
  const active = [];

  for (const script of deployedList) {
    const declared = declaredBy.get(script.id);
    if (!declared) {
      undeclared.push({ script: script.id, modifiedOn: script.modified_on ?? null, etag: script.etag ?? null });
      continue;
    }
    const row = { script: script.id, source: declared.source, modifiedOn: script.modified_on ?? null, etag: script.etag ?? null };
    if (declared.status === "quarantined") quarantined.push({ ...row, note: declared.note });
    else if (declared.status === "unprovenanced") unprovenanced.push({ ...row, note: declared.note });
    else active.push(row);
  }

  // Declared but absent from the account — the inventory has gone stale, or a
  // script was removed outside the repository's knowledge. Reported, not fatal.
  const missing = declaredList
    .filter((entry) => entry.status !== "quarantined" && !deployedBy.has(entry.script))
    .map((entry) => ({ script: entry.script, source: entry.source }));

  return {
    counts: {
      deployed: deployedList.length,
      active: active.length,
      quarantined: quarantined.length,
      unprovenanced: unprovenanced.length,
      undeclared: undeclared.length,
      missing: missing.length,
    },
    active,
    quarantined,
    unprovenanced,
    undeclared,
    missing,
    etagClusters: etagClusters(deployedList),
    // Fail closed on the two states that mean "code we cannot account for is
    // answering our domains". `unprovenanced` is a declared, acknowledged
    // backlog and does not fail — it is visible in the counts instead.
    ok: undeclared.length === 0 && quarantined.length === 0,
  };
}

/** Scripts sharing one etag are byte-identical deployments of the same bundle. */
export function etagClusters(deployed, { min = ETAG_CLUSTER_MIN } = {}) {
  const byEtag = new Map();
  for (const script of deployed) {
    if (!script.etag) continue;
    if (!byEtag.has(script.etag)) byEtag.set(script.etag, []);
    byEtag.get(script.etag).push(script.id);
  }
  return [...byEtag.entries()]
    .filter(([, scripts]) => scripts.length >= min)
    .map(([etag, scripts]) => ({ etag, count: scripts.length, scripts: [...scripts].sort() }))
    .sort((left, right) => right.count - left.count);
}

/**
 * Reconcile zone routes: every route must point at a script the inventory
 * marks `active`. A route to a quarantined or undeclared script is live traffic
 * reaching code we do not vouch for, which is exactly the SEC-003 condition.
 */
export function reconcileRoutes({ routes, inventory }) {
  const declaredBy = new Map(InventorySchema.parse(inventory).scripts.map((e) => [e.script, e]));
  const offending = [];
  for (const route of routes) {
    const declared = route.script ? declaredBy.get(route.script) : undefined;
    const status = !route.script ? "no-script" : declared?.status ?? "undeclared";
    if (status !== "active") offending.push({ pattern: route.pattern, script: route.script ?? null, status, zone: route.zone ?? null });
  }
  return { checked: routes.length, offending, ok: offending.length === 0 };
}

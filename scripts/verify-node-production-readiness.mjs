// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Node Production Readiness Verifier v1.0.0               ║
// ║  Fails closed when orchestration, audit, image, or region        ║
// ║  prerequisites remain declarative or contradictory.             ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIB } from "../packages/phi-math/src/index.mjs";
import { HEADY_ATTRIBUTION_ROSTER, HEADY_NODE_ROSTER } from "../apps/heady-manager/src/nodes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const checks = [];

function record(name, pass, evidence) {
  checks.push({ name, pass, evidence });
}

const expectedRuntimeNodes = FIB[8];
const expectedAttributionRoles = FIB[8] - FIB[3];
record("runtime-node-roster", HEADY_NODE_ROSTER.length === expectedRuntimeNodes, `${HEADY_NODE_ROSTER.length}/${expectedRuntimeNodes} bounded runtime contexts`);
record("attribution-role-roster", HEADY_ATTRIBUTION_ROSTER.length === expectedAttributionRoles, `${HEADY_ATTRIBUTION_ROSTER.length}/${expectedAttributionRoles} roles actually enumerated by the integration skill`);
record(
  "attribution-runtime-mapping",
  HEADY_ATTRIBUTION_ROSTER.every(({ runtimeNode }) => HEADY_NODE_ROSTER.some(({ slug }) => slug === runtimeNode)),
  "every attribution role maps to a canonical runtime context",
);

const eventsPackage = json("packages/events/package.json");
record(
  "nats-transport-installed",
  Boolean(eventsPackage.dependencies?.["@nats-io/transport-node"]),
  eventsPackage.dependencies?.["@nats-io/transport-node"] ?? "missing official NATS Node transport",
);
const eventsSource = read("packages/events/src/index.mjs");
const managerEntrypoint = read("apps/heady-manager/src/index.mjs");
record("nats-transport-wired", eventsSource.includes("class NatsBus") && managerEntrypoint.includes("new NatsBus"), "manager production entrypoint must fail closed onto the NATS transport");

const managerSource = read("apps/heady-manager/src/app.mjs");
const nodesSource = read("apps/heady-manager/src/nodes.mjs");
for (const route of ["/api/nodes", "/api/orchestration/readiness", "/api/maintenance/health"]) {
  record(`route:${route}`, managerSource.includes(route), route);
}
record(
  "node-outbox-projector",
  nodesSource.includes("FOR UPDATE SKIP LOCKED") && nodesSource.includes("flush: true"),
  "Neon outbox delivery must retry through a locked, flushed NATS projection",
);

const migrationDirectory = join(root, "packages", "db", "migrations");
const migrationSql = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationDirectory, name), "utf8"))
  .join("\n");
const outboxHasDeleteGuard = /task_outbox[\s\S]{0,1200}(prevent|forbid|reject)[\s\S]{0,300}delete/i.test(migrationSql)
  || /BEFORE\s+(UPDATE\s+OR\s+DELETE|DELETE\s+OR\s+UPDATE|DELETE)[\s\S]{0,300}ON\s+(public\.)?task_outbox/i.test(migrationSql);
record("audit-delete-guard", outboxHasDeleteGuard, outboxHasDeleteGuard ? "task_outbox delete guard present" : "task_outbox has no append-only delete guard in checkout migrations");

const dockerfile = read("Dockerfile");
record("canonical-node-runtime", /FROM\s+node:22\b/.test(dockerfile), "Dockerfile must use Node 22");
record("canonical-manager-image", dockerfile.includes("apps/heady-manager") && dockerfile.includes("apps/heady-manager/src/index.mjs"), "Dockerfile must boot apps/heady-manager");

const terraform = `${read("infra/main.tf")}\n${read("infra/variables.tf")}`;
record("canonical-region", terraform.includes('default     = "us-east1"') && !terraform.includes('default     = "us-central1"'), "all Terraform region defaults must be us-east1 per ADR-0022");

const failed = checks.filter((check) => !check.pass);
const report = {
  implementationReady: failed.length === 0,
  productionReady: false,
  checkedAt: new Date().toISOString(),
  checks,
  blockers: failed.map(({ name, evidence }) => ({ name, evidence })),
  liveValidationRequired: [
    "apply and verify pending Neon migrations through the governed migration workflow",
    "provision NATS_SERVERS and authentication through GCP Secret Manager",
    "observe at least one fresh READY runtime-node heartbeat",
    "run an authenticated canary against the deployed us-east1 revision",
  ],
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;

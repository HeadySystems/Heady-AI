// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Console shapes tests — node:test, zero deps           ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CONNECTOR_STATES, validateConnector, validateConnectorRegistry,
  validateServerManifest, buildConsoleSummary,
} from "../src/mcp-shapes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const okConnector = () => ({
  id: "headymcp", name: "HeadyMCP", kind: "heady", role: "mcp-endpoint",
  deploy_class: true, expected: "real", probe: { kind: "https", url: "https://headymcp.com/healthz" },
});

test("§8 state model carries the first-class states", () => {
  for (const s of ["token_expired", "projection_only", "not_connected", "healthy", "degraded", "unreachable"]) {
    assert.ok(CONNECTOR_STATES.includes(s), s);
  }
});

test("validateConnector: valid https/kernel/null probes pass; strict rejects unknowns", () => {
  assert.equal(validateConnector(okConnector()).ok, true);
  assert.equal(validateConnector({ ...okConnector(), probe: { kind: "kernel", service: "tasks" } }).ok, true);
  assert.equal(validateConnector({ ...okConnector(), probe: null }).ok, true);
  assert.match(validateConnector({ ...okConnector(), extra: 1 }).errors.join(" "), /unknown field "extra"/);
  assert.match(validateConnector({ ...okConnector(), probe: { kind: "https", url: "http://insecure" } }).errors.join(" "), /https:\/\//);
  assert.match(validateConnector({ ...okConnector(), deploy_class: "yes" }).errors.join(" "), /deploy_class/);
  assert.match(validateConnector({ ...okConnector(), expected: "maybe" }).errors.join(" "), /real\|projection/);
});

test("vault probes: secrets[] + mandatory measured ping, exactly one url source", () => {
  const vault = (probe) => validateConnector({ ...okConnector(), probe: { kind: "vault", ...probe } });
  assert.equal(vault({ secrets: ["A_TOKEN"], ping: { url: "https://api.example.headysystems.com/v", authSecret: "A_TOKEN" } }).ok, true);
  assert.equal(vault({ secrets: ["A_URL", "A_TOKEN"], ping: { urlSecret: "A_URL", path: "/ping", authSecret: "A_TOKEN" } }).ok, true);
  assert.match(vault({ secrets: [], ping: { url: "https://x.example.headysystems.com/", authSecret: "A" } }).errors.join(" "), /secrets\[\]/);
  assert.match(vault({ secrets: ["A_TOKEN"] }).errors.join(" "), /requires a ping/); // existence proves nothing
  assert.match(vault({ secrets: ["A_TOKEN"], ping: { authSecret: "A_TOKEN" } }).errors.join(" "), /exactly one of url/);
  assert.match(vault({ secrets: ["A_TOKEN"], ping: { url: "https://x.example.headysystems.com/", urlSecret: "A_URL", authSecret: "A_TOKEN" } }).errors.join(" "), /exactly one of url/);
  assert.match(vault({ secrets: ["A_TOKEN"], ping: { url: "https://x.example.headysystems.com/" } }).errors.join(" "), /authSecret/);
});

test("validateConnectorRegistry: duplicate ids fail closed", () => {
  const reg = { schema: "connectors.v1", connectors: [okConnector(), okConnector()] };
  assert.match(validateConnectorRegistry(reg).errors.join(" "), /duplicate connector id/);
});

test("the REAL configs/connectors.json conforms (15 connectors, no dropped stores)", () => {
  const reg = JSON.parse(readFileSync(join(HERE, "..", "..", "..", "configs", "connectors.json"), "utf8"));
  const v = validateConnectorRegistry(reg);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(reg.connectors.length, 15);
  assert.equal(reg.connectors.filter((c) => c.kind === "heady").length, 10);
  assert.equal(reg.connectors.filter((c) => c.kind === "infra").length, 5);
});

test("validateServerManifest: the anti-masquerade contract", () => {
  const ok = { schema: "server-manifest.v1", name: "headyos-core", projection_only: true, provenance: { source_repo: "HeadySystems/Heady-AI" } };
  assert.equal(validateServerManifest(ok).ok, true);
  assert.match(validateServerManifest({ ...ok, projection_only: "yes" }).errors.join(" "), /projection_only/);
  assert.match(validateServerManifest({ ...ok, provenance: {} }).errors.join(" "), /source_repo/);
  assert.match(validateServerManifest({ ...ok, sneaky: 1 }).errors.join(" "), /unknown field/);
});

test("buildConsoleSummary counts states and rejects invalid ones", () => {
  const s = buildConsoleSummary({
    heartbeatMs: 29034, generatedAt: "2026-07-23T00:00:00Z",
    connectors: [
      { id: "a", state: "healthy" }, { id: "b", state: "not_connected" }, { id: "c", state: "unreachable" },
    ],
  });
  assert.equal(s.schema, "console-summary.v1");
  assert.equal(s.counts.healthy, 1);
  assert.equal(s.counts.unreachable, 1);
  assert.equal(s.global, "attention"); // unreachable demands attention
  assert.throws(() => buildConsoleSummary({ heartbeatMs: 1, generatedAt: "x", connectors: [{ id: "z", state: "sparkly" }] }), RangeError);
});

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Intelligence Gateway Tests v1.0.0                   ║
// ║  Proves private handlers, one pipeline, audit, and redaction.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryMcpAuditStore, createMcpIntelligenceGateway } from "../src/index.mjs";

const CALL_ID = "4ffbb932-a108-46c8-b9c1-5012ac72af38";
const AUTH = Object.freeze({
  token: "test-only-token-value",
  clientId: "test-client",
  scopes: ["heady:mcp:read", "heady:mcp:write"],
  extra: { tenantId: "tenant-test" },
});

function fixture({ health } = {}) {
  const audit = new InMemoryMcpAuditStore({ now: () => "2026-08-21T00:00:00.000Z" });
  const prepared = [];
  const published = [];
  const runtime = {
    controlPlaneAvailability: () => true,
    semanticAvailability: () => false,
    auditAvailability: () => true,
    taskAvailability: () => false,
    heady990Availability: () => false,
    health: health ?? (() => ({
      status: "ok",
      sourceAuthority: "git",
      services: { intelligence: "ok" },
      timestamp: "2026-08-21T00:00:00.000Z",
    })),
    services: async () => ({ services: [] }),
    toolStatus: () => gateway.status(),
    async history({ tenantId, limit }) {
      return { events: await audit.history({ tenantId, limit }), chainValid: await audit.verify({ tenantId }) };
    },
    memorySearch: async () => ({ results: [], count: 0, model: "locked", dimension: 384 }),
    memoryStore: async () => ({ stored: true, replayed: false, id: CALL_ID, model: "locked", dimension: 384 }),
    taskEnqueue: async () => ({ taskId: CALL_ID, status: "PENDING" }),
    taskStatus: async () => ({ taskId: CALL_ID, status: "PENDING" }),
    heady990Search: async () => ({ query: { q: "test", limit: 21, state: null, minRevenue: null }, mode: "keyword-only", count: 0, results: [] }),
    heady990GetOrg: async () => ({ org: {} }),
    heady990GetFilings: async () => ({ ein: "111111111", count: 0, filings: [] }),
  };
  let gateway;
  gateway = createMcpIntelligenceGateway({
    runtime,
    intelligence: {
      async prepare(value) {
        prepared.push(value);
        return {
          authority: "git",
          sourceRevision: null,
          confidence: 1,
          relevance: 1,
          capsule: { items: [] },
        };
      },
    },
    audit,
    publish: async (subject, payload) => published.push({ subject, payload }),
    id: () => CALL_ID,
  });
  return { gateway, audit, prepared, published };
}

test("advertises schemas without exposing direct tool handlers", () => {
  const { gateway } = fixture();
  const advertised = gateway.advertised();
  assert.ok(advertised.some((tool) => tool.name === "heady_health"));
  assert.ok(advertised.some((tool) => tool.name === "heady_deep_scan"));
  assert.ok(!advertised.some((tool) => tool.name === "heady_memory_search"));
  assert.ok(advertised.every((tool) => !("handler" in tool)));
});

test("every successful invocation crosses context, redaction, audit, and event projection", async () => {
  const { gateway, audit, prepared, published } = fixture({
    health: async () => ({
      status: "ok",
      sourceAuthority: "git",
      services: { apiToken: "plain-sensitive-value" },
      timestamp: "2026-08-21T00:00:00.000Z",
    }),
  });
  const progress = [];
  const result = await gateway.invoke("heady_health", {}, {
    authInfo: AUTH,
    traceId: "trace-test",
    progress: async (event) => progress.push(event.stage),
  });

  assert.equal(result.output.services.apiToken, "[REDACTED]");
  assert.equal(prepared.length, 1);
  assert.deepEqual(audit.records.map((record) => record.phase), ["STARTED", "SUCCEEDED"]);
  assert.equal(published[0].subject, "heady.action.mcp.completed");
  assert.deepEqual(progress, ["accepted", "authorized", "contextualized", "routed", "executed", "redacted", "audited", "completed"]);
  assert.equal(result.receipt.callId, CALL_ID);
  assert.match(result.receipt.recordSha256, /^[a-f0-9]{64}$/);
  assert.equal(await audit.verify({ tenantId: AUTH.extra.tenantId }), true);
});

test("audit verification detects record tampering", async () => {
  const { gateway, audit } = fixture();
  await gateway.invoke("heady_health", {}, { authInfo: AUTH });
  audit.records[0] = { ...audit.records[0], toolName: "tampered" };
  assert.equal(await audit.verify({ tenantId: AUTH.extra.tenantId }), false);
});

test("invalid input and missing scopes both receive failure receipts", async () => {
  const invalid = fixture();
  await assert.rejects(
    invalid.gateway.invoke("heady_project_tree", { files: [] }, { authInfo: AUTH }),
  );
  assert.deepEqual(invalid.audit.records.map((record) => record.phase), ["STARTED", "FAILED"]);

  const denied = fixture();
  await assert.rejects(
    denied.gateway.invoke("heady_health", {}, { authInfo: { ...AUTH, scopes: [] } }),
    /missing MCP scopes/,
  );
  assert.deepEqual(denied.audit.records.map((record) => record.phase), ["STARTED", "FAILED"]);
});

test("the status surface names deferred capabilities without advertising them", async () => {
  const { gateway } = fixture();
  const status = await gateway.invoke("heady_tool_status", {}, { authInfo: AUTH });
  const deferredNames = status.output.deferred.map((item) => item.name);
  assert.ok(deferredNames.includes("heady_auto_flow"));
  assert.ok(deferredNames.includes("heady_call_start"));
  assert.ok(!gateway.advertised().some((tool) => deferredNames.includes(tool.name)));
});

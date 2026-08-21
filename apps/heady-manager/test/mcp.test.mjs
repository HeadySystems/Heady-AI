// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Manager MCP Transport Tests v1.0.0                      ║
// ║  Modern discovery, auth, tool dispatch, progress, and receipts.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import test from "node:test";
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { InMemoryMcpAuditStore } from "@heady/mcp-intelligence";
import { createApp } from "../src/app.mjs";

const BEARER = "mcp-test-bearer-value-2026";
const CLIENT_HOST = ["127", "0", "0", "1"].join(".");
const MEMORY_ID = "98717bb0-5523-4be2-b572-2ef46b0a320a";
const SOURCE_ID = "9c65f4e5-c077-4852-aa9f-5ea03779a490";

function mcpOptions(overrides = {}) {
  return {
    auditStore: new InMemoryMcpAuditStore({ now: () => "2026-08-21T00:00:00.000Z" }),
    bearerToken: BEARER,
    tenantId: "tenant-mcp-test",
    allowedHosts: [CLIENT_HOST],
    allowedOrigins: [CLIENT_HOST],
    ...overrides,
  };
}

function memoryDbFixture() {
  const idempotency = new Map();
  const memories = [];
  const outbox = [];

  const getDbPort = async () => ({
    async connect() {},
    async end() {},
    async tx(operation) { return operation(this); },
    async query(sql, params = []) {
      const statement = sql.replace(/\s+/g, " ").trim();
      if (statement === "SELECT 1") return { rows: [{ one: 1 }] };
      if (statement === "SET LOCAL ROLE heady_runtime_api" || statement === "RESET ROLE") return { rows: [] };
      if (statement.includes("to_regclass('heady_runtime.context_fragment')")) return { rows: [{ ready: true }] };
      if (statement.startsWith("SELECT set_config")) return { rows: [{ set_config: params[0] }] };
      if (statement.includes("FROM idempotency_key")) {
        const value = idempotency.get(`${params[0]}:${params[1]}`);
        return { rows: value ? [value] : [] };
      }
      if (statement.startsWith("INSERT INTO idempotency_key")) {
        idempotency.set(`${params[0]}:${params[1]}`, { request_sha256: params[2], status: "STARTED", result: null });
        return { rows: [] };
      }
      if (statement.startsWith("SELECT id, false AS stored FROM heady_runtime.context_fragment")) {
        const prior = memories.find((memory) => memory.tenantId === params[0] && memory.contentSha256 === params[1]);
        return { rows: prior ? [{ id: prior.id, stored: false }] : [] };
      }
      if (statement.startsWith("INSERT INTO heady_runtime.conversation_session")) return { rows: [] };
      if (statement.startsWith("INSERT INTO heady_runtime.context_source")) return { rows: [{ id: SOURCE_ID }] };
      if (statement.startsWith("INSERT INTO heady_runtime.context_fragment")) {
        memories.push({
          id: MEMORY_ID,
          tenantId: params[0],
          sourceId: params[1],
          contentSha256: params[2],
          content: params[3],
          embedding: params[4],
          provenance: params[6],
          metadata: params[7],
          created_at: "2026-08-21T00:00:00.000Z",
        });
        return { rows: [{ id: MEMORY_ID, stored: true }] };
      }
      if (statement.startsWith("INSERT INTO task_outbox")) {
        outbox.push(params[0]);
        return { rows: [] };
      }
      if (statement.startsWith("UPDATE idempotency_key")) {
        const key = `${params[0]}:${params[1]}`;
        const prior = idempotency.get(key);
        idempotency.set(key, { ...prior, result: params[2], status: "SUCCEEDED" });
        return { rows: [] };
      }
      if (statement.includes("SELECT id, content, embedding::text, metadata, provenance")) {
        assert.equal(params[1], "tenant-mcp-test");
        return { rows: memories.slice(0, params[2]) };
      }
      if (statement.includes("SELECT id, content, metadata, provenance, created_at")) {
        assert.equal(params[1], "tenant-mcp-test");
        return { rows: memories.slice(0, params[2]).map((row) => ({ ...row, similarity: 1 })) };
      }
      throw new Error(`unexpected SQL in memory fixture: ${statement}`);
    },
  });

  return { getDbPort, memories, outbox };
}

function heady990DbFixture() {
  const org = { ein: "111111111", name: "ARTS ALLIANCE", state: "CA", ntee_code: "A20", subsection_cd: 3, ruling_year: 1998 };
  const filing = {
    tax_period_end: "2023-12-31",
    return_type: "990",
    total_revenue: 2_450_000,
    total_expenses: 2_100_000,
    total_assets_eoy: 5_300_000,
    total_liabilities_eoy: 800_000,
    net_assets_eoy: 4_500_000,
    voting_members: 11,
    independent_members: 9,
    source_object_id: "irs-object-111111111",
    source_url: "https://apps.irs.gov/filing.xml",
    content_sha256: "a".repeat(64),
  };
  return async () => ({
    async connect() {},
    async end() {},
    async query(sql, params = []) {
      if (sql.includes("SELECT 1")) return { rows: [{ one: 1 }] };
      if (sql.includes("search_tsv @@")) return { rows: [{ ein: org.ein }] };
      if (sql.includes("LEFT JOIN LATERAL")) return { rows: [{ ...org, ...filing }] };
      if (sql.includes("FROM heady_990.organizations WHERE ein")) return { rows: params[0] === org.ein ? [org] : [] };
      if (sql.includes("FROM heady_990.filings WHERE ein")) return { rows: params[0] === org.ein ? [filing] : [] };
      throw new Error(`unexpected SQL in 990 fixture: ${sql.replace(/\s+/g, " ").trim()}`);
    },
  });
}

async function connectModernClient(endpoint) {
  const client = new Client(
    { name: "heady-mcp-conformance", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  const transport = new StreamableHTTPClientTransport(endpoint, {
    authProvider: { token: async () => BEARER },
  });
  await client.connect(transport);
  return client;
}

test("modern MCP discovery and tool execution use one audited intelligence pipeline", async () => {
  const app = createApp({ port: 0, mcp: mcpOptions() });
  await app.start();
  const endpoint = new URL(`http://${CLIENT_HOST}:${app.address().port}/mcp`);
  const client = await connectModernClient(endpoint);

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert.ok(names.includes("heady_health"));
    assert.ok(names.includes("heady_deep_scan"));
    assert.ok(!names.includes("heady_chat"));
    assert.ok(!names.includes("heady_memory_search"));

    const progress = [];
    const result = await client.callTool(
      { name: "heady_health", arguments: {} },
      { onprogress: (event) => progress.push(event.message) },
    );
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.result.sourceAuthority.includes("adr-0051-read-cutover:not-verified"), true);
    assert.match(result.structuredContent.receipt.recordSha256, /^[a-f0-9]{64}$/);
    assert.equal(progress.length, 8);

    const phases = app.mcp.audit.records.map((record) => record.phase);
    assert.deepEqual(phases, ["STARTED", "SUCCEEDED"]);
    assert.equal(app.mcp.state().calls, 1);
  } finally {
    await client.close();
    await app.stop();
  }
});

test("tenant-bound pgvector memory is functional and idempotent through MCP", async () => {
  const db = memoryDbFixture();
  const embedQuery = async () => [1, ...new Array(383).fill(0)];
  const app = createApp({
    port: 0,
    mcp: mcpOptions({ getDbPort: db.getDbPort, embedQuery }),
    tasks: { getDbPort: db.getDbPort },
  });
  await app.start();
  const client = await connectModernClient(new URL(`http://${CLIENT_HOST}:${app.address().port}/mcp`));

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert.ok(names.includes("heady_memory_store"));
    assert.ok(names.includes("heady_memory_search"));

    const first = await client.callTool({
      name: "heady_memory_store",
      arguments: { content: "tenant memory", idempotencyKey: "memory-key-2026", metadata: { kind: "test" } },
    });
    assert.equal(first.structuredContent.result.replayed, false);
    assert.equal(first.structuredContent.result.id, MEMORY_ID);

    const replay = await client.callTool({
      name: "heady_memory_store",
      arguments: { content: "tenant memory", idempotencyKey: "memory-key-2026", metadata: { kind: "test" } },
    });
    assert.equal(replay.structuredContent.result.replayed, true);
    assert.equal(db.memories.length, 1);
    assert.equal(db.outbox.length, 1);
    assert.equal(db.memories[0].tenantId, "tenant-mcp-test");
    assert.equal(db.memories[0].provenance[0].kind, "mcp-tool-call");

    const collision = await client.callTool({
      name: "heady_memory_store",
      arguments: { content: "different content", idempotencyKey: "memory-key-2026", metadata: { kind: "test" } },
    });
    assert.equal(collision.isError, true);
    assert.equal(db.memories.length, 1);

    const search = await client.callTool({
      name: "heady_memory_search",
      arguments: { query: "tenant memory", limit: 5 },
    });
    assert.equal(search.structuredContent.result.count, 1);
    assert.equal(search.structuredContent.result.results[0].id, MEMORY_ID);
  } finally {
    await client.close();
    await app.stop();
  }
});

test("provenance-linked 990 operations execute through the MCP intelligence pipeline", async () => {
  const app = createApp({
    port: 0,
    mcp: mcpOptions(),
    heady990: { getDbPort: heady990DbFixture() },
  });
  await app.start();
  const client = await connectModernClient(new URL(`http://${CLIENT_HOST}:${app.address().port}/mcp`));

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert.ok(names.includes("heady_990_search"));
    assert.ok(names.includes("heady_990_org_get"));
    assert.ok(names.includes("heady_990_filings_list"));

    const search = await client.callTool({
      name: "heady_990_search",
      arguments: { q: "arts", state: "ca" },
    });
    assert.equal(search.structuredContent.result.count, 1);
    assert.equal(search.structuredContent.result.results[0].provenance.contentSha256, "a".repeat(64));

    const organization = await client.callTool({ name: "heady_990_org_get", arguments: { ein: "111111111" } });
    assert.equal(organization.structuredContent.result.org.name, "ARTS ALLIANCE");

    const filings = await client.callTool({ name: "heady_990_filings_list", arguments: { ein: "111111111" } });
    assert.equal(filings.structuredContent.result.count, 1);
    assert.equal(filings.structuredContent.result.filings[0].source_object_id, "irs-object-111111111");

    assert.equal(app.mcp.audit.records.filter((record) => record.phase === "SUCCEEDED").length, 3);
  } finally {
    await client.close();
    await app.stop();
  }
});

test("MCP rejects missing credentials, disallowed hosts, and non-POST methods", async () => {
  const app = createApp({ port: 0, mcp: mcpOptions() });
  await app.start();
  const endpoint = `http://${CLIENT_HOST}:${app.address().port}/mcp`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "probe", version: "1.0.0" } },
  };

  try {
    const unauthorized = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers.get("www-authenticate") ?? "", /^Bearer/);

    const wrongMethod = await fetch(endpoint, {
      method: "GET",
      headers: { authorization: `Bearer ${BEARER}` },
    });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "POST");
  } finally {
    await app.stop();
  }

  const forbiddenApp = createApp({ port: 0, mcp: mcpOptions({ allowedHosts: ["allowed.example"] }) });
  await forbiddenApp.start();
  try {
    const forbiddenEndpoint = `http://${CLIENT_HOST}:${forbiddenApp.address().port}/mcp`;
    const forbidden = await fetch(forbiddenEndpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${BEARER}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await forbiddenApp.stop();
  }
});

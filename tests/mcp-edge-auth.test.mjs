// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Edge Authentication Tests v1.0.0                     ║
// ║  Verifies protected route classification and bearer validation.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isProtectedMcpPath,
  isValidMcpAuthorization,
} from "../cloudflare/worker-heady-router/src/mcp-auth.mjs";

const TEST_TOKEN = "test-only-edge-bearer-with-sufficient-entropy";

test("the edge protects every remote MCP and vector transport path", () => {
  for (const pathname of ["/sse", "/mcp", "/mcp/rpc", "/mcp/tools", "/vector/search"]) {
    assert.equal(isProtectedMcpPath(pathname), true, pathname);
  }
  for (const pathname of ["/", "/health", "/api/health"]) {
    assert.equal(isProtectedMcpPath(pathname), false, pathname);
  }
});

test("the edge rejects missing and incorrect credentials", async () => {
  assert.equal(await isValidMcpAuthorization(undefined, TEST_TOKEN), false);
  assert.equal(await isValidMcpAuthorization(`Bearer ${TEST_TOKEN}`, ""), false);
  assert.equal(await isValidMcpAuthorization("Bearer incorrect", TEST_TOKEN), false);
});

test("the edge accepts the exact configured bearer", async () => {
  assert.equal(await isValidMcpAuthorization(`Bearer ${TEST_TOKEN}`, TEST_TOKEN), true);
});

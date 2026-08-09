// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Authentication Tests v1.0.0                          ║
// ║  Verifies fail-closed remote MCP bearer decisions.               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getMcpAuthorizationDecision,
  isValidMcpAuthorization,
} from "../src/mcp/mcp-auth.mjs";

const TEST_TOKEN = "test-only-mcp-bearer-with-sufficient-entropy";

test("MCP authentication fails closed when the server secret is absent", () => {
  assert.deepEqual(getMcpAuthorizationDecision(undefined, ""), {
    allowed: false,
    status: 503,
    error: "mcp_auth_not_configured",
  });
});

test("MCP authentication rejects absent, malformed, and incorrect credentials", () => {
  assert.equal(isValidMcpAuthorization(undefined, TEST_TOKEN), false);
  assert.equal(isValidMcpAuthorization(`Basic ${TEST_TOKEN}`, TEST_TOKEN), false);
  assert.equal(isValidMcpAuthorization("Bearer incorrect", TEST_TOKEN), false);
  assert.equal(getMcpAuthorizationDecision("Bearer incorrect", TEST_TOKEN).status, 401);
});

test("MCP authentication accepts only the exact configured bearer", () => {
  assert.equal(isValidMcpAuthorization(`Bearer ${TEST_TOKEN}`, TEST_TOKEN), true);
  assert.deepEqual(getMcpAuthorizationDecision(`Bearer ${TEST_TOKEN}`, TEST_TOKEN), {
    allowed: true,
    status: 200,
    error: null,
  });
});

// ╔════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Stdio Proxy Tests v1.0.0                        ║
// ║  Verifies secret-safe helper validation and startup guards    ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveAuthHeaders, startProxy } from "./heady-mcp-stdio-proxy.mjs";

const TEST_ROOT_PREFIX = join(tmpdir(), "heady-mcp-proxy-test-");
const EXECUTABLE_MODE = 0o700;

async function createHelper(body) {
  const root = await mkdtemp(TEST_ROOT_PREFIX);
  const helperPath = join(root, "helper.sh");
  await writeFile(helperPath, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  await chmod(helperPath, EXECUTABLE_MODE);
  return { helperPath, root };
}

test("accepts a valid Bearer header without persisting it", async () => {
  const fixture = await createHelper(`printf '%s\\n' '{"Authorization":"Bearer fixture-token"}'`);

  try {
    assert.deepEqual(resolveAuthHeaders(fixture.helperPath), {
      Authorization: "Bearer fixture-token",
    });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects invalid helper JSON", async () => {
  const fixture = await createHelper("printf '%s\\n' 'not-json'");

  try {
    assert.throws(() => resolveAuthHeaders(fixture.helperPath), /returned invalid JSON/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects helper output without Bearer authorization", async () => {
  const fixture = await createHelper(`printf '%s\\n' '{"X-Heady-Trace-Id":"fixture"}'`);

  try {
    assert.throws(() => resolveAuthHeaders(fixture.helperPath), /did not return a Bearer/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("preserves actionable helper failures", async () => {
  const fixture = await createHelper("printf '%s\\n' 'refresh ADC' >&2\nexit 1");

  try {
    assert.throws(() => resolveAuthHeaders(fixture.helperPath), /refresh ADC/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects incomplete startup arguments before resolving credentials", async () => {
  await assert.rejects(() => startProxy(), /usage: node heady-mcp-stdio-proxy/);
});

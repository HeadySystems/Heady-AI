// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Client Configuration Tests v1.0.0                    ║
// ║  Prevents endpoint drift and plaintext MCP credentials.          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const CANONICAL_MCP_URL = "https://heady-mcp-server-n5s7hbzdga-ue.a.run.app/mcp/v1";
const CONFIG_PATHS = Object.freeze([".mcp.json", ".vscode/mcp.json", "mcp.json"]);

test("all tracked MCP clients use the canonical authenticated endpoint", async () => {
  for (const path of CONFIG_PATHS) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const config = JSON.parse(source);
    const servers = config.mcpServers || config.servers;
    const server = servers.heady || servers.Heady;

    assert.equal(server.type, "http", path);
    assert.equal(server.url, CANONICAL_MCP_URL, path);
    assert.match(server.headers.Authorization, /^Bearer \$\{(?:env:)?HEADY_MCP_BEARER\}$/, path);
    assert.doesNotMatch(source, /Bearer\s+hdy_[A-Za-z0-9_-]+/, path);
  }
});

// ╔════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Stdio Proxy v1.0.0                              ║
// ║  Bridges Codex stdio to authenticated Streamable HTTP          ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚═════════════════════════════════════════════════════════════════╝

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function resolveAuthHeaders(helperPath) {
  const helper = spawnSync(helperPath, { encoding: "utf8" });
  if (helper.status !== 0) {
    throw new Error((helper.stderr || "Heady MCP header helper failed").trim());
  }

  let headers;
  try {
    headers = JSON.parse(helper.stdout);
  } catch {
    throw new Error("Heady MCP header helper returned invalid JSON");
  }

  if (
    typeof headers !== "object"
    || headers === null
    || Array.isArray(headers)
    || typeof headers.Authorization !== "string"
    || !headers.Authorization.startsWith("Bearer ")
  ) {
    throw new Error("Heady MCP header helper did not return a Bearer Authorization header");
  }

  return headers;
}

export async function startProxy(endpoint, helperPath) {
  if (!endpoint || !helperPath) {
    throw new Error("usage: node heady-mcp-stdio-proxy.mjs <endpoint> <header-helper>");
  }

  const upstream = new Client({ name: "heady-codex-stdio-proxy", version: "1.0.0" });
  const upstreamTransport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: resolveAuthHeaders(helperPath) },
  });
  await upstream.connect(upstreamTransport);

  const upstreamCapabilities = upstream.getServerCapabilities() ?? {};
  const proxyCapabilities = {};

  if (upstreamCapabilities.tools) {
    proxyCapabilities.tools = { listChanged: false };
  }
  if (upstreamCapabilities.resources) {
    proxyCapabilities.resources = { listChanged: false, subscribe: false };
  }
  if (upstreamCapabilities.prompts) {
    proxyCapabilities.prompts = { listChanged: false };
  }

  const downstream = new Server(
    { name: "heady-mcp-stdio-proxy", version: "1.0.0" },
    { capabilities: proxyCapabilities },
  );

  if (upstreamCapabilities.tools) {
    downstream.setRequestHandler(ListToolsRequestSchema, (request) => upstream.listTools(request.params));
    downstream.setRequestHandler(CallToolRequestSchema, (request) => upstream.callTool(request.params));
  }

  if (upstreamCapabilities.resources) {
    downstream.setRequestHandler(ListResourcesRequestSchema, (request) => upstream.listResources(request.params));
    downstream.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      (request) => upstream.listResourceTemplates(request.params),
    );
    downstream.setRequestHandler(ReadResourceRequestSchema, (request) => upstream.readResource(request.params));
  }

  if (upstreamCapabilities.prompts) {
    downstream.setRequestHandler(ListPromptsRequestSchema, (request) => upstream.listPrompts(request.params));
    downstream.setRequestHandler(GetPromptRequestSchema, (request) => upstream.getPrompt(request.params));
  }

  const downstreamTransport = new StdioServerTransport();
  const close = async () => {
    const results = await Promise.allSettled([downstream.close(), upstream.close()]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") {
      throw failure.reason;
    }
  };

  const handleSignal = () => {
    close().then(
      () => process.exit(0),
      (error) => {
        process.stderr.write(`Heady MCP proxy shutdown failed: ${errorMessage(error)}\n`);
        process.exit(1);
      },
    );
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  await downstream.connect(downstreamTransport);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await startProxy(...process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Heady MCP proxy startup failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

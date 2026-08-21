// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Intelligence v1.0.0                                 ║
// ║  Public factories for the canonical intelligence-routed MCP.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

export { InMemoryMcpAuditStore, createNeonMcpAuditStore } from "./audit.mjs";

import { createToolRegistry } from "./registry.mjs";
import { createMcpIntelligencePipeline } from "./pipeline.mjs";
import { createCoreToolDefinitions, DEFERRED_CAPABILITIES } from "./tools.mjs";

/**
 * Build the only supported ingress to canonical MCP handlers. Tool handlers
 * remain package-private; callers receive schemas plus a single invoke seam.
 */
export function createMcpIntelligenceGateway({ runtime, intelligence, audit, publish, log, id } = {}) {
  const registry = createToolRegistry(createCoreToolDefinitions(runtime), { deferred: DEFERRED_CAPABILITIES });
  const pipeline = createMcpIntelligencePipeline({ registry, intelligence, audit, publish, log, id });

  return Object.freeze({
    advertised: () => pipeline.advertised().map(({ handler: _handler, available: _available, ...definition }) => definition),
    status: () => pipeline.status(),
    invoke: (toolName, input, options) => pipeline.invoke(toolName, input, options),
  });
}

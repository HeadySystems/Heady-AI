// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Contracts v1.0.0 — OpenAPI surface + mcp-tools generator  ║
// ║  OpenAPI 3.1 is the single source of truth; types/Zod/mcp-tools    ║
// ║  derive from it (ADR-0001). © 2026 HeadySystems Inc.               ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free. `openapi/heady.openapi.json` is authored by hand and is the
// contract surface. Type/Zod generation is a build step (Kubb / @hey-api/openapi-ts
// once deps install); the `mcp-tools.json` generation below is pure JS and runs now.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, "..", "openapi", "heady.openapi.json");

/** Load and return the canonical OpenAPI document. */
export function loadSpec(specPath = SPEC_PATH) {
  return JSON.parse(readFileSync(specPath, "utf8"));
}

/** Resolve a local `#/components/schemas/X` $ref against the spec. */
function resolveRef(spec, ref) {
  if (!ref?.startsWith("#/")) return null;
  return ref
    .slice(2)
    .split("/")
    .reduce((acc, key) => (acc ? acc[key] : undefined), spec);
}

/**
 * Generate MCP tool definitions from the OpenAPI document — one tool per
 * operation. Each tool: { name (operationId), description, inputSchema (JSON
 * Schema), method, path }. This is the `OpenAPI → mcp-tools.json` step.
 */
export function generateMcpTools(spec = loadSpec()) {
  const tools = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!op?.operationId) continue;
      const properties = {};
      const required = [];

      for (const p of op.parameters ?? []) {
        properties[p.name] = p.schema ?? { type: "string" };
        if (p.required) required.push(p.name);
      }
      const bodySchemaRef = op.requestBody?.content?.["application/json"]?.schema;
      if (bodySchemaRef) {
        const resolved = bodySchemaRef.$ref ? resolveRef(spec, bodySchemaRef.$ref) : bodySchemaRef;
        if (resolved?.properties) {
          Object.assign(properties, resolved.properties);
          required.push(...(resolved.required ?? []));
        }
      }
      tools.push({
        name: op.operationId,
        description: op.summary ?? `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        inputSchema: { type: "object", properties, required: [...new Set(required)] },
      });
    }
  }
  return tools;
}

/** Convenience: the spec object, eagerly loaded. */
export const spec = loadSpec();

// ── facts.v1 — the golden-record schema (the law about what a fact is) ──
export { FACTS_V1, FACTS_V1_VERSION, validateFactsV1 } from "./facts-schema.mjs";

// ── MCP Console shared contract (§8): connectors, manifests, summary ──
export {
  CONNECTOR_STATES, PROBE_KINDS,
  validateConnector, validateConnectorRegistry, validateServerManifest, buildConsoleSummary,
} from "./mcp-shapes.mjs";

// ── Task API boundary shapes (AGENTS.md #5 — the strict EnqueueTask validator) ──
export { validateEnqueueTask, ENQUEUE_TASK_FIELDS, TASK_UUID_RE } from "./task-shapes.mjs";

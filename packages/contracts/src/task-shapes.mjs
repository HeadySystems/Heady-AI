// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Task shapes — boundary validators for the tasks API        ║
// ║  Realizes components.schemas.EnqueueTask from the OpenAPI SoT as    ║
// ║  a STRICT dependency-free validator (unknown fields rejected —      ║
// ║  the mcp-shapes / facts-schema idiom). Boundary law (AGENTS.md #5): ║
// ║  every route that reads a request body imports its validator from   ║
// ║  THIS package, so the shape has exactly one authority. Zod codegen  ║
// ║  from the same spec remains a later build step (ADR-0002).          ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Version-agnostic UUID (matches the OpenAPI `format: uuid` intent). */
export const TASK_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Field surface of components.schemas.EnqueueTask — the strict-contract allowlist. */
export const ENQUEUE_TASK_FIELDS = Object.freeze(["kind", "input", "deps"]);

/**
 * Strict boundary validation per components.schemas.EnqueueTask (contract SoT:
 * packages/contracts/openapi/heady.openapi.json). Pure + dependency-free.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateEnqueueTask(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, errors: ["body must be a JSON object"] };
  if (typeof body.kind !== "string" || !body.kind) errors.push("kind (string) is required");
  if (typeof body.input !== "object" || body.input === null || Array.isArray(body.input)) errors.push("input (object) is required");
  if (body.deps !== undefined) {
    if (!Array.isArray(body.deps) || body.deps.some((d) => !TASK_UUID_RE.test(String(d)))) errors.push("deps must be an array of task UUIDs");
  }
  const known = new Set(ENQUEUE_TASK_FIELDS);
  for (const k of Object.keys(body)) if (!known.has(k)) errors.push(`unknown field: ${k}`);
  return { ok: errors.length === 0, errors };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Truthful Registry v1.0.0                            ║
// ║  Advertises only available handlers; invocation stays private.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

function availabilityOf(definition) {
  const raw = typeof definition.available === "function" ? definition.available() : true;
  if (raw === true) return { available: true, reason: null };
  if (raw === false) return { available: false, reason: "runtime dependency unavailable" };
  return {
    available: raw?.available === true,
    reason: raw?.reason ? String(raw.reason) : "runtime dependency unavailable",
  };
}

export function createToolRegistry(definitions, { deferred = [] } = {}) {
  const byName = new Map();
  for (const definition of definitions) {
    if (!definition?.name || typeof definition.handler !== "function") {
      throw new TypeError("every MCP tool requires a name and handler");
    }
    if (byName.has(definition.name)) throw new Error(`duplicate MCP tool: ${definition.name}`);
    byName.set(definition.name, Object.freeze({ ...definition }));
  }

  return Object.freeze({
    advertised() {
      return [...byName.values()].filter((definition) => availabilityOf(definition).available);
    },
    status() {
      const implemented = [...byName.values()].map((definition) => ({
        name: definition.name,
        ...availabilityOf(definition),
        contextPolicy: definition.contextPolicy,
        requiredScopes: [...definition.requiredScopes],
      }));
      return { implemented, deferred: deferred.map((item) => ({ ...item, available: false })) };
    },
    definition(name) {
      const definition = byName.get(name);
      if (!definition) return null;
      return availabilityOf(definition).available ? definition : null;
    },
  });
}

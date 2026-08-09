// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ facts.v1 — the golden-record schema (the law about facts)  ║
// ║  The canonical shape + locked invariants of facts.yaml. This is    ║
// ║  the meta-invariant: facts.yaml declares `schema: facts.v1`, and   ║
// ║  THIS module is that schema. Dependency-free, pure — the loader     ║
// ║  (@heady/config) supplies the parsed object; the coherence gate     ║
// ║  cross-checks repo prose AGAINST these values (complementary).      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Design (per the rebuild invariant order — this is step 3, the null keystone):
//   • VALUE-LOCK architectural decisions — silent change == corruption
//     (dim=384, pooling=mean, pgvector, φ, esm, chokepoint, dropped⊇qdrant,
//      event_bus, agent_harness, stage_count=21=fib(8)). ADR-cited.
//   • TYPE-CHECK growing counters — value-locking them forces a schema edit
//     on every increment (patents_provisional: positive int, not const;
//     facts.yaml stays the value authority).
//   • STRUCTURE-CHECK required keys + enums + dynamic domain entries.

/** The schema version string this module realizes. `facts.yaml.schema` MUST equal it. */
export const FACTS_V1_VERSION = "facts.v1";

// Rule vocabulary (any subset per row):
//   path      dotted accessor into the parsed golden record
//   required  a null/undefined value is a violation
//   type      "string" | "number" | "integer" | "boolean" | "array" | "object"
//   const     exact value-lock (architectural decision)
//   oneOf     value must be one of these (enum)
//   includes  array must contain this element
//   minItems  array minimum length
//   min       numeric floor
//   adr       provenance annotation surfaced in the error message
/** The canonical facts.v1 rule set — the enforced shape of the golden record. */
export const FACTS_V1 = [
  { path: "schema", required: true, const: FACTS_V1_VERSION,
    adr: "self-reference — a schema bump requires authoring facts.vN before the tag changes" },

  // ── company ──────────────────────────────────────────────────────
  { path: "company", required: true, type: "object" },
  { path: "company.legal_name", required: true, const: "HeadySystems Inc.", adr: "brand law" },
  { path: "company.trade_name", required: true, type: "string" },
  { path: "company.founder", required: true, type: "string" },
  // counter, not invariant — grows on the next filing; facts.yaml is the value authority
  { path: "company.patents_provisional", required: true, type: "integer", min: 1 },

  // ── product ──────────────────────────────────────────────────────
  { path: "product", required: true, type: "object" },
  { path: "product.name", required: true, const: "heady-ai" },
  { path: "product.version", required: true, type: "string" },
  { path: "product.status", required: true, type: "string" }, // changes at launch — not locked

  // ── platform ─────────────────────────────────────────────────────
  { path: "platform", required: true, type: "object" },
  { path: "platform.package_manager", required: true, const: "pnpm" },
  { path: "platform.node_version", required: true, type: "integer", min: 20 }, // bumps allowed
  { path: "platform.module_system", required: true, const: "esm", adr: "AGENTS.md #1 / CLAUDE.md §I.1" },
  { path: "platform.phi", required: true, const: 1.618033988749895, adr: "φ is a constant — drift is corruption" },

  // ── stores (ADR-0002/0003/0015) ──────────────────────────────────
  { path: "stores", required: true, type: "object" },
  { path: "stores.system_of_record", required: true, const: "neon-postgres", adr: "ADR-0002" },
  { path: "stores.retrieval_authority", required: true, const: "pgvector", adr: "ADR-0003" },
  { path: "stores.derived_edge_cache", required: true, const: "vectorize", adr: "ADR-0015" },
  { path: "stores.dropped", required: true, type: "array", includes: "qdrant", adr: "ADR-0003 (dropped decision)" },

  // ── embedding (ADR-0015 — locked model/dim/pooling) ──────────────
  { path: "embedding", required: true, type: "object" },
  { path: "embedding.model", required: true, const: "@cf/baai/bge-small-en-v1.5", adr: "ADR-0015" },
  { path: "embedding.dim", required: true, const: 384, adr: "ADR-0015" },
  { path: "embedding.pooling", required: true, const: "mean", adr: "ADR-0015" },

  // ── model layer (egress chokepoint is load-bearing security) ─────
  { path: "model_layer", required: true, type: "object" },
  { path: "model_layer.egress_chokepoint", required: true, const: "cloudflare-ai-gateway", adr: "ADR-0018" },
  { path: "model_layer.edge_tier", required: true, type: "string" },
  { path: "model_layer.fallback_chain", required: true, type: "array", minItems: 1 },

  // ── platform-wide locked picks ───────────────────────────────────
  { path: "event_bus", required: true, const: "nats", adr: "ADR-0020" },
  { path: "durable_execution", required: true, type: "string" },
  { path: "agent_harness", required: true, const: "vercel-ai-sdk-v6", adr: "ADR-0016 (Claude Agent SDK rejected as harness)" },
  { path: "auth", required: true, type: "string" },
  { path: "secrets", required: true, const: "gcp-secret-manager", adr: "zero plaintext secrets" },
  { path: "supply_chain", required: true, type: "object" },
  { path: "supply_chain.primary", required: true, type: "string" },

  // ── deploy targets ───────────────────────────────────────────────
  { path: "deploy_targets", required: true, type: "object" },
  { path: "deploy_targets.origin", required: true, type: "object" },
  { path: "deploy_targets.origin.kind", required: true, type: "string" },

  // ── pipeline + HCFullPipeline ────────────────────────────────────
  { path: "pipeline", required: true, type: "object" },
  { path: "pipeline.stages", required: true, type: "array", minItems: 1 },
  { path: "pipeline.required_checks", required: true, type: "array", minItems: 1 },
  { path: "hcfullpipeline", required: true, type: "object" },
  // 21 = fib(8), φ-native; 22 is not a Fibonacci number and cannot be canonical
  { path: "hcfullpipeline.stage_count", required: true, const: 21, adr: "fib(8) — canonical HCFP DAG" },

  // ── capacity — enforced runtime concurrency ceiling ──────────────
  { path: "capacity", required: true, type: "object" },
  // fib(20), φ-native; 10000 is roadmap language only — raise only via a soak-tested successor ADR
  { path: "capacity.max_concurrent_runtime", required: true, const: 6765, adr: "ADR-0040 — fib(20) runtime ceiling" },

  // ── consistency (⌈φ²⌉=3; type-checked, φ-derived) ────────────────
  { path: "consistency", required: true, type: "object" },
  { path: "consistency.escalation_threshold", required: true, type: "integer", min: 1 },

  // ── stage0 — agent-untouchable bootstrap pointer (STEPWISE §0.8) ──
  { path: "stage0", required: true, type: "object" },
  { path: "stage0.manifest", required: true, type: "string", adr: "ADR-0016 / STEPWISE §0.8" },

  // ── containers validated structurally; entries checked below ─────
  { path: "domains", required: true, type: "object" },
  { path: "legacy", required: true, type: "object" },
];

/** Allowed values for a domain entry's `status` field. */
const DOMAIN_STATUS = ["verified", "unverified"];

function at(obj, dotted) {
  return dotted.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function typeOk(value, type) {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && !Number.isNaN(value);
    case "integer": return Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    default: return true;
  }
}

const withAdr = (msg, adr) => (adr ? `${msg} (${adr})` : msg);

/**
 * Validate a parsed golden record against facts.v1. Pure and aggregating — it
 * returns EVERY violation (never early-returns) so a single run surfaces all
 * drift. Callers that need throw semantics wrap this (see @heady/config).
 * @param {Record<string, unknown>} facts parsed facts.yaml object
 * @returns {{ ok: boolean, version: string, errors: string[] }}
 */
export function validateFactsV1(facts) {
  const errors = [];
  const obj = facts && typeof facts === "object" ? facts : {};

  for (const rule of FACTS_V1) {
    const value = at(obj, rule.path);

    if (value === undefined || value === null) {
      if (rule.required) errors.push(`facts.yaml missing required key: ${rule.path}`);
      continue;
    }
    if (rule.type && !typeOk(value, rule.type)) {
      errors.push(withAdr(`facts.yaml ${rule.path} must be of type ${rule.type}, got ${Array.isArray(value) ? "array" : typeof value}`, rule.adr));
      continue; // downstream checks assume the type held
    }
    if ("const" in rule && value !== rule.const) {
      errors.push(withAdr(`facts.yaml ${rule.path} must be ${JSON.stringify(rule.const)}, got ${JSON.stringify(value)}`, rule.adr));
    }
    if (rule.oneOf && !rule.oneOf.includes(value)) {
      errors.push(withAdr(`facts.yaml ${rule.path} must be one of ${JSON.stringify(rule.oneOf)}, got ${JSON.stringify(value)}`, rule.adr));
    }
    if ("includes" in rule && !(Array.isArray(value) && value.includes(rule.includes))) {
      errors.push(withAdr(`facts.yaml ${rule.path} must include ${JSON.stringify(rule.includes)}`, rule.adr));
    }
    if (rule.minItems && Array.isArray(value) && value.length < rule.minItems) {
      errors.push(withAdr(`facts.yaml ${rule.path} must have at least ${rule.minItems} item(s), got ${value.length}`, rule.adr));
    }
    if (rule.min !== undefined && typeof value === "number" && value < rule.min) {
      errors.push(withAdr(`facts.yaml ${rule.path} must be >= ${rule.min}, got ${value}`, rule.adr));
    }
  }

  // Dynamic domain entries: every object child of `domains` (skip scalars like
  // dns_checked) must carry fqdn + role + a recognized status. This is the
  // domain-canon SoT contract (facts.yaml reconciles the three code registries).
  const domains = at(obj, "domains");
  if (domains && typeof domains === "object" && !Array.isArray(domains)) {
    for (const [key, entry] of Object.entries(domains)) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
      for (const field of ["fqdn", "role", "status"]) {
        if (typeof entry[field] !== "string" || entry[field] === "") {
          errors.push(`facts.yaml domains.${key}.${field} must be a non-empty string`);
        }
      }
      if (entry.status && !DOMAIN_STATUS.includes(entry.status)) {
        errors.push(`facts.yaml domains.${key}.status must be one of ${JSON.stringify(DOMAIN_STATUS)}, got ${JSON.stringify(entry.status)}`);
      }
    }
  }

  return { ok: errors.length === 0, version: FACTS_V1_VERSION, errors };
}

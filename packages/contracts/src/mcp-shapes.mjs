// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Console shapes — the §8 shared contract                 ║
// ║  One set of STRICT shapes (unknown fields rejected) imported by     ║
// ║  BOTH the Console UI and the servers: Connector, ServerManifest     ║
// ║  (projection_only + Provenance — the anti-masquerade contract),     ║
// ║  ConsoleSummary. Dependency-free validators in the facts-schema     ║
// ║  idiom; Zod codegen remains a later build step (ADR-0002).          ║
// ║  Heartbeat = φ⁷×1000 ms — import HEARTBEAT_MS from @heady/phi-math. ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/** §8 connector state model — token_expired and projection_only are first-class. */
export const CONNECTOR_STATES = Object.freeze([
  "not_connected", "connecting", "healthy", "degraded",
  "unreachable", "token_expired", "projection_only", "empty",
]);

/** Probe kinds: https = public endpoint; kernel = a heady-manager service's own
 *  health; vault = credentialed ping with vault-resolved secrets, where a
 *  401/403 IS the live token_expired signal (§8 token lifecycle). */
export const PROBE_KINDS = Object.freeze(["https", "kernel", "vault"]);

const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]+$/;

const isStr = (v) => typeof v === "string" && v.length > 0;
const push = (errors, msg) => { errors.push(msg); return false; };

function noUnknown(obj, known, errors, where) {
  for (const k of Object.keys(obj)) {
    if (!known.includes(k)) push(errors, `${where}: unknown field "${k}" (strict contract)`);
  }
}

/**
 * Validate one connector-registry entry.
 * { id, name, kind: "heady"|"infra", role, deploy_class: bool,
 *   expected: "real"|"projection", probe: null | {kind, url?, service?} }
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateConnector(c) {
  const errors = [];
  if (!c || typeof c !== "object" || Array.isArray(c)) return { ok: false, errors: ["connector must be an object"] };
  noUnknown(c, ["id", "name", "kind", "role", "deploy_class", "expected", "probe"], errors, `connector ${c.id ?? "?"}`);
  if (!isStr(c.id) || !/^[a-z0-9-]+$/.test(c.id)) push(errors, "connector.id must be kebab-case");
  if (!isStr(c.name)) push(errors, `connector ${c.id}: name required`);
  if (!["heady", "infra"].includes(c.kind)) push(errors, `connector ${c.id}: kind must be heady|infra`);
  if (!isStr(c.role)) push(errors, `connector ${c.id}: role required`);
  if (typeof c.deploy_class !== "boolean") push(errors, `connector ${c.id}: deploy_class must be boolean (the confused-deputy flag)`);
  if (!["real", "projection"].includes(c.expected)) push(errors, `connector ${c.id}: expected must be real|projection`);
  if (c.probe !== null) {
    if (!c.probe || typeof c.probe !== "object") push(errors, `connector ${c.id}: probe must be null or an object`);
    else {
      noUnknown(c.probe, ["kind", "url", "service", "secrets", "ping"], errors, `connector ${c.id}.probe`);
      if (!PROBE_KINDS.includes(c.probe.kind)) push(errors, `connector ${c.id}: probe.kind must be ${PROBE_KINDS.join("|")}`);
      if (c.probe.kind === "https" && !(isStr(c.probe.url) && c.probe.url.startsWith("https://"))) {
        push(errors, `connector ${c.id}: https probe needs an https:// url`);
      }
      if (c.probe.kind === "kernel" && !isStr(c.probe.service)) push(errors, `connector ${c.id}: kernel probe needs a service name`);
      if (c.probe.kind === "vault") {
        const p = c.probe;
        if (!Array.isArray(p.secrets) || p.secrets.length === 0 || p.secrets.some((s) => !SECRET_NAME_RE.test(String(s)))) {
          push(errors, `connector ${c.id}: vault probe needs secrets[] of UPPER_SNAKE names`);
        }
        // A credential's existence proves nothing — a vault probe MUST ping so
        // the state is measured (2xx healthy · 401/403 token_expired · else degraded).
        if (!p.ping || typeof p.ping !== "object") push(errors, `connector ${c.id}: vault probe requires a ping`);
        else {
          noUnknown(p.ping, ["url", "urlSecret", "path", "authSecret", "scheme"], errors, `connector ${c.id}.probe.ping`);
          const hasUrl = isStr(p.ping.url) && p.ping.url.startsWith("https://");
          const hasUrlSecret = SECRET_NAME_RE.test(String(p.ping.urlSecret ?? ""));
          if (hasUrl === hasUrlSecret) push(errors, `connector ${c.id}: ping needs exactly one of url (https://) or urlSecret`);
          if (!SECRET_NAME_RE.test(String(p.ping.authSecret ?? ""))) push(errors, `connector ${c.id}: ping.authSecret required`);
        }
      }
    }
  } else if (c.probe === undefined) push(errors, `connector ${c.id}: probe required (null = not wired yet)`);
  return { ok: errors.length === 0, errors };
}

/** Validate the whole registry file ({schema, connectors[]}); ids must be unique. */
export function validateConnectorRegistry(reg) {
  const errors = [];
  if (!reg || typeof reg !== "object") return { ok: false, errors: ["registry must be an object"] };
  if (reg.schema !== "connectors.v1") push(errors, `registry.schema must be "connectors.v1"`);
  if (!Array.isArray(reg.connectors) || reg.connectors.length === 0) {
    push(errors, "registry.connectors must be a non-empty array");
    return { ok: false, errors };
  }
  const seen = new Set();
  for (const c of reg.connectors) {
    const v = validateConnector(c);
    errors.push(...v.errors);
    if (c?.id) {
      if (seen.has(c.id)) push(errors, `duplicate connector id: ${c.id}`);
      seen.add(c.id);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate a ServerManifest — the anti-masquerade contract (§8): every shell
 * tells the truth about itself. { schema, name, projection_only, provenance
 * {source_repo, source_sha?, projected_at?}, tools_count? }
 */
export function validateServerManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object") return { ok: false, errors: ["manifest must be an object"] };
  noUnknown(m, ["schema", "name", "projection_only", "provenance", "tools_count"], errors, "manifest");
  if (m.schema !== "server-manifest.v1") push(errors, `manifest.schema must be "server-manifest.v1"`);
  if (!isStr(m.name)) push(errors, "manifest.name required");
  if (typeof m.projection_only !== "boolean") push(errors, "manifest.projection_only must be boolean");
  if (!m.provenance || typeof m.provenance !== "object") push(errors, "manifest.provenance required");
  else {
    noUnknown(m.provenance, ["source_repo", "source_sha", "projected_at"], errors, "manifest.provenance");
    if (!isStr(m.provenance.source_repo)) push(errors, "manifest.provenance.source_repo required");
  }
  if (m.tools_count !== undefined && !Number.isInteger(m.tools_count)) push(errors, "manifest.tools_count must be an integer");
  return { ok: errors.length === 0, errors };
}

/**
 * Shape of the Console summary the probe service serves — one cell per
 * connector: { id, name, kind, role, deploy_class, expected, state,
 * detail?, latencyMs?, checkedAt }.
 */
export function buildConsoleSummary({ connectors, heartbeatMs, generatedAt }) {
  if (!Array.isArray(connectors)) throw new TypeError("buildConsoleSummary: connectors[] required");
  for (const c of connectors) {
    if (!CONNECTOR_STATES.includes(c.state)) throw new RangeError(`invalid connector state "${c.state}" for ${c.id}`);
  }
  const counts = {};
  for (const s of CONNECTOR_STATES) counts[s] = connectors.filter((c) => c.state === s).length;
  return {
    schema: "console-summary.v1",
    heartbeatMs,
    generatedAt,
    counts,
    global: counts.healthy === connectors.length ? "all-healthy" : (counts.unreachable + counts.token_expired > 0 ? "attention" : "mixed"),
    connectors,
  };
}

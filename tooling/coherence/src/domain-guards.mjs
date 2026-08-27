// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Domain Guards — the domain-canon reconciliation contract   ║
// ║  facts.yaml `domains:` is the SoT; every other file that names a    ║
// ║  domain is a CARRIER (a projection). Membership is one-directional: ║
// ║  a carrier may only name domains present in the SoT, and each SoT   ║
// ║  node's `sources:` must equal exactly the set of carriers naming it. ║
// ║  Pure semantics — the coherence kernel owns the file IO (mirrors     ║
// ║  scalar-guards.mjs), so this contract is unit-testable.             ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The asymmetry is DELIBERATE and load-bearing:
//   carrier ⊄ SoT  → contradiction (an unrecorded domain is drift)
//   SoT ⊄ carrier  → fine (src/config/domain-registry.js is a ratified subset;
//                    entity/tenant/revenue is a founder call, not a code fix)
// Inverting it would fire on every unratified domain and the guard would be
// weakened away. `sources:` is what closes the loop: it declares which carriers
// SHOULD name a domain, and D2/D3 check both directions of that declaration.

/** An fqdn as the SoT and the carriers spell it (`1ime1.com` starts with a digit). */
const FQDN = /^[a-z0-9][a-z0-9-]*\.(com|org|net|ai|io|dev)$/;

/** Keep only fqdn-shaped tokens — an extractor's regex may catch structural noise. */
const fqdnsOnly = (values) => [...new Set(values.filter((v) => FQDN.test(v)))].sort();

/**
 * Every live carrier, keyed by the `sources:` token that names it in facts.yaml.
 * `extract` is pure text → sorted fqdn list. Add a row to bring a new carrier
 * under the contract; the kernel reads `file` and needs no other change.
 */
export const DOMAIN_CARRIERS = [
  {
    token: 'domain-registry',
    file: 'src/config/domain-registry.js',
    what: 'brand architecture — entity/tenant/revenue/layer (ratified subset)',
    extract: (text) => extractQuotedMapKeys(text),
  },
  {
    token: 'global-config',
    file: 'src/config/global.js',
    what: 'runtime CORS/routing whitelist (DOMAINS)',
    extract: (text) => extractFrozenArray(text, 'DOMAINS'),
  },
  {
    token: 'site-registry',
    file: 'configs/_domains/site-registry.yaml',
    what: 'local site processes — PM2 ports/dirs',
    extract: (text) => extractYamlDomainField(text),
  },
  {
    token: 'domain-architecture',
    file: 'configs/domain-architecture.json',
    what: 'routing/DNS hygiene + the domain-guard authorized-hostname allowlist',
    extract: (text) => extractJsonDomainNames(text),
  },
  {
    token: 'edge-router',
    file: 'configs/cloudflare-workers/heady-router-worker.js',
    what: 'live Cloudflare edge routing table (SITES)',
    extract: (text) => extractQuotedMapKeys(text),
  },
];

// ── extractors (pure text → sorted fqdn list) ────────────────────────────

/** Quoted object keys opening a block: `'headyme.com': {`. Enum-style
 *  `KEY: 'value'` rows are unquoted on the key side and never match. */
export function extractQuotedMapKeys(text) {
  return fqdnsOnly([...text.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]));
}

/** Quoted entries inside `const <name> = Object.freeze([ … ])`. */
export function extractFrozenArray(text, name) {
  const block = new RegExp(`const\\s+${name}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`).exec(text);
  if (!block) return [];
  return fqdnsOnly([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

/** `domain: <fqdn>` rows, with or without a `- ` list prefix; `domain: null`
 *  placeholders are dropped by the shape filter. */
export function extractYamlDomainField(text) {
  return fqdnsOnly([...text.matchAll(/^\s*-?\s*domain:\s*(\S+)\s*$/gm)].map((m) => m[1]));
}

/**
 * The domain roster carried inside a Battle Arena spec dump. The blueprint dump is
 * plain JSON; a contender-context dump embeds the same blueprint as an ESCAPED JSON
 * string inside `content`, so the inner document is unwrapped before reading. These
 * dumps have no runtime consumer, but they are the only window the configs/-scoped
 * content gates have into the legacy CommonJS spec in src/ — which is how a wrong
 * pgvector storage dimension survived there against the 384-dim EMBED-DIM-LOCK.
 * Returns null when the text carries no roster at all (not a dump).
 */
export function extractArenaSpecRoster(text) {
  const doc = JSON.parse(text);
  let spec = doc;
  if (typeof doc.content === 'string') {
    const open = doc.content.indexOf('{');
    const close = doc.content.lastIndexOf('}');
    // Prose with no embedded document is simply not a spec — null, not a parse error.
    if (open === -1 || close < open) return null;
    spec = JSON.parse(doc.content.slice(open, close + 1));
  }
  const domains = spec?.project?.domains;
  return Array.isArray(domains) ? fqdnsOnly(domains) : null;
}

/** `{ domains: [ { name } … ] }`. */
export function extractJsonDomainNames(text) {
  const parsed = JSON.parse(text);
  return fqdnsOnly((parsed.domains ?? []).map((d) => d?.name).filter((n) => typeof n === 'string'));
}

/**
 * Per-entry `status:` in src/config/domain-registry.js, as fqdn → status string.
 * `DomainStatus.VERIFIED` → 'verified'. This is the ONE field the SoT and the
 * brand registry both carry, so it is the only field-level drift D5 can check.
 */
export function extractRegistryStatus(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*'([^']+)':\s*\{([\s\S]*?)^\s*\},/gm)) {
    if (!FQDN.test(m[1])) continue;
    const status = /status:\s*DomainStatus\.([A-Z_]+)/.exec(m[2]);
    if (status) out[m[1]] = status[1].toLowerCase();
  }
  return out;
}

// ── the contract ─────────────────────────────────────────────────────────

/** SoT nodes only — `domains:` also holds scalars such as `dns_checked`. */
export function domainNodes(domains) {
  return Object.entries(domains ?? {}).filter(
    ([, v]) => v && typeof v === 'object' && !Array.isArray(v),
  );
}

/** The SoT roster: every fqdn, sorted — the value every projection derives from. */
export function rosterFromFacts(domains) {
  return domainNodes(domains)
    .map(([, v]) => v.fqdn)
    .filter((f) => typeof f === 'string')
    .sort();
}

/** The full SoT projection payload written to configs/_generated/domain-roster.json.
 *  Deliberately timestamp-free so it is byte-comparable and D6 can gate it. */
export function rosterProjection(domains) {
  const nodes = domainNodes(domains)
    .map(([key, v]) => ({ key, fqdn: v.fqdn, role: v.role, status: v.status }))
    .sort((a, b) => a.fqdn.localeCompare(b.fqdn));
  return {
    schema: 'domain-roster.v1',
    generated_by: 'node tooling/coherence/src/coherence.mjs domains',
    sot: 'facts.yaml domains:',
    edit: 'Never hand-edit. Change facts.yaml and regenerate; guard D6 fails on drift.',
    count: nodes.length,
    fqdns: nodes.map((n) => n.fqdn),
    domains: nodes,
  };
}

/**
 * Reconcile the SoT against every carrier.
 *
 * @param {object}  input
 * @param {object}  input.domains        parsed facts.yaml `domains:` map
 * @param {object}  input.carriers       token → fqdn list actually found in that carrier
 * @param {object} [input.registryStatus] fqdn → status from src/config/domain-registry.js
 * @param {object} [input.roster]        parsed configs/_generated/domain-roster.json
 * @param {object} [input.arenaSpecs]    file → roster carried by that arena spec dump
 * @returns {Array<{id:string,msg:string,evidence:object}>} contradictions (empty = reconciled)
 */
export function checkDomainCarriers({ domains, carriers, registryStatus, roster, arenaSpecs }) {
  const findings = [];
  const err = (id, msg, evidence) => findings.push({ id, msg, evidence });

  const nodes = domainNodes(domains);
  const byFqdn = new Map(nodes.map(([key, v]) => [v.fqdn, { key, ...v }]));
  const known = new Set(byFqdn.keys());
  const tokens = Object.keys(carriers);

  // D1 — a carrier may not name a domain the SoT does not record.
  for (const token of tokens) {
    for (const fqdn of carriers[token]) {
      if (!known.has(fqdn)) {
        err('D1-carrier-orphan', 'carrier names a domain absent from the facts.yaml domain canon', { carrier: token, fqdn });
      }
    }
  }

  // D2/D3 — `sources:` must equal exactly the carriers that name the domain.
  for (const [key, node] of nodes) {
    const declared = new Set(Array.isArray(node.sources) ? node.sources : []);
    if (declared.size === 0) {
      err('D4-sourceless', 'domain canon node declares no carrier in sources', { domain: key, fqdn: node.fqdn });
    }
    for (const token of tokens) {
      const carried = carriers[token].includes(node.fqdn);
      if (carried && !declared.has(token)) {
        err('D2-source-unclaimed', 'carrier names this domain but the canon node omits that source token', { domain: key, fqdn: node.fqdn, carrier: token });
      }
      if (!carried && declared.has(token)) {
        err('D3-source-phantom', 'canon node claims a source token whose carrier does not name the domain', { domain: key, fqdn: node.fqdn, carrier: token });
      }
    }
    for (const token of declared) {
      if (!tokens.includes(token)) {
        err('D3-source-unknown', 'canon node claims a source token that is not a registered carrier', { domain: key, fqdn: node.fqdn, carrier: token });
      }
    }
  }

  // D5 — the one field both the SoT and the brand registry carry.
  for (const [fqdn, status] of Object.entries(registryStatus ?? {})) {
    const node = byFqdn.get(fqdn);
    if (node && node.status !== status) {
      err('D5-status-drift', 'brand registry status disagrees with the facts.yaml domain canon', { fqdn, facts: node.status, registry: status });
    }
  }

  // D7 — a spec dump handed to an external model must carry the canon roster.
  for (const [file, dumped] of Object.entries(arenaSpecs ?? {})) {
    if (dumped === null) {
      err('D7-spec-rosterless', 'arena spec dump carries no domain roster', { file });
      continue;
    }
    const want = rosterFromFacts(domains);
    if (JSON.stringify(dumped) !== JSON.stringify(want)) {
      err('D7-spec-drift', 'arena spec dump roster disagrees with facts.yaml — refresh with `node tooling/arena-spec/dump.mjs`', {
        file,
        missing: want.filter((f) => !dumped.includes(f)),
        stale: dumped.filter((f) => !want.includes(f)),
      });
    }
  }

  // D6 — the generated roster projection must equal the SoT roster.
  if (roster) {
    const want = rosterProjection(domains);
    if (JSON.stringify(roster) !== JSON.stringify(want)) {
      err('D6-roster-drift', 'generated domain-roster projection disagrees with facts.yaml — regenerate with `coherence.mjs domains`', {
        facts_count: want.count,
        roster_count: roster.count,
        missing_from_roster: want.fqdns.filter((f) => !(roster.fqdns ?? []).includes(f)),
        stale_in_roster: (roster.fqdns ?? []).filter((f) => !want.fqdns.includes(f)),
      });
    }
  }

  return findings;
}

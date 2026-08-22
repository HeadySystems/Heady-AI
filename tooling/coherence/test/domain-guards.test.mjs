// Domain-canon reconciliation contract — every guard must FIRE on its drift and
// stay silent on the deliberate asymmetry (a ratified-subset carrier).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DOMAIN_CARRIERS, checkDomainCarriers, domainNodes, extractArenaSpecRoster,
  extractFrozenArray, extractJsonDomainNames, extractQuotedMapKeys,
  extractRegistryStatus, extractYamlDomainField, rosterFromFacts, rosterProjection,
} from '../src/domain-guards.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const ids = (findings) => findings.map((f) => f.id).sort();

/** Two domains: one carried by both carriers, one by the SoT only (unratified). */
const DOMAINS = {
  dns_checked: '2026-07-04',
  headyme: { fqdn: 'headyme.com', role: 'primary-user-surface', status: 'verified', sources: ['a', 'b'] },
  headylab: { fqdn: 'headylab.com', role: 'research-patent-lab', status: 'unverified', sources: ['a'] },
};
const CARRIERS = { a: ['headyme.com', 'headylab.com'], b: ['headyme.com'] };

test('a reconciled canon yields no contradiction', () => {
  assert.deepEqual(checkDomainCarriers({ domains: DOMAINS, carriers: CARRIERS }), []);
});

test('SoT ⊄ carrier is ALLOWED — the brand registry is a ratified subset', () => {
  // headylab.com is absent from carrier b and declares only 'a' → silence.
  const findings = checkDomainCarriers({ domains: DOMAINS, carriers: CARRIERS });
  assert.equal(findings.filter((f) => f.evidence.fqdn === 'headylab.com').length, 0);
});

test('D1 fires when a carrier names a domain the SoT does not record', () => {
  const findings = checkDomainCarriers({
    domains: DOMAINS,
    carriers: { ...CARRIERS, b: ['headyme.com', 'headybot.com'] },
  });
  // An orphan is not a node, so it cannot also trip the sources checks — D1 alone.
  assert.deepEqual(ids(findings), ['D1-carrier-orphan']);
  assert.deepEqual(findings[0].evidence, { carrier: 'b', fqdn: 'headybot.com' });
});

test('D2 fires when a carrier names a domain whose node omits that token', () => {
  const domains = { ...DOMAINS, headylab: { ...DOMAINS.headylab, sources: [] } };
  const findings = checkDomainCarriers({ domains, carriers: CARRIERS });
  assert.deepEqual(ids(findings), ['D2-source-unclaimed', 'D4-sourceless']);
});

test('D3 fires when a node claims a carrier that does not name it', () => {
  const domains = { ...DOMAINS, headylab: { ...DOMAINS.headylab, sources: ['a', 'b'] } };
  const findings = checkDomainCarriers({ domains, carriers: CARRIERS });
  assert.deepEqual(ids(findings), ['D3-source-phantom']);
  assert.equal(findings[0].evidence.carrier, 'b');
});

test('D3-source-unknown fires on a token that is not a registered carrier', () => {
  const domains = { ...DOMAINS, headylab: { ...DOMAINS.headylab, sources: ['a', 'ghost-registry'] } };
  const findings = checkDomainCarriers({ domains, carriers: CARRIERS });
  assert.deepEqual(ids(findings), ['D3-source-unknown']);
});

test('D5 fires when the brand registry status disagrees with the canon', () => {
  const findings = checkDomainCarriers({
    domains: DOMAINS, carriers: CARRIERS, registryStatus: { 'headyme.com': 'unverified' },
  });
  assert.deepEqual(ids(findings), ['D5-status-drift']);
  assert.deepEqual(findings[0].evidence, { fqdn: 'headyme.com', facts: 'verified', registry: 'unverified' });
});

test('D5 stays silent on a domain the brand registry does not carry', () => {
  assert.deepEqual(
    checkDomainCarriers({ domains: DOMAINS, carriers: CARRIERS, registryStatus: { 'headybot.com': 'verified' } }),
    [],
  );
});

test('D6 fires on a stale roster projection and names both directions of the drift', () => {
  const stale = rosterProjection({ headyme: DOMAINS.headyme, headybot: { fqdn: 'headybot.com', role: 'r', status: 'unverified' } });
  const findings = checkDomainCarriers({ domains: DOMAINS, carriers: CARRIERS, roster: stale });
  assert.deepEqual(ids(findings), ['D6-roster-drift']);
  assert.deepEqual(findings[0].evidence.missing_from_roster, ['headylab.com']);
  assert.deepEqual(findings[0].evidence.stale_in_roster, ['headybot.com']);
});

test('D6 is silent on a freshly generated projection', () => {
  const roster = JSON.parse(JSON.stringify(rosterProjection(DOMAINS)));
  assert.deepEqual(checkDomainCarriers({ domains: DOMAINS, carriers: CARRIERS, roster }), []);
});

test('scalars in the domains map are not treated as domain nodes', () => {
  assert.deepEqual(domainNodes(DOMAINS).map(([k]) => k), ['headyme', 'headylab']);
  assert.deepEqual(rosterFromFacts(DOMAINS), ['headylab.com', 'headyme.com']);
});

test('the projection is timestamp-free, so it is byte-comparable across runs', () => {
  assert.equal(JSON.stringify(rosterProjection(DOMAINS)), JSON.stringify(rosterProjection(DOMAINS)));
  assert.equal(rosterProjection(DOMAINS).count, 2);
});

test('D7 fires when an arena spec dump carries a roster other than the canon', () => {
  const findings = checkDomainCarriers({
    domains: DOMAINS, carriers: CARRIERS,
    arenaSpecs: { 'configs/battle-blueprint.json': ['headyme.com', 'headymusic.com'] },
  });
  assert.deepEqual(ids(findings), ['D7-spec-drift']);
  assert.deepEqual(findings[0].evidence.missing, ['headylab.com']);
  assert.deepEqual(findings[0].evidence.stale, ['headymusic.com']);
});

test('D7-spec-rosterless fires when a dump carries no roster at all', () => {
  const findings = checkDomainCarriers({
    domains: DOMAINS, carriers: CARRIERS, arenaSpecs: { 'configs/battle-blueprint.json': null },
  });
  assert.deepEqual(ids(findings), ['D7-spec-rosterless']);
});

test('D7 is silent on a dump carrying exactly the canon roster', () => {
  assert.deepEqual(
    checkDomainCarriers({
      domains: DOMAINS, carriers: CARRIERS,
      arenaSpecs: { 'configs/battle-blueprint.json': rosterFromFacts(DOMAINS) },
    }),
    [],
  );
});

// ── extractors: enum/struct noise must never be mistaken for a domain ────

test('extractQuotedMapKeys takes block-opening fqdn keys only', () => {
  const text = "export const E = Object.freeze({\n  CORE: 'core',\n});\nconst M = {\n  'headyme.com': {\n    tenant: 'headyme',\n  },\n  'not a domain': {\n  },\n};\n";
  assert.deepEqual(extractQuotedMapKeys(text), ['headyme.com']);
});

test('extractFrozenArray reads only the named array', () => {
  const text = "const DOMAINS = Object.freeze([\n  'headyme.com', // c\n  '1ime1.com',\n]);\nconst OTHER = Object.freeze(['headybot.com']);\n";
  assert.deepEqual(extractFrozenArray(text, 'DOMAINS'), ['1ime1.com', 'headyme.com']);
  assert.deepEqual(extractFrozenArray(text, 'ABSENT'), []);
});

test('extractYamlDomainField skips null placeholders', () => {
  assert.deepEqual(extractYamlDomainField('  - domain: headyme.com\n  - domain: null\n'), ['headyme.com']);
});

test('extractJsonDomainNames reads domains[].name', () => {
  assert.deepEqual(extractJsonDomainNames('{"domains":[{"name":"headyme.com"},{"name":"x"}]}'), ['headyme.com']);
});

test('extractArenaSpecRoster unwraps a context dump\'s escaped inner spec', () => {
  const spec = { project: { domains: ['headyme.com', 'nope'] } };
  const blueprintDump = JSON.stringify(spec);
  const contextDump = JSON.stringify({ role: 'system', content: `PROJECT SPECIFICATION:\n${JSON.stringify(spec, null, 2)}\n\nGO` });
  assert.deepEqual(extractArenaSpecRoster(blueprintDump), ['headyme.com']);
  assert.deepEqual(extractArenaSpecRoster(contextDump), ['headyme.com']);
  assert.equal(extractArenaSpecRoster('{"role":"system","content":"no spec here"}'), null);
  assert.equal(extractArenaSpecRoster('{}'), null);
});

test('extractRegistryStatus maps DomainStatus enum refs to canon values', () => {
  const text = "export const R = Object.freeze({\n  'headyme.com': {\n    status:      DomainStatus.VERIFIED,\n  },\n  'headylab.com': {\n    status:      DomainStatus.UNVERIFIED,\n  },\n});\n";
  assert.deepEqual(extractRegistryStatus(text), { 'headyme.com': 'verified', 'headylab.com': 'unverified' });
});

// ── the live repo: the contract must hold on the real carriers ───────────

test('every registered carrier exists and yields a non-empty roster', () => {
  for (const c of DOMAIN_CARRIERS) {
    const found = c.extract(readFileSync(`${ROOT}${c.file}`, 'utf8'));
    assert.ok(found.length > 0, `${c.token} (${c.file}) extracted no domains`);
  }
});

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Desktop — sync-from-facts v1.0.0                          ║
// ║  Derives app identity (version, appId, productName, portal URL)   ║
// ║  from the repo golden record facts.yaml. No hardcoded duplicates: ║
// ║  package.json + src/generated/build-info.json are projections     ║
// ║  of facts.yaml and are rewritten here on every dev/build/dist.    ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..', '..');

const log = (level, msg, fields = {}) =>
  process.stdout.write(
    `${JSON.stringify({ level, msg, svc: 'heady-desktop/sync-from-facts', ts: new Date().toISOString(), ...fields })}\n`,
  );

const fail = (msg, fields = {}) => {
  log('error', msg, fields);
  process.exit(1);
};

// ── 1. Load the golden record ───────────────────────────────────────
const factsPath = path.join(repoRoot, 'facts.yaml');
let facts;
try {
  facts = YAML.parse(readFileSync(factsPath, 'utf8'));
} catch (err) {
  fail('facts.yaml unreadable — cannot derive app identity', { factsPath, err: String(err) });
}

const version = facts?.product?.version;
const productName = facts?.company?.trade_name;
const productSlug = facts?.product?.name;
if (!version || !productName || !productSlug) {
  fail('facts.yaml missing product.version / company.trade_name / product.name', { version, productName, productSlug });
}

// appId = reverse-DNS of the platform-operations domain + product slug.
const companyFqdn = facts?.domains?.headysystems?.fqdn;
if (!companyFqdn) fail('facts.yaml missing domains.headysystems.fqdn — cannot derive appId');
const appId = `${companyFqdn.split('.').reverse().join('.')}.${productSlug}`;

// Portal default = the verified domain entry that fronts apps/headyme-portal.
const portalEntry = Object.entries(facts?.domains ?? {}).find(
  ([, d]) => d && typeof d === 'object' && d.app === 'apps/headyme-portal' && d.status === 'verified',
);
if (!portalEntry) fail('facts.yaml has no verified domains entry with app: apps/headyme-portal');
const portalHost = portalEntry[1].fqdn;
const portalUrl = `https://${portalHost}`;

// ── 2. Project into package.json (version + electron-builder identity) ──
const pkgPath = path.join(appRoot, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const drift = [];
if (pkg.version !== version) { drift.push(['version', pkg.version, version]); pkg.version = version; }
if (pkg.build.appId !== appId) { drift.push(['build.appId', pkg.build.appId, appId]); pkg.build.appId = appId; }
if (pkg.build.productName !== productName) { drift.push(['build.productName', pkg.build.productName, productName]); pkg.build.productName = productName; }
if (pkg.homepage !== portalUrl) { drift.push(['homepage', pkg.homepage, portalUrl]); pkg.homepage = portalUrl; }
if (drift.length > 0) {
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  log('warn', 'package.json drifted from facts.yaml — rewritten', {
    drift: drift.map(([k, from, to]) => ({ key: k, from, to })),
  });
}

// ── 3. Emit the runtime build-info projection ───────────────────────
const generatedDir = path.join(appRoot, 'src', 'generated');
mkdirSync(generatedDir, { recursive: true });
const buildInfo = {
  schema: 'heady-desktop.build-info.v1',
  source: 'facts.yaml',
  generatedAt: new Date().toISOString(),
  version,
  appId,
  productName,
  portalUrl,
  portalHost,
};
writeFileSync(path.join(generatedDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
log('info', 'identity synced from facts.yaml', { version, appId, productName, portalUrl, drifted: drift.length });

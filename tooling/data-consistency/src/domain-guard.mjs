// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Domain Hygiene Guard v1.0.0                             ║
// ║  Enforces Law 0 (no localhost) and checks domain name hygiene.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

const DOMAIN_MAP_PATH = join(REPO_ROOT, 'configs', 'domain-architecture.json');
// Heady-owned hostnames are SoT-DERIVED, never listed here: this projection of
// facts.yaml `domains:` is written by `coherence.mjs domains` and gated by that
// kernel's D6 guard. A hardcoded roster in this file previously flagged 1ime1.com
// (the verified admin surface) and headybuddy.org as "unauthorized".
const DOMAIN_ROSTER_PATH = join(REPO_ROOT, 'configs', '_generated', 'domain-roster.json');
// Scope = AUTHORED Heady configuration. Dependency metadata, virtualenvs, lockfiles
// and hashed build output name thousands of third-party hosts that no one chose and
// no one can fix here; scanning them buried the ~18 real LAW-0 localhost hits under
// 200+ rows of noise, which is how a hygiene report stops being read.
const EXCLUDE_DIRS = [
  'node_modules', '.git', '.turbo', 'dist', '.data', 'artifacts', 'snapshots',
  'tooling/data-consistency', 'docs/reports',
  '.venv', 'site-packages', '_archive',
];
// Lockfiles and hashed/minified bundles are generated, not authored.
const EXCLUDE_FILES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.lock$|\.min\.(js|css)$|(^|\/)index-[0-9a-f]{8}\.js$/;
const FILE_EXTS = ['.mjs', '.js', '.ts', '.json', '.hbs', '.md'];

// Recursive walker
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(REPO_ROOT, abs).split(sep).join('/');
    
    if (EXCLUDE_DIRS.some(ex => rel === ex || rel.startsWith(`${ex}/`) || rel.split('/').includes(ex))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (entry.isFile() && FILE_EXTS.some(ext => entry.name.endsWith(ext)) && !EXCLUDE_FILES.test(rel)) {
      out.push({ abs, rel });
    }
  }
  return out;
}

function loadDomainMap() {
  if (!existsSync(DOMAIN_MAP_PATH)) return { domains: [] };
  try {
    return JSON.parse(readFileSync(DOMAIN_MAP_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[DomainGuard] Failed to parse domain architecture map: ${err.message}`);
    return { domains: [] };
  }
}

/**
 * Heady-owned hostname suffixes, derived from the domain canon. Fail-CLOSED: a
 * missing or empty projection aborts the run rather than silently narrowing the
 * allowlist (which would flag every Heady URL) or widening it.
 */
function loadHeadyDomainSuffixes() {
  if (!existsSync(DOMAIN_ROSTER_PATH)) {
    throw new Error(`domain roster projection absent at ${DOMAIN_ROSTER_PATH} — run: node tooling/coherence/src/coherence.mjs domains`);
  }
  const { fqdns } = JSON.parse(readFileSync(DOMAIN_ROSTER_PATH, 'utf-8'));
  if (!Array.isArray(fqdns) || fqdns.length === 0) {
    throw new Error(`domain roster projection at ${DOMAIN_ROSTER_PATH} carries no domains`);
  }
  return fqdns;
}

/** Approved third-party service hostnames — not Heady property, so not in the canon. */
const THIRD_PARTY_SUFFIXES = [
  'neon.tech', 'upstash.io', 'github.com', 'googleapis.com',
  'sentry.io', 'huggingface.co', 'openai.com', 'anthropic.com',
  'groq.com', 'google.com', 'promptfoo.dev', 'vitest.dev',
  'npmjs.org', 'npmjs.com', 'cloudflare.com', 'tailscale.net',
  'perplexity.ai', 'schemastore.org', 'json-schema.org', 'turbo.build', 'run.app',
];

async function main() {
  console.log('HEADY™ Domain Hygiene Guard starting...');
  // configs/domain-architecture.json carries the OAuth/auth topology; the canon
  // carries who we are. Both feed the allowlist, neither is hand-duplicated here.
  const domainConfig = loadDomainMap();
  const authHosts = new Set();
  if (domainConfig.sharedAuthService) authHosts.add(domainConfig.sharedAuthService);
  for (const cb of domainConfig.domains.flatMap(d => d.oauthCallbacks ?? [])) {
    try { authHosts.add(new URL(cb).hostname); } catch { /* a malformed callback is the auth layer's concern, not hostname hygiene */ }
  }

  const files = walk(REPO_ROOT);
  const violations = [];
  const law0Exempted = [];

  // Law 0: Localhost check
  const localhostPattern = /localhost|127\.0\.0\.1/i;
  const allowedLoopbackPattern = /localhost:1055|127\.0\.0\.1:1055/i;

  // Law 0 exemptions — each is a shape where loopback is CORRECT, not tolerated.
  // Triaged 2026-08-22; see docs/LAW0_LOOPBACK_TRIAGE_2026-08-22.md. Anything not
  // matching one of these was fixed rather than exempted.
  const LAW0_EXEMPT_LINE = [
    {
      // `new URL(relative, base)` needs an absolute base. The host is parsed and
      // discarded; no connection is opened. Rewriting it to a real domain would
      // be misleading, not safer.
      why: 'url-parse-base',
      re: /new URL\([^)]*,\s*[`'"](?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1)/i,
    },
    {
      // A container probing ITSELF. This is the idiomatic form and changing it
      // would break the healthcheck.
      why: 'container-self-healthcheck',
      re: /HEALTHCHECK|CMD node -e/,
    },
    {
      // Prose emitted INTO a scaffolded project, telling its developer how to run
      // it. Content of a generated artifact, not a call this repo makes.
      why: 'generated-artifact-prose',
      re: /Visit .{0,12}(?:https?):\/\/(?:localhost|127\.0\.0\.1)/i,
    },
  ];
  // Tests legitimately assert that Law 0 REJECTS loopback — path-exempt them, the
  // same way tooling/coherence/src/scalar-guards.mjs exempts tests that assert the
  // rejection of a wrong canonical number.
  const LAW0_EXEMPT_PATH = /(^|\/)tests?\/|\.(test|spec)\.[cm]?js$/;

  // Allowed domain suffixes: the SoT-derived canon + auth topology + third parties.
  const headySuffixes = loadHeadyDomainSuffixes();
  const allowedDomainSuffixes = [...headySuffixes, ...authHosts, ...THIRD_PARTY_SUFFIXES];
  console.log(`[DomainGuard] allowlist: ${headySuffixes.length} canon (facts.yaml) + ${authHosts.size} auth + ${THIRD_PARTY_SUFFIXES.length} third-party`);

  // Regex to match URLs
  const urlRegex = /(?:https?|wss?):\/\/([a-zA-Z0-9.-]+)(?::\d+)?/gi;

  for (const file of files) {
    // Skip markdown files (documentation) and test mock files
    if (file.rel.endsWith('.md') || file.rel.includes('test/') || file.rel.includes('mock') || file.rel.endsWith('.example') || file.rel.endsWith('invariants.json')) {
      continue;
    }

    let content = '';
    try {
      content = readFileSync(file.abs, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')) {
        continue;
      }

      // Check for URLs
      urlRegex.lastIndex = 0;
      let match;
      while ((match = urlRegex.exec(line)) !== null) {
        const fullUrl = match[0];
        const hostname = match[1].toLowerCase();

        // 1. Law 0: check localhost
        if (localhostPattern.test(hostname)) {
          const exemptLine = LAW0_EXEMPT_LINE.find(e => e.re.test(line));
          if (LAW0_EXEMPT_PATH.test(file.rel) || exemptLine) {
            law0Exempted.push({ file: file.rel, line: i + 1, why: exemptLine ? exemptLine.why : 'test-asserts-rejection' });
            continue;
          }
          if (!allowedLoopbackPattern.test(fullUrl)) {
            violations.push({
              type: 'LAW-0-VIOLATION',
              file: file.rel,
              line: i + 1,
              excerpt: line.trim(),
              message: `Literal localhost URL "${fullUrl}" detected (Law 0). Use env variables or Tailscale MagicDNS instead.`
            });
          }
          continue;
        }

        // 2. Allowed domain whitelist check
        const isAllowed = allowedDomainSuffixes.some(suffix => 
          hostname === suffix || hostname.endsWith(`.${suffix}`)
        );

        if (!isAllowed) {
          violations.push({
            type: 'UNAUTHORIZED-HOSTNAME-URL',
            file: file.rel,
            line: i + 1,
            excerpt: line.trim(),
            message: `URL "${fullUrl}" references an unauthorized or legacy domain hostname. Use the canonical production domain mapping.`
          });
        }
      }
    }
  }

  // Write results
  const reportDir = join(REPO_ROOT, 'docs', 'reports');
  const reportPath = join(reportDir, 'domain-hygiene-report.md');
  
  const mdReport = [];
  mdReport.push('<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->');
  mdReport.push('# HEADY™ Domain Hygiene & Law 0 Report');
  mdReport.push(`**Generated on:** ${new Date().toISOString()} · **Type:** Domain Hygiene Verification`);
  mdReport.push('');
  mdReport.push('---');
  mdReport.push('');
  mdReport.push('## 1. Compliance Summary');
  mdReport.push('');

  if (violations.length > 0) {
    mdReport.push(`### ✗ Non-Compliance Issues Found: **${violations.length}**`);
    mdReport.push('');
    mdReport.push(`Scope: authored configuration only — dependency metadata, virtualenvs, lockfiles and`);
    mdReport.push(`hashed build output are excluded, since no one authored those hostnames.`);
    mdReport.push(`Allowlist: ${headySuffixes.length} canon domains (derived from \`facts.yaml domains:\``);
    mdReport.push(`via \`${relative(REPO_ROOT, DOMAIN_ROSTER_PATH).split(sep).join('/')}\`) + ${authHosts.size} auth host(s) + ${THIRD_PARTY_SUFFIXES.length} approved third parties.`);
    mdReport.push('');

    // Lead with the shape of the problem: a flat 200-row table is not actionable.
    const byType = new Map();
    const byFile = new Map();
    for (const v of violations) {
      byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
      byFile.set(v.file, (byFile.get(v.file) ?? 0) + 1);
    }
    mdReport.push('#### By type');
    mdReport.push('| Type | Count |');
    mdReport.push('|---|---|');
    for (const [type, n] of [...byType].sort((a, b) => b[1] - a[1])) mdReport.push(`| \`${type}\` | ${n} |`);
    mdReport.push('');
    mdReport.push('#### Top files');
    mdReport.push('| File | Count |');
    mdReport.push('|---|---|');
    for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) mdReport.push(`| \`${file}\` | ${n} |`);
    mdReport.push('');
    if (law0Exempted.length > 0) {
      mdReport.push('#### Law 0 exemptions applied');
      mdReport.push('');
      mdReport.push('Loopback shapes where loopback is *correct*. Recorded, never silent —');
      mdReport.push('rationale in `docs/LAW0_LOOPBACK_TRIAGE_2026-08-22.md`.');
      mdReport.push('');
      mdReport.push('| File | Line | Reason |');
      mdReport.push('|---|---|---|');
      for (const e of law0Exempted) mdReport.push(`| \`${e.file}\` | ${e.line} | \`${e.why}\` |`);
      mdReport.push('');
    }
    mdReport.push('#### All findings');
    mdReport.push('| Type | File | Line | Excerpt | Message |');
    mdReport.push('|---|---|---|---|---|');
    for (const v of violations) {
      mdReport.push(`| \`${v.type}\` | \`${v.file}\` | ${v.line} | \`${v.excerpt.slice(0, 100)}\` | ${v.message} |`);
    }
  } else {
    mdReport.push('### ✅ Law 0 & Domain Hygiene Status: 100% compliant');
    mdReport.push('No hardcoded localhost references or legacy domain aliases found.');
  }

  writeFileSync(reportPath, mdReport.join('\n'), 'utf-8');
  console.log(`[DomainGuard] Wrote hygiene report to docs/reports/domain-hygiene-report.md`);
  console.log(`[DomainGuard] Law 0 exemptions applied: ${law0Exempted.length}`);
  console.log(`[DomainGuard] Finished. Violations found: ${violations.length}`);

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('[DomainGuard] Error:', err);
  process.exit(1);
});

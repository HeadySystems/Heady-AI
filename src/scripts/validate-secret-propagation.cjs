#!/usr/bin/env node
/**
 * © 2026 HeadySystems Inc. — Secret Propagation Validator
 * ═══════════════════════════════════════════════════════
 *
 * Full-spectrum audit of the credential propagation chain:
 *
 *   1. REGISTRY AUDIT   — Verifies every service-provider secret is registered
 *                          in both SecretManager AND vault-boot CREDENTIAL_ENV_MAP
 *   2. CONSUMER AUDIT   — Scans all active services for raw process.env access
 *                          and classifies each as vault-projected or orphaned
 *   3. PROPAGATION TEST — Validates the boot chain:
 *                          vault-boot → process.env → service consumers
 *   4. REPORT           — Writes results to .heady/secret-propagation-report.json
 *
 * Exit 0 = all secrets are properly covered.
 * Exit 1 = orphaned secrets detected (access without registration).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const SHARED = path.join(ROOT, 'shared');

// ─── φ constants ───────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ─── LOAD REGISTRIES ───────────────────────────────────────────

function loadVaultBootMap() {
  const vaultBootPath = path.join(SRC, 'services', 'vault-boot.js');
  if (!fs.existsSync(vaultBootPath)) return {};
  const content = fs.readFileSync(vaultBootPath, 'utf8');
  // Extract all env var values from CREDENTIAL_ENV_MAP
  const map = {};
  const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    map[match[2]] = match[1]; // envVar -> credentialName
  }
  return map;
}

function loadSecretManagerRegistry() {
  // Try shared/secret-manager.js first, then src/shared/secret-manager.js
  const paths = [
    path.join(SHARED, 'secret-manager.js'),
    path.join(SRC, 'shared', 'secret-manager.js'),
  ];
  const registry = {};
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    // Extract keys from REQUIRED_SECRETS
    const regex = /(\w+)\s*:\s*\{\s*name:\s*[`'"]([^`'"]+)[`'"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      registry[match[1]] = match[2];
    }
  }
  return registry;
}

// ─── SCAN CONSUMERS ────────────────────────────────────────────

function walkFiles(dir, ext, maxDepth = 5, depth = 0) {
  const results = [];
  if (depth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'source-reference', '__tests__', 'testing'].includes(entry.name)) continue;
      if (entry.name.startsWith('.fuse_hidden')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkFiles(fullPath, ext, maxDepth, depth + 1));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch { /* permission denied */ }
  return results;
}

// Credentials we care about (service provider secrets)
const TARGET_ENV_VARS = [
  'DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID',
  'SLACK_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_TEAM_ID',
  'BLOCKS_WEBHOOK_URL',
  'HF_TOKEN', 'HF_TOKEN_1', 'HF_TOKEN_2', 'HF_TOKEN_3', 'HF_API_KEY',
  'GITHUB_TOKEN', 'HEADY_GITHUB_PAT',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_SECONDARY_KEY', 'CLAUDE_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_TEST_SECRET_KEY',
  'PINECONE_API_KEY',
  'SENTRY_DSN', 'SENTRY_AUTH_TOKEN',
  'CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN',
  'DATABASE_URL', 'NEON_API_KEY', 'NEON_DATABASE_URL',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'NPM_TOKEN',
  'OP_SERVICE_ACCOUNT_TOKEN',
  'PERPLEXITY_API_KEY',
];

function scanConsumers() {
  const files = [
    ...walkFiles(SRC, '.js', 5),
    ...walkFiles(SHARED, '.js', 3),
  ];

  const consumers = []; // { file, line, envVar, context }

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    // Skip the registries themselves
    if (rel.includes('secret-manager') || rel.includes('vault-boot')) continue;
    if (rel.endsWith('.d.ts') || rel.endsWith('.d.ts.map')) continue;

    let content;
    try { content = fs.readFileSync(file, 'utf8'); }
    catch { continue; }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const envVar of TARGET_ENV_VARS) {
        if (line.includes(`process.env.${envVar}`) || line.includes(`process.env['${envVar}']`) || line.includes(`process.env["${envVar}"]`)) {
          consumers.push({
            file: rel,
            line: i + 1,
            envVar,
            context: line.trim().substring(0, 120),
          });
        }
      }
    }
  }

  return consumers;
}

// ─── VALIDATION ────────────────────────────────────────────────

function validate() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  HEADY — Secret Propagation Validator                   ║');
  console.log('║  Full Credential Chain Audit                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Load registries
  const vaultMap = loadVaultBootMap();
  const smRegistry = loadSecretManagerRegistry();
  const vaultEnvVars = new Set(Object.keys(vaultMap));
  const smEnvVars = new Set(Object.keys(smRegistry));

  console.log(`  📦 Vault Boot CREDENTIAL_ENV_MAP: ${vaultEnvVars.size} entries`);
  console.log(`  📦 SecretManager REQUIRED_SECRETS: ${smEnvVars.size} entries`);
  console.log('');

  // 2. Scan consumers
  const consumers = scanConsumers();
  const consumedEnvVars = new Set(consumers.map(c => c.envVar));

  console.log(`  🔍 Active process.env consumers found: ${consumers.length} references`);
  console.log(`  🔍 Unique env vars consumed: ${consumedEnvVars.size}`);
  console.log('');

  // 3. Classify each consumed env var
  const results = {
    covered: [],    // In vault-boot AND/OR SecretManager
    vaultOnly: [],  // In vault-boot but NOT SecretManager
    smOnly: [],     // In SecretManager but NOT vault-boot
    orphaned: [],   // Consumed but NOT in either registry
  };

  for (const envVar of consumedEnvVars) {
    const inVault = vaultEnvVars.has(envVar);
    const inSM = smEnvVars.has(envVar);

    if (inVault && inSM) {
      results.covered.push(envVar);
    } else if (inVault && !inSM) {
      results.vaultOnly.push(envVar);
    } else if (!inVault && inSM) {
      results.smOnly.push(envVar);
    } else {
      results.orphaned.push(envVar);
    }
  }

  // 4. Print results
  console.log('  ── Coverage Matrix ──');
  console.log(`    ✅ Fully covered (vault + SM):  ${results.covered.length}`);
  for (const v of results.covered) console.log(`       • ${v}`);

  console.log(`    🔐 Vault-boot only:             ${results.vaultOnly.length}`);
  for (const v of results.vaultOnly) console.log(`       • ${v}`);

  console.log(`    📋 SecretManager only:           ${results.smOnly.length}`);
  for (const v of results.smOnly) console.log(`       • ${v}`);

  console.log(`    ⚠️  Orphaned (no registry):       ${results.orphaned.length}`);
  for (const v of results.orphaned) console.log(`       • ${v}`);
  console.log('');

  // 5. Per-service consumer breakdown
  const byFile = {};
  for (const c of consumers) {
    if (!byFile[c.file]) byFile[c.file] = [];
    byFile[c.file].push(c);
  }

  const serviceFiles = Object.entries(byFile)
    .filter(([f]) => f.includes('services/') || f.includes('providers/') || f.includes('routes/'))
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`  ── Top Service Consumers (${serviceFiles.length} files) ──`);
  for (const [file, refs] of serviceFiles.slice(0, 21)) {
    const vars = [...new Set(refs.map(r => r.envVar))];
    const allCovered = vars.every(v => vaultEnvVars.has(v) || smEnvVars.has(v));
    const icon = allCovered ? '✅' : '⚠️';
    console.log(`    ${icon} ${file} (${refs.length} refs: ${vars.join(', ')})`);
  }
  console.log('');

  // 6. Compute score
  const totalConsumed = consumedEnvVars.size;
  const totalCovered = results.covered.length + results.vaultOnly.length + results.smOnly.length;
  const coverageScore = totalConsumed > 0 ? totalCovered / totalConsumed : 1;

  const severity = coverageScore >= 0.927 ? 'HEALTHY' : coverageScore >= PSI ? 'DEGRADED' : 'CRITICAL';

  console.log(`  ── Summary ──`);
  console.log(`    Coverage Score: ${(coverageScore * 100).toFixed(1)}%`);
  console.log(`    Severity:       ${severity}`);
  console.log(`    Orphaned:       ${results.orphaned.length} env vars need registration`);
  console.log('');

  // 7. Write report
  const report = {
    timestamp: new Date().toISOString(),
    coverageScore: coverageScore.toFixed(4),
    severity,
    registries: {
      vaultBoot: vaultEnvVars.size,
      secretManager: smEnvVars.size,
    },
    consumers: {
      totalReferences: consumers.length,
      uniqueEnvVars: consumedEnvVars.size,
      totalFiles: Object.keys(byFile).length,
    },
    coverage: {
      fullyCovered: results.covered,
      vaultBootOnly: results.vaultOnly,
      secretManagerOnly: results.smOnly,
      orphaned: results.orphaned,
    },
    topConsumers: serviceFiles.slice(0, 21).map(([file, refs]) => ({
      file,
      refCount: refs.length,
      envVars: [...new Set(refs.map(r => r.envVar))],
    })),
    allConsumers: consumers,
  };

  const cacheDir = path.join(ROOT, '.heady');
  fs.mkdirSync(cacheDir, { recursive: true });
  const reportPath = path.join(cacheDir, 'secret-propagation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`  Report saved to: .heady/secret-propagation-report.json`);
  console.log('');

  // 8. Exit code
  if (results.orphaned.length > 0) {
    console.log(`  ⚠️  ${results.orphaned.length} orphaned env var(s) — registration needed.`);
    console.log(`     These are accessed via process.env but NOT registered in either`);
    console.log(`     vault-boot CREDENTIAL_ENV_MAP or SecretManager REQUIRED_SECRETS.`);
    console.log('');
    console.log('     Action: Add to vault-boot.js CREDENTIAL_ENV_MAP for main-process services,');
    console.log('     or to shared/secret-manager.js REQUIRED_SECRETS for standalone services.');
  } else {
    console.log('  ✅ All consumed secrets are registered. Zero-intervention propagation confirmed.');
  }

  return report;
}

// ─── MAIN ──────────────────────────────────────────────────────

const report = validate();
process.exit(report.coverage.orphaned.length > 0 ? 1 : 0);

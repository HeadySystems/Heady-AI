#!/usr/bin/env node
/**
 * pqc-report-pr.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Heady™ PQC Sentinel — PR comment reporter
 *
 * Reads /tmp/pqc-scan-report.json and posts a formatted compliance finding
 * comment to the pull request. Updates (replaces) any existing PQC Sentinel
 * comment to keep the thread clean on re-push.
 *
 * Called by: .github/workflows/adr-sentinel.yml — pqc-report job
 * ──────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER    = process.env.PR_NUMBER;
const REPO         = process.env.GITHUB_REPOSITORY ?? 'HeadySystems/heady-ai';
const REPORT_PATH  = process.env.REPORT_PATH ?? '/tmp/pqc-scan-report.json';
const COMMIT_SHA   = process.env.COMMIT_SHA ?? 'unknown';
const PR_AUTHOR    = process.env.PR_AUTHOR  ?? 'contributor';
const ADR_BASE     = `https://github.com/${REPO}/blob/main/docs/ADR`;

const SENTINEL_TAG = '<!-- heady-pqc-sentinel -->';
const API_BASE     = `https://api.github.com/repos/${REPO}`;

// Severity icons and ordering
const ICON = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', INFO: 'ℹ️' };

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function ghFetch(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function upsertComment(prNum, body) {
  const comments = await ghFetch(`/issues/${prNum}/comments?per_page=100`);
  const existing = comments.find(c => c.body?.includes(SENTINEL_TAG));
  if (existing) {
    await ghFetch(`/issues/comments/${existing.id}`, 'PATCH', { body });
    console.log(`Updated PQC Sentinel comment #${existing.id} on PR #${prNum}`);
  } else {
    await ghFetch(`/issues/${prNum}/comments`, 'POST', { body });
    console.log(`Posted new PQC Sentinel comment on PR #${prNum}`);
  }
}

// ─── Comment builders ─────────────────────────────────────────────────────────

function buildCleanComment(report) {
  const lines = [
    SENTINEL_TAG,
    '## ✅ PQC Sentinel — No Cryptographic Compliance Issues',
    '',
    `> Commit \`${COMMIT_SHA.slice(0, 8)}\` · ${report.files_scanned} files scanned · [ADR-0021](${ADR_BASE}/0021-post-quantum-cryptography-mandate.md)`,
    '',
    `| Category | Count |`,
    `|----------|-------|`,
    `| 🔴 CRITICAL | 0 |`,
    `| 🟠 HIGH | 0 |`,
    `| 🟡 MEDIUM | ${report.medium} |`,
    `| ℹ️  INFO | ${report.info} |`,
    '',
  ];

  if (report.medium > 0) {
    const medium = report.findings.filter(f => f.severity === 'MEDIUM');
    lines.push('### 🟡 Medium Findings (non-blocking — action recommended)');
    lines.push('');
    lines.push('| Rule | File | Line | Issue | Fix |');
    lines.push('|------|------|------|-------|-----|');
    for (const f of medium) {
      lines.push(`| \`${f.ruleId}\` | \`${f.file}\` | ${f.line} | ${f.title} | ${f.fix ?? '—'} |`);
    }
    lines.push('');
  }

  if (report.info > 0) {
    lines.push('<details><summary>ℹ️ INFO findings (inventory only)</summary>');
    lines.push('');
    const info = report.findings.filter(f => f.severity === 'INFO');
    for (const f of info) {
      lines.push(`- \`${f.ruleId}\` \`${f.file}:${f.line}\` — ${f.title}`);
    }
    lines.push('</details>');
    lines.push('');
  }

  lines.push(`---\n_PQC Sentinel enforced by [ADR-0021](${ADR_BASE}/0021-post-quantum-cryptography-mandate.md)_`);
  return lines.join('\n');
}

function buildFailedComment(report) {
  const critical = report.findings.filter(f => f.severity === 'CRITICAL');
  const high     = report.findings.filter(f => f.severity === 'HIGH');
  const medium   = report.findings.filter(f => f.severity === 'MEDIUM');
  const info     = report.findings.filter(f => f.severity === 'INFO');

  const lines = [
    SENTINEL_TAG,
    '## ❌ PQC Sentinel — Cryptographic Compliance Violations',
    '',
    `> @${PR_AUTHOR} — this PR introduces cryptographic patterns prohibited by **ADR-0021** (Post-Quantum Cryptography Mandate).`,
    `> Commit \`${COMMIT_SHA.slice(0, 8)}\` · ${report.files_scanned} files scanned`,
    '',
    '**The build is blocked.** All CRITICAL and HIGH findings must be resolved before merge.',
    '',
    '| Severity | Count | Blocks merge? |',
    '|----------|-------|--------------|',
    `| 🔴 CRITICAL | ${critical.length} | Yes |`,
    `| 🟠 HIGH | ${high.length} | Yes |`,
    `| 🟡 MEDIUM | ${medium.length} | No (warning) |`,
    `| ℹ️  INFO | ${info.length} | No |`,
    '',
    '---',
    '',
  ];

  if (critical.length > 0) {
    lines.push('### 🔴 CRITICAL — Classical Asymmetric Crypto (Broken by Shor\'s Algorithm)');
    lines.push('');
    lines.push('These algorithms are unconditionally broken by a cryptographically relevant quantum computer.');
    lines.push('');
    lines.push('| Rule | File | Line | Algorithm Found | Required Fix |');
    lines.push('|------|------|------|----------------|-------------|');
    for (const f of critical) {
      const fileLink = `[\`${f.file}:${f.line}\`](https://github.com/${REPO}/blob/main/${f.file}#L${f.line})`;
      lines.push(`| \`${f.ruleId}\` | ${fileLink} | ${f.line} | ${f.title} | \`${f.fix}\` |`);
    }
    lines.push('');
    lines.push('<details><summary>Show code snippets</summary>');
    lines.push('');
    for (const f of critical) {
      lines.push(`**\`${f.file}:${f.line}\`** — ${f.title}`);
      lines.push('```js');
      lines.push(f.snippet);
      lines.push('```');
      lines.push(`> ${f.detail}`);
      lines.push(`> **Fix:** \`${f.fix}\``);
      lines.push('');
    }
    lines.push('</details>');
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('### 🟠 HIGH — Pre-NIST Algorithm Names (Must Align to FIPS 203/204/205)');
    lines.push('');
    lines.push('CRYSTALS-Kyber → **ML-KEM** (FIPS 203) · CRYSTALS-Dilithium → **ML-DSA** (FIPS 204) · SPHINCS+ → **SLH-DSA** (FIPS 205)');
    lines.push('');
    lines.push('| Rule | File | Line | Found | Rename To |');
    lines.push('|------|------|------|-------|----------|');
    for (const f of high) {
      const fileLink = `[\`${f.file}:${f.line}\`](https://github.com/${REPO}/blob/main/${f.file}#L${f.line})`;
      lines.push(`| \`${f.ruleId}\` | ${fileLink} | ${f.line} | ${f.title} | ${f.fix} |`);
    }
    lines.push('');
  }

  if (medium.length > 0) {
    lines.push('### 🟡 MEDIUM — Unauthenticated Modes / Weak Algorithms (Non-blocking, Action Recommended)');
    lines.push('');
    lines.push('| Rule | File | Line | Issue | Fix |');
    lines.push('|------|------|------|-------|-----|');
    for (const f of medium) {
      const fileLink = `[\`${f.file}:${f.line}\`](https://github.com/${REPO}/blob/main/${f.file}#L${f.line})`;
      lines.push(`| \`${f.ruleId}\` | ${fileLink} | ${f.line} | ${f.title} | ${f.fix ?? '—'} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('### How to fix CRITICAL/HIGH findings');
  lines.push('');
  lines.push('**Replace RSA / ECDSA / ECDH with Heady hybrid PQC:**');
  lines.push('```js');
  lines.push('// Signatures — Ed25519 + ML-DSA composite');
  lines.push('import { hybridSign } from \'./src/security/pqc.js\';');
  lines.push('const signature = await hybridSign.sign(message, privateKey);');
  lines.push('');
  lines.push('// Key exchange — X25519 + ML-KEM-768 composite');
  lines.push('import { hybridKEM } from \'./src/security/pqc.js\';');
  lines.push('const { ciphertext, sharedSecret } = await hybridKEM.encapsulate(recipientPublicKey);');
  lines.push('');
  lines.push('// Key generation');
  lines.push('import { headyPQC } from \'./src/security/pqc.js\';');
  lines.push('const keyPair = headyPQC.generateHybridKeyPair(serviceId);');
  lines.push('```');
  lines.push('');
  lines.push('**To exempt a line** (test fixtures, vendor code within the repo):');
  lines.push('```js');
  lines.push('const ecdh = createECDH(\'prime256v1\'); // PQC-EXEMPT: vendor test vector, not production path');
  lines.push('```');
  lines.push('');
  lines.push('**Pre-NIST renames** — update algorithm ID strings in `src/security/pqc.js` `PQC_CONFIG`:');
  lines.push('```js');
  lines.push('// Before');
  lines.push('kem: { algorithm: \'CRYSTALS-Kyber\', variant: \'Kyber768\' }');
  lines.push('// After');
  lines.push('kem: { algorithm: \'ML-KEM\', variant: \'ML-KEM-768\' }  // FIPS 203');
  lines.push('');
  lines.push('// Before');
  lines.push('signature: { algorithm: \'CRYSTALS-Dilithium\', variant: \'Dilithium3\' }');
  lines.push('// After');
  lines.push('signature: { algorithm: \'ML-DSA\', variant: \'ML-DSA-65\' }  // FIPS 204');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push(`_PQC Sentinel enforced by [ADR-0021](${ADR_BASE}/0021-post-quantum-cryptography-mandate.md) · [PQC Compliance Brief](https://github.com/${REPO}/blob/main/docs/PQC-COMPLIANCE-BRIEF.md)_`);

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN not set'); process.exit(1); }
if (!PR_NUMBER)    { console.log('PR_NUMBER not set — skipping comment'); process.exit(0); }
if (!fs.existsSync(REPORT_PATH)) { console.error(`Report not found: ${REPORT_PATH}`); process.exit(1); }

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const body = report.gate_passed ? buildCleanComment(report) : buildFailedComment(report);

await upsertComment(PR_NUMBER, body);

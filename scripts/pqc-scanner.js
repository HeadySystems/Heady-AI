#!/usr/bin/env node
/**
 * pqc-scanner.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Heady™ PQC Static Analysis Scanner
 * Compliance authority: ADR-0021 (Post-Quantum Cryptography Mandate)
 *
 * Crawls the repository for legacy cryptographic primitives that are prohibited
 * by ADR-0021 and reports them as compliance findings. Distinguishes:
 *
 *   CRITICAL  — Net-new code introducing classical-only asymmetric crypto
 *               (RSA, ECDSA, ECDH, DSA). Blocks the build.
 *   HIGH      — Pre-NIST algorithm names still in active code (Kyber, Dilithium,
 *               CRYSTALS) that should be renamed to ML-KEM / ML-DSA / ML-DSA.
 *               Blocks the build.
 *   MEDIUM    — Unauthenticated symmetric modes (AES-CBC, AES-ECB), weak hashes
 *               (MD5, SHA-1), or 128-bit keys. Does not block; requires comment.
 *   INFO      — Deprecated but not actively harmful patterns. Informational only.
 *
 * Exit codes:
 *   0  — Clean / only INFO findings
 *   1  — CRITICAL or HIGH findings present (build blocked)
 *   2  — MEDIUM findings present (warning, not blocked unless --strict)
 *
 * Usage:
 *   node scripts/pqc-scanner.js [--strict] [--path <dir>] [--changed-only <files>]
 *
 * Called by: .github/workflows/adr-sentinel.yml — pqc-scan job
 * ──────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// ─── CLI ARGS ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const STRICT_MODE  = args.includes('--strict');
const SCAN_PATH    = args[args.indexOf('--path') + 1] ?? '.';
const CHANGED_ONLY = args.includes('--changed-only')
  ? args[args.indexOf('--changed-only') + 1]?.split(',').filter(Boolean) ?? []
  : [];

const REPORT_PATH = '/tmp/pqc-scan-report.json';

// ─── FINDING RULES ───────────────────────────────────────────────────────────
// Each rule:
//   pattern   RegExp  — matched against file content lines
//   severity  CRITICAL | HIGH | MEDIUM | INFO
//   id        string  — short unique rule ID for deduplication
//   title     string  — human summary
//   detail    string  — explanation and fix guidance
//   adrRef    string  — which ADR section applies
//   fix       string  — canonical replacement

const RULES = [
  // ── CRITICAL: classical asymmetric — broken by Shor's algorithm ─────────────
  {
    id: 'PQC-C001',
    severity: 'CRITICAL',
    pattern: /\bcreateDiffieHellman\b|\bcreateDiffieHellmanGroup\b|\bDiffieHellman\b/,
    title: 'Classical Diffie-Hellman key exchange',
    detail: 'DH/DHE is broken by Shor\'s algorithm. Replace with ML-KEM-768 hybrid KEM.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'hybridKEM.encapsulate() from src/security/pqc.js',
  },
  {
    id: 'PQC-C002',
    severity: 'CRITICAL',
    pattern: /\bcreateECDH\b|\bECDH\b(?!\s*\/\/\s*PQC-HYBRID)/,
    title: 'ECDH key exchange (classical-only)',
    detail: 'ECDH alone is broken by Shor\'s algorithm. Hybrid X25519+ML-KEM is required.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'hybridKEM from src/security/pqc.js (wraps X25519+ML-KEM composite)',
  },
  {
    id: 'PQC-C003',
    severity: 'CRITICAL',
    pattern: /['"]rsa['"]\s*[:=]|algorithm\s*[:=]\s*['"]RS[A-Z0-9]+['"]|createSign\s*\(\s*['"]RSA/i,
    title: 'RSA signature or key operation',
    detail: 'RSA is broken by Shor\'s algorithm at any key size. Replace with ML-DSA (Dilithium3) hybrid.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'hybridSign.sign() from src/security/pqc.js',
  },
  {
    id: 'PQC-C004',
    severity: 'CRITICAL',
    pattern: /generateKeyPair\s*\(\s*['"]rsa['"]/i,
    title: 'RSA key pair generation',
    detail: 'RSA key generation produces keys that will be broken by a CRQC. Use ML-DSA hybrid keypairs.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'headyPQC.generateHybridKeyPair() from src/security/pqc.js',
  },
  {
    id: 'PQC-C005',
    severity: 'CRITICAL',
    pattern: /generateKeyPair\s*\(\s*['"]ec['"]/i,
    title: 'EC key pair generation (classical-only)',
    detail: 'Classical EC key pairs are quantum-vulnerable. Use ML-DSA hybrid keypairs.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'headyPQC.generateHybridKeyPair() from src/security/pqc.js',
  },
  {
    id: 'PQC-C006',
    severity: 'CRITICAL',
    pattern: /algorithm\s*[:=]\s*['"]ES(?:256|384|512)['"]/,
    title: 'ECDSA JWT algorithm (ES256/ES384/ES512)',
    detail: 'ECDSA-based JWT algorithms are quantum-vulnerable. Migrate to ML-DSA composite JWT.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Use HS256 (HMAC-SHA256) for symmetric JWT or ML-DSA composite for asymmetric.',
  },
  {
    id: 'PQC-C007',
    severity: 'CRITICAL',
    pattern: /algorithm\s*[:=]\s*['"]RS(?:256|384|512)['"]/,
    title: 'RSA JWT algorithm (RS256/RS384/RS512)',
    detail: 'RSA-based JWT algorithms are quantum-vulnerable.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Use HS256 (HMAC-SHA256) for symmetric JWT.',
  },

  // ── HIGH: pre-NIST algorithm names in active code ──────────────────────────
  {
    id: 'PQC-H001',
    severity: 'HIGH',
    pattern: /\bCRYSTALS[_-]Kyber\b|\bKyber(?:512|768|1024)\b/i,
    title: 'Pre-NIST name: CRYSTALS-Kyber',
    detail: 'CRYSTALS-Kyber was standardised as ML-KEM (FIPS 203). Update algorithm IDs to ML-KEM-512/768/1024.',
    adrRef: 'ADR-0021 §Approved Algorithm Registry',
    fix: 'Rename to ML-KEM-768 (NIST Security Level 3)',
  },
  {
    id: 'PQC-H002',
    severity: 'HIGH',
    pattern: /\bCRYSTALS[_-]Dilithium\b|\bDilithium[235]\b/i,
    title: 'Pre-NIST name: CRYSTALS-Dilithium',
    detail: 'CRYSTALS-Dilithium was standardised as ML-DSA (FIPS 204). Update algorithm IDs to ML-DSA-44/65/87.',
    adrRef: 'ADR-0021 §Approved Algorithm Registry',
    fix: 'Rename to ML-DSA-65 (NIST Security Level 3)',
  },
  {
    id: 'PQC-H003',
    severity: 'HIGH',
    pattern: /\bSPHINCS\+?\b|\bSPHINCSPlus\b/i,
    title: 'Pre-NIST name: SPHINCS+',
    detail: 'SPHINCS+ was standardised as SLH-DSA (FIPS 205). Update to SLH-DSA-SHAKE-256s.',
    adrRef: 'ADR-0021 §Approved Algorithm Registry',
    fix: 'Rename to SLH-DSA-SHAKE-256s (long-lived certificates only)',
  },
  {
    id: 'PQC-H004',
    severity: 'HIGH',
    pattern: /hybridMode\s*[:=]\s*false/,
    title: 'Hybrid mode explicitly disabled',
    detail: 'ADR-0021 mandates hybrid mode for all asymmetric operations. hybridMode: false is prohibited.',
    adrRef: 'ADR-0021 §Hybrid Mode Requirement',
    fix: 'Set hybridMode: true in PQC_CONFIG',
  },

  // ── MEDIUM: unauthenticated symmetric / weak configs ───────────────────────
  {
    id: 'PQC-M001',
    severity: 'MEDIUM',
    pattern: /['"]aes-(?:128|192|256)-cbc['"]/i,
    title: 'AES-CBC mode (unauthenticated)',
    detail: 'CBC mode provides no authentication — vulnerable to padding oracle attacks. Use AES-256-GCM.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Replace with aes-256-gcm (authenticated encryption)',
  },
  {
    id: 'PQC-M002',
    severity: 'MEDIUM',
    pattern: /['"]aes-(?:128|192|256)-ecb['"]/i,
    title: 'AES-ECB mode (deterministic, insecure)',
    detail: 'ECB mode is always prohibited — identical plaintext blocks produce identical ciphertext.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Replace with aes-256-gcm',
  },
  {
    id: 'PQC-M003',
    severity: 'MEDIUM',
    pattern: /['"]aes-128-/i,
    title: 'AES-128 key size',
    detail: 'Grover\'s algorithm halves symmetric key strength. AES-128 = 64-bit post-quantum security. Use AES-256.',
    adrRef: 'ADR-0021 §Approved Algorithms — AES-256-GCM',
    fix: 'Replace with aes-256-gcm',
  },
  {
    id: 'PQC-M004',
    severity: 'MEDIUM',
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/i,
    title: 'MD5 hash function',
    detail: 'MD5 is cryptographically broken (collision attacks since 2004). Use SHA-3-256 or BLAKE3.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'createHash(\'sha3-256\') or import BLAKE3',
  },
  {
    id: 'PQC-M005',
    severity: 'MEDIUM',
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/i,
    title: 'SHA-1 hash function',
    detail: 'SHA-1 is collision-weak (SHAttered 2017). Use SHA-256 minimum; prefer SHA-3-256.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'createHash(\'sha3-256\')',
  },
  {
    id: 'PQC-M006',
    severity: 'MEDIUM',
    pattern: /['"]des\b|['"]3des\b|['"]des-ede/i,
    title: 'DES or 3DES cipher',
    detail: 'DES is 56-bit (trivially brute-forced). 3DES has Sweet32 vulnerability. Both deprecated.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Replace with aes-256-gcm',
  },
  {
    id: 'PQC-M007',
    severity: 'MEDIUM',
    pattern: /['"]rc4['"]/i,
    title: 'RC4 stream cipher',
    detail: 'RC4 is broken — statistical biases allow key recovery. Prohibited.',
    adrRef: 'ADR-0021 §Prohibited Algorithms',
    fix: 'Replace with aes-256-gcm',
  },

  // ── INFO: patterns worth tracking but not blocking ─────────────────────────
  {
    id: 'PQC-I001',
    severity: 'INFO',
    pattern: /createHmac\s*\(\s*['"]sha256['"]/,
    title: 'HMAC-SHA256 (quantum-safe, audit only)',
    detail: 'HMAC-SHA256 is quantum-safe (symmetric). Flagged for inventory only — no action required.',
    adrRef: 'ADR-0021 §Exemptions',
    fix: null,
  },
  {
    id: 'PQC-I002',
    severity: 'INFO',
    pattern: /x25519|X25519/,
    title: 'X25519 key exchange (approved as hybrid component only)',
    detail: 'X25519 alone is quantum-vulnerable. Ensure it is paired with ML-KEM in hybrid mode.',
    adrRef: 'ADR-0021 §Approved Algorithms — hybrid KEM',
    fix: 'Verify hybridKEM wraps X25519+ML-KEM, not X25519 alone',
  },
  {
    id: 'PQC-I003',
    severity: 'INFO',
    pattern: /ed25519|Ed25519/,
    title: 'Ed25519 signing (approved as hybrid component only)',
    detail: 'Ed25519 alone is quantum-vulnerable. Ensure it is paired with ML-DSA in hybrid mode.',
    adrRef: 'ADR-0021 §Approved Algorithms — hybrid signature',
    fix: 'Verify hybridSign wraps Ed25519+ML-DSA, not Ed25519 alone',
  },
];

// ─── EXEMPTIONS ───────────────────────────────────────────────────────────────
// Files and dirs that are out of scope for PQC scanning

const EXEMPT_PATHS = [
  '_archive',
  'node_modules',
  '.pnpm-store',
  'dist',
  'build',
  '.git',
  'coverage',
  'vendor',
];

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.mts',
  '.json', '.yaml', '.yml', '.env.example',
]);

// Inline exemption comment — any line containing this is skipped
const INLINE_EXEMPT_TAG = 'PQC-EXEMPT';

// ─── FILE WALKER ─────────────────────────────────────────────────────────────

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (EXEMPT_PATHS.some(ex => full.includes(path.sep + ex + path.sep) || full.endsWith(path.sep + ex))) {
      continue;
    }
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

function filesToScan(basePath) {
  if (CHANGED_ONLY.length > 0) {
    // PR diff mode: only scan the changed files
    return CHANGED_ONLY
      .map(f => path.resolve(f))
      .filter(f => fs.existsSync(f) && SCAN_EXTENSIONS.has(path.extname(f)));
  }
  return [...walkFiles(path.resolve(basePath))];
}

// ─── SCANNER ─────────────────────────────────────────────────────────────────

function scanFile(filePath) {
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return findings;
  }

  const lines = content.split('\n');
  const relPath = path.relative(process.cwd(), filePath);

  // Per-file: check if entire file is exempt via header comment
  if (content.includes(`// ${INLINE_EXEMPT_TAG}:`) && lines[0]?.includes(INLINE_EXEMPT_TAG)) {
    return findings;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip inline-exempted lines
    if (line.includes(INLINE_EXEMPT_TAG)) continue;
    // Skip comment-only lines (best-effort; not a full AST parse)
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
    // Skip blank lines
    if (line.trim() === '') continue;

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        // Extract snippet (trim whitespace, cap at 120 chars)
        const snippet = line.trim().slice(0, 120);
        // Deduplicate: same rule + same file + same line
        const dedupKey = createHash('sha256')
          .update(`${rule.id}:${relPath}:${lineNum}`)
          .digest('hex')
          .slice(0, 8);

        findings.push({
          ruleId:   rule.id,
          severity: rule.severity,
          title:    rule.title,
          detail:   rule.detail,
          adrRef:   rule.adrRef,
          fix:      rule.fix,
          file:     relPath,
          line:     lineNum,
          snippet,
          dedupKey,
        });
      }
    }
  }

  return findings;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const files = filesToScan(SCAN_PATH);
const allFindings = [];

for (const file of files) {
  allFindings.push(...scanFile(file));
}

// Group by severity
const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], INFO: [] };
for (const f of allFindings) bySeverity[f.severity].push(f);

const report = {
  timestamp:      new Date().toISOString(),
  commit_sha:     process.env.GITHUB_SHA ?? 'local',
  pr_number:      process.env.PR_NUMBER ?? null,
  repository:     process.env.GITHUB_REPOSITORY ?? 'HeadySystems/heady-ai',
  adr_ref:        'ADR-0021',
  scan_mode:      CHANGED_ONLY.length > 0 ? 'pr-diff' : 'full',
  files_scanned:  files.length,
  total_findings: allFindings.length,
  critical:       bySeverity.CRITICAL.length,
  high:           bySeverity.HIGH.length,
  medium:         bySeverity.MEDIUM.length,
  info:           bySeverity.INFO.length,
  gate_passed:    bySeverity.CRITICAL.length === 0 && bySeverity.HIGH.length === 0,
  strict_failed:  STRICT_MODE && bySeverity.MEDIUM.length > 0,
  findings:       allFindings,
};

// Write report
fs.mkdirSync('/tmp', { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

// GitHub Actions outputs
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  fs.appendFileSync(outputFile, `gate_passed=${report.gate_passed}\n`);
  fs.appendFileSync(outputFile, `critical=${report.critical}\n`);
  fs.appendFileSync(outputFile, `high=${report.high}\n`);
  fs.appendFileSync(outputFile, `medium=${report.medium}\n`);
  fs.appendFileSync(outputFile, `report_path=${REPORT_PATH}\n`);
}

// GitHub Step Summary
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const lines = [
    '## PQC Compliance Scan — ADR-0021',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Files scanned | ${report.files_scanned} |`,
    `| CRITICAL (build blocks) | ${report.critical} |`,
    `| HIGH (build blocks) | ${report.high} |`,
    `| MEDIUM (warnings) | ${report.medium} |`,
    `| INFO (inventory) | ${report.info} |`,
    `| Gate | ${report.gate_passed ? '✅ PASSED' : '❌ FAILED'} |`,
    '',
  ];

  if (bySeverity.CRITICAL.length > 0) {
    lines.push('### ❌ CRITICAL Findings');
    for (const f of bySeverity.CRITICAL) {
      lines.push(`- **${f.ruleId}** \`${f.file}:${f.line}\` — ${f.title}`);
      lines.push(`  > ${f.snippet}`);
    }
    lines.push('');
  }

  if (bySeverity.HIGH.length > 0) {
    lines.push('### 🔴 HIGH Findings');
    for (const f of bySeverity.HIGH) {
      lines.push(`- **${f.ruleId}** \`${f.file}:${f.line}\` — ${f.title}`);
    }
    lines.push('');
  }

  fs.appendFileSync(summaryFile, lines.join('\n'));
}

// Structured gate summary (glass-box: JSON lines on stdout, no console.*)
const logLine = (level, msg, fields = {}) => process.stdout.write(`${JSON.stringify({ t: 'pqc-scanner', level, msg, ...fields })}\n`);
logLine(report.gate_passed ? 'info' : 'error', 'pqc scan complete', {
  files: report.files_scanned, findings: report.total_findings,
  critical: report.critical, high: report.high, medium: report.medium, info: report.info,
  gate: report.gate_passed ? 'PASSED' : 'FAILED',
});
for (const f of [...bySeverity.CRITICAL, ...bySeverity.HIGH]) {
  logLine('error', 'pqc blocking finding', { severity: f.severity, ruleId: f.ruleId, file: f.file, line: f.line, title: f.title, fix: f.fix });
}

// Exit code
if (!report.gate_passed) process.exit(1);
if (STRICT_MODE && report.strict_failed) process.exit(2);
process.exit(0);

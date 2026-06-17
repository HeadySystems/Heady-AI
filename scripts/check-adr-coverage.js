#!/usr/bin/env node
/**
 * check-adr-coverage.js
 * ──────────────────────────────────────────────────────────────────
 * ADR Sentinel — coverage verification script.
 *
 * Reads the list of changed architectural files from env vars,
 * scans docs/ADR/ for ADRs that reference those files,
 * and writes a coverage report to /tmp/adr-coverage-report.json.
 *
 * Exits 0  → all changed files are covered by at least one ADR
 * Exits 1  → one or more changed files lack ADR coverage
 *
 * Called by: .github/workflows/adr-sentinel.yml — verify-adr-coverage job
 * ──────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const ADR_DIR = process.env.ADR_DIR ?? 'docs/ADR';
const REPORT_PATH = '/tmp/adr-coverage-report.json';

/**
 * MONITORED_FILES maps each tracked file path to:
 *   - adrKeywords: strings that must appear in an ADR to count as coverage
 *   - category: human label for the PR report
 *   - severity: 'blocking' | 'warning'
 */
const MONITORED_FILES = {
  // ── Service manifests ──────────────────────────────────────────
  'configs/liquid-microservice-architecture.yaml': {
    category: 'Service Manifest',
    severity: 'blocking',
    adrKeywords: ['liquid', 'microservice', 'liquid node', 'service mesh', 'EventSpine'],
  },
  'configs/domain-architecture.yaml': {
    category: 'Domain Architecture',
    severity: 'blocking',
    adrKeywords: ['domain', 'brand architecture', '9-domain', 'nonprofit', 'headyconnection'],
  },
  'configs/heady-cognitive-config.json': {
    category: 'Cognitive Config',
    severity: 'blocking',
    adrKeywords: ['cognitive', 'capacity', '6765', 'fib(20)', 'ceiling'],
  },
  'configs/data-schema.yaml': {
    category: 'Data Schema',
    severity: 'blocking',
    adrKeywords: ['data schema', 'vector memory', 'pgvector', 'neon', 'data layer'],
  },
  'configs/governance/content-provenance-schema.json': {
    category: 'Governance Schema',
    severity: 'blocking',
    adrKeywords: ['governance', 'provenance', 'oracle chain', 'receipt', 'audit'],
  },
  'BUNDLE_MANIFEST.json': {
    category: 'Build Manifest',
    severity: 'warning',
    adrKeywords: ['bundle', 'asset pipeline', 'sbom', 'build'],
  },
  'HeadySystems_v13/packages/heady-core/package.json': {
    category: 'Core Package',
    severity: 'blocking',
    adrKeywords: ['core', 'esm', 'node.js', 'module', 'package'],
  },
  // ── Database schemas ───────────────────────────────────────────
  '_archive/db/schema.sql': {
    category: 'Database Schema',
    severity: 'blocking',
    adrKeywords: ['pgvector', 'neon', 'postgres', 'vector', 'schema'],
  },
  'audit/loose-configs/schema.prisma': {
    category: 'Prisma Schema',
    severity: 'blocking',
    adrKeywords: ['postgres', 'neon', 'database', 'schema', 'prisma'],
  },
  // ── Core orchestration modules ─────────────────────────────────
  'src/pipeline/pipeline-core.js': {
    category: 'Pipeline Core',
    severity: 'blocking',
    adrKeywords: ['pipeline', '21-stage', 'hcfullpipeline', 'stage', 'canonical'],
  },
  'src/orchestration/swarm-consensus.js': {
    category: 'Swarm Orchestration',
    severity: 'blocking',
    adrKeywords: ['swarm', 'consensus', 'bee', 'orchestration'],
  },
  'src/orchestration/buddy-watchdog.js': {
    category: 'Buddy Watchdog',
    severity: 'warning',
    adrKeywords: ['buddy', 'watchdog', 'hallucination'],
  },
  'src/resilience/circuit-breaker.js': {
    category: 'Circuit Breaker',
    severity: 'warning',
    adrKeywords: ['circuit breaker', 'resilience', 'half-open', 'failover'],
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Read all ADR markdown files and return their content indexed by filename */
function loadADRs(adrDir) {
  const adrs = {};
  if (!fs.existsSync(adrDir)) return adrs;

  const files = fs.readdirSync(adrDir).filter(f =>
    f.match(/^\d{4}-.*\.md$/)
  );

  for (const file of files) {
    const fullPath = path.join(adrDir, file);
    const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();
    adrs[file] = { content, path: fullPath, url: `${ADR_DIR}/${file}` };
  }
  return adrs;
}

/** Parse changed files from space-separated env string */
function parseChangedFiles(envVar) {
  return (envVar ?? '').split(/\s+/).filter(Boolean);
}

/** Check if an ADR covers a given file by keyword matching */
function findCoveringADRs(file, adrs) {
  const spec = MONITORED_FILES[file];
  if (!spec) return [];

  const covering = [];
  for (const [adrFile, adr] of Object.entries(adrs)) {
    // ADR covers this file if it mentions the file path OR any of its keywords
    if (
      adr.content.includes(file.toLowerCase()) ||
      spec.adrKeywords.some(kw => adr.content.includes(kw.toLowerCase()))
    ) {
      covering.push({ file: adrFile, url: adr.url });
    }
  }
  return covering;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const changedFiles = [
  ...parseChangedFiles(process.env.CHANGED_MANIFESTS),
  ...parseChangedFiles(process.env.CHANGED_SCHEMAS),
  ...parseChangedFiles(process.env.CHANGED_CORE),
];

const adrs = loadADRs(ADR_DIR);
const adrCount = Object.keys(adrs).length;

const results = {
  timestamp: new Date().toISOString(),
  pr_number: process.env.PR_NUMBER ?? 'unknown',
  commit_sha: process.env.GITHUB_SHA ?? 'unknown',
  repository: process.env.GITHUB_REPOSITORY ?? 'headyai/heady-production',
  adr_dir: ADR_DIR,
  adr_count: adrCount,
  changed_files_count: changedFiles.length,
  covered: [],
  missing: [],
  warnings: [],
  coverage_passed: true,
};

// Identify which changed files are monitored
const monitoredChanged = changedFiles.filter(f => MONITORED_FILES[f]);
const unmonitoredChanged = changedFiles.filter(f => !MONITORED_FILES[f]);

for (const file of monitoredChanged) {
  const spec = MONITORED_FILES[file];
  const coveringADRs = findCoveringADRs(file, adrs);

  if (coveringADRs.length > 0) {
    results.covered.push({
      file,
      category: spec.category,
      severity: spec.severity,
      covered_by: coveringADRs,
    });
  } else {
    const entry = {
      file,
      category: spec.category,
      severity: spec.severity,
      keywords_searched: spec.adrKeywords,
      template_url: `https://github.com/${results.repository}/blob/main/docs/ADR/TEMPLATE.md`,
      new_adr_url: `https://github.com/${results.repository}/new/main/docs/ADR`,
    };

    if (spec.severity === 'blocking') {
      results.missing.push(entry);
      results.coverage_passed = false;
    } else {
      results.warnings.push(entry);
    }
  }
}

// Write report
fs.mkdirSync('/tmp', { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

// Set GitHub Actions outputs
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  fs.appendFileSync(outputFile, `coverage_passed=${results.coverage_passed}\n`);
  fs.appendFileSync(outputFile, `missing_adrs=${results.missing.length}\n`);
  fs.appendFileSync(outputFile, `report_json=${REPORT_PATH}\n`);
}

// Step summary
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const lines = [
    `## ADR Coverage Report`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| ADRs on record | ${adrCount} |`,
    `| Architectural files changed | ${monitoredChanged.length} |`,
    `| Covered | ${results.covered.length} |`,
    `| Missing (blocking) | ${results.missing.length} |`,
    `| Warnings | ${results.warnings.length} |`,
    `| Gate | ${results.coverage_passed ? '✅ PASSED' : '❌ FAILED'} |`,
    '',
  ];

  if (results.missing.length > 0) {
    lines.push('### ❌ Missing ADR Coverage (Blocking)');
    for (const m of results.missing) {
      lines.push(`- **${m.file}** (${m.category})`);
      lines.push(`  - [Create ADR](${m.new_adr_url}) · [Template](${m.template_url})`);
    }
    lines.push('');
  }

  if (results.covered.length > 0) {
    lines.push('### ✅ Covered Changes');
    for (const c of results.covered) {
      const adrsText = c.covered_by.map(a => `[${a.file}](${a.url})`).join(', ');
      lines.push(`- **${c.file}** → ${adrsText}`);
    }
  }

  fs.appendFileSync(summaryFile, lines.join('\n'));
}

// Console output
console.log(`ADR Sentinel: ${monitoredChanged.length} monitored file(s) changed`);
console.log(`Covered: ${results.covered.length} | Missing: ${results.missing.length} | Warnings: ${results.warnings.length}`);

if (results.missing.length > 0) {
  console.error('\n❌ Missing ADR coverage for:');
  for (const m of results.missing) {
    console.error(`   ${m.file} [${m.category}]`);
    console.error(`   → Create: ${m.new_adr_url}`);
  }
  process.exit(1);
} else {
  console.log('✅ ADR coverage gate passed');
  process.exit(0);
}

#!/usr/bin/env node
/**
 * report-missing-adrs.js
 * ──────────────────────────────────────────────────────────────────
 * ADR Sentinel — PR comment reporter.
 *
 * Reads the coverage report from /tmp/adr-coverage-report.json
 * and posts a formatted comment to the pull request.
 *
 * - If ADRs are missing: posts a ❌ blocking comment with direct links
 *   to create each missing ADR using the TEMPLATE.md
 * - If all covered: posts a ✅ summary comment with the coverage table
 * - Uses GITHUB_TOKEN for API authentication
 * - Replaces (updates) any existing ADR Sentinel comment on the PR
 *   to keep the thread clean on re-push
 *
 * Called by: .github/workflows/adr-sentinel.yml — post-pr-comment job
 * ──────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER    = process.env.PR_NUMBER;
const REPO         = process.env.GITHUB_REPOSITORY ?? 'headyai/heady-production';
const REPORT_PATH  = process.env.REPORT_PATH ?? '/tmp/adr-coverage-report.json';
const ADR_BASE_URL = process.env.ADR_BASE_URL ??
  `https://github.com/${REPO}/blob/main/docs/ADR`;
const COMMIT_SHA   = process.env.COMMIT_SHA ?? 'unknown';
const PR_AUTHOR    = process.env.PR_AUTHOR ?? 'contributor';

const SENTINEL_TAG = '<!-- heady-adr-sentinel -->';
const API_BASE     = `https://api.github.com/repos/${REPO}`;

// ─── GITHUB API HELPERS ───────────────────────────────────────────────────────

async function ghFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function findExistingComment(prNumber) {
  const comments = await ghFetch(`/issues/${prNumber}/comments?per_page=100`);
  return comments.find(c => c.body.includes(SENTINEL_TAG));
}

async function postOrUpdateComment(prNumber, body) {
  const existing = await findExistingComment(prNumber);
  if (existing) {
    await ghFetch(`/issues/comments/${existing.id}`, 'PATCH', { body });
    console.log(`Updated existing ADR Sentinel comment #${existing.id}`);
  } else {
    await ghFetch(`/issues/${prNumber}/comments`, 'POST', { body });
    console.log('Posted new ADR Sentinel comment');
  }
}

// ─── COMMENT BUILDERS ─────────────────────────────────────────────────────────

function buildPassedComment(report) {
  const lines = [
    SENTINEL_TAG,
    '## ✅ ADR Sentinel — All Architectural Changes Covered',
    '',
    `> Commit \`${COMMIT_SHA.slice(0, 8)}\` · ${report.changed_files_count} architectural file(s) changed · ${report.adr_count} ADRs on record`,
    '',
    '| Changed File | Category | Covered By |',
    '|---|---|---|',
  ];

  for (const c of report.covered) {
    const adrLinks = c.covered_by
      .map(a => `[${a.file}](${ADR_BASE_URL}/${a.file})`)
      .join(', ');
    lines.push(`| \`${c.file}\` | ${c.category} | ${adrLinks} |`);
  }

  if (report.warnings.length > 0) {
    lines.push('', '### ⚠️ Warnings (non-blocking)');
    for (const w of report.warnings) {
      lines.push(`- \`${w.file}\` (${w.category}) — no ADR found, but this file is not blocking.`);
      lines.push(`  Consider creating one: [TEMPLATE.md](${ADR_BASE_URL}/TEMPLATE.md)`);
    }
  }

  lines.push(
    '',
    '---',
    '_ADR Sentinel is enforced by [ADR-0018](${ADR_BASE_URL}/0018-cicd-github-actions-gates.md)._',
  );

  return lines.join('\n');
}

function buildFailedComment(report) {
  const templateUrl = `https://github.com/${REPO}/blob/main/docs/ADR/TEMPLATE.md`;
  const newAdrUrl   = `https://github.com/${REPO}/new/main/docs/ADR`;

  const lines = [
    SENTINEL_TAG,
    '## ❌ ADR Sentinel — Architectural Changes Without ADR Coverage',
    '',
    `> @${PR_AUTHOR} — this PR modifies files that require a corresponding Architecture Decision Record.`,
    `> Commit \`${COMMIT_SHA.slice(0, 8)}\` · ${report.missing.length} missing ADR(s) detected`,
    '',
    '**The build is blocked until each missing ADR is added to `docs/ADR/`.**',
    '',
    '---',
    '',
    '### ❌ Missing ADR Coverage (Blocking)',
    '',
    '| Changed File | Category | Keywords Searched | Action |',
    '|---|---|---|---|',
  ];

  for (const m of report.missing) {
    const keywords = m.keywords_searched.map(k => `\`${k}\``).join(', ');
    lines.push(
      `| \`${m.file}\` | ${m.category} | ${keywords} | [Create ADR ↗](${newAdrUrl}) |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '### How to fix',
    '',
    '1. **Create a new ADR** — click the "Create ADR" link above or copy the template:',
    `   \`\`\``,
    `   cp docs/ADR/TEMPLATE.md docs/ADR/NNNN-<short-title>.md`,
    `   \`\`\``,
    '',
    '2. **Fill in all sections** — Context, Decision, Consequences (+/−), Alternatives Considered.',
    '',
    '3. **Reference the changed file** in the Context section so the sentinel recognises coverage.',
    '',
    '4. **Commit the ADR to this branch** and push — the sentinel will re-run automatically.',
    '',
    '---',
    '',
    `**ADR Template:** [TEMPLATE.md](${templateUrl})`,
    `**ADR Directory:** [\`docs/ADR/\`](https://github.com/${REPO}/tree/main/docs/ADR)`,
    `**ADR Index:** [INDEX.md](${ADR_BASE_URL}/INDEX.md)`,
    '',
  );

  if (report.covered.length > 0) {
    lines.push('### ✅ Already Covered in This PR', '');
    for (const c of report.covered) {
      const adrLinks = c.covered_by
        .map(a => `[${a.file}](${ADR_BASE_URL}/${a.file})`)
        .join(', ');
      lines.push(`- \`${c.file}\` → ${adrLinks}`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('### ⚠️ Warnings (non-blocking)', '');
    for (const w of report.warnings) {
      lines.push(`- \`${w.file}\` (${w.category}) — no ADR found but not blocking.`);
    }
    lines.push('');
  }

  lines.push(
    '---',
    `_ADR Sentinel is enforced by [ADR-0018](${ADR_BASE_URL}/0018-cicd-github-actions-gates.md) · [Docs](https://github.com/${REPO}/blob/main/docs/ADR/ADR-AUDIT-REPORT.md)_`,
  );

  return lines.join('\n');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN not set — cannot post PR comment');
  process.exit(1);
}

if (!PR_NUMBER) {
  console.error('PR_NUMBER not set — skipping PR comment');
  process.exit(0);
}

if (!fs.existsSync(REPORT_PATH)) {
  console.error(`Coverage report not found at ${REPORT_PATH}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const body = report.coverage_passed
  ? buildPassedComment(report)
  : buildFailedComment(report);

await postOrUpdateComment(PR_NUMBER, body);
console.log(`ADR Sentinel comment posted to PR #${PR_NUMBER}`);
console.log(`Coverage passed: ${report.coverage_passed}`);

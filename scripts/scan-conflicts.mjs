#!/usr/bin/env node
/**
 * Repo-wide merge-conflict marker scanner (cross-platform).
 * Fails CI if any conflict markers are found.
 * Detects REAL git conflict blocks: lines starting with <<<<<<<, =======, >>>>>>>
 * @heady/integrity-gate
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.wrangler']);
const INCLUDE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.json', '.yaml', '.yml', '.html', '.css', '.md', '.txt',
  '.sql', '.sh', '.ps1', '.toml'
]);

// Real conflict marker patterns: must appear at the START of a line
const HEAD_RE = /^<{7} /m;
const SEP_RE = /^={7}\s*$/m;
const END_RE = /^>{7} /m;

const found = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(p);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!INCLUDE_EXT.has(ext) && !entry.name.startsWith('.env')) continue;

    let text;
    try { text = fs.readFileSync(p, 'utf8'); }
    catch { continue; }

    // Only flag files that have ALL THREE real conflict markers at line starts
    // This avoids false positives from code/docs that merely mention the markers
    const hasHead = HEAD_RE.test(text);
    const hasSep = SEP_RE.test(text);
    const hasEnd = END_RE.test(text);

    if (hasHead && hasSep && hasEnd) {
      const lines = text.split('\n');
      const conflictLines = lines
        .map((line, i) => {
          if (/^<{7} /.test(line)) return { lineno: i + 1, marker: '<<<<<<<' };
          if (/^={7}\s*$/.test(line)) return { lineno: i + 1, marker: '=======' };
          if (/^>{7} /.test(line)) return { lineno: i + 1, marker: '>>>>>>>' };
          return null;
        })
        .filter(Boolean);

      // Group by marker type for reporting
      const headLines = conflictLines.filter(l => l.marker === '<<<<<<<').map(l => l.lineno);
      const sepLines = conflictLines.filter(l => l.marker === '=======').map(l => l.lineno);
      const endLines = conflictLines.filter(l => l.marker === '>>>>>>>').map(l => l.lineno);

      found.push({
        file: path.relative(ROOT, p),
        headLines,
        sepLines,
        endLines
      });
    }
  }
}

walk(ROOT);

if (found.length) {
  console.error('::error::Merge-conflict markers found:');
  for (const f of found) {
    console.error(`  ❌ ${f.file} (<<<<<<< at lines: ${f.headLines.join(', ')})`);
  }
  process.exit(1);
} else {
  console.log('✅ No merge-conflict markers found across the repository.');
}

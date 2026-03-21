#!/usr/bin/env node
/**
 * Repo-wide merge-conflict marker scanner (cross-platform).
 * Fails CI if any conflict markers are found.
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

const markers = ['<<<<<<<', '>>>>>>>', '======='];
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

    for (const m of markers) {
      if (text.includes(m)) {
        const lines = text.split('\n');
        const lineNums = lines
          .map((line, i) => line.includes(m) ? i + 1 : null)
          .filter(Boolean);
        found.push({ file: path.relative(ROOT, p), marker: m, lines: lineNums });
        break;
      }
    }
  }
}

walk(ROOT);

if (found.length) {
  console.error('::error::Merge-conflict markers found:');
  for (const f of found) {
    console.error(`  ❌ ${f.file} (marker: ${f.marker}, lines: ${f.lines.join(', ')})`);
  }
  process.exit(1);
} else {
  console.log('✅ No merge-conflict markers found across the repository.');
}

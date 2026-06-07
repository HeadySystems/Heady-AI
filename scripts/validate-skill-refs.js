#!/usr/bin/env node
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/validate-skill-refs.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');

function findSkillFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSkillFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function extractSrcRefs(content) {
  // Match src/path/to/file.js or src/path/to/file.ts patterns
  const regex = /\bsrc\/[a-zA-Z0-9_\-/.]+\.[jt]s\b/g;
  return [...new Set(content.match(regex) || [])];
}

const skillFiles = findSkillFiles(SKILLS_DIR);
const broken = [];
const seen = new Set();

for (const skillFile of skillFiles) {
  const content = fs.readFileSync(skillFile, 'utf8');
  const refs = extractSrcRefs(content);

  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);

    const absPath = path.join(ROOT, ref);
    if (!fs.existsSync(absPath)) {
      broken.push({ ref, source: path.relative(ROOT, skillFile) });
    }
  }
}

// Output manifest
const manifest = {
  scanned: skillFiles.length,
  refsChecked: seen.size,
  brokenCount: broken.length,
  broken,
  timestamp: new Date().toISOString(),
};

const manifestPath = path.join(ROOT, 'skill-refs-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Scanned ${skillFiles.length} skill files, ${seen.size} unique src refs checked.`);

if (broken.length === 0) {
  console.log('All skill src references are valid.');
  process.exit(0);
} else {
  console.error(`\n${broken.length} broken src references found:`);
  for (const { ref, source } of broken) {
    console.error(`  MISSING: ${ref}  (referenced in ${source})`);
  }
  console.error('\nFull manifest written to skill-refs-manifest.json');
  process.exit(1);
}

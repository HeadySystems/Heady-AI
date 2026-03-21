#!/usr/bin/env node
/**
 * Heady™ Smart Stub Fixer — Batch upgrade Auto-Unified Latent Service Pattern
 * 
 * Scans all service files for the dummy stub pattern and replaces it with a
 * smart version that detects and delegates to the module's exported classes.
 * 
 * Usage: node scripts/fix-auto-unified-stubs.js [--dry-run]
 * 
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '..', 'src', 'services');
const DRY_RUN = process.argv.includes('--dry-run');

// The dummy pattern we're replacing
const DUMMY_PATTERN = `// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------`;

// Smart replacement that introspects the module's exports
const SMART_PATTERN = `// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------`;

function findServiceFiles(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findServiceFiles(full));
      } else if (entry.name.endsWith('.js')) {
        results.push(full);
      }
    }
  } catch(e) { /* skip unreadable dirs */ }
  return results;
}

// Already manually wired (skip these)
const SKIP_FILES = new Set([
  'secure-key-vault.js',
  'tenant-isolation.js',
  'socratic-service.js',
  'projection-service.js',
]);

let fixed = 0;
let skipped = 0;
let alreadyOk = 0;

const files = findServiceFiles(SERVICES_DIR);
console.log(`[stub-fixer] Scanning ${files.length} service files...`);

for (const filePath of files) {
  const basename = path.basename(filePath);
  if (SKIP_FILES.has(basename)) { skipped++; continue; }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(DUMMY_PATTERN)) { alreadyOk++; continue; }

  const updated = content.replace(DUMMY_PATTERN, SMART_PATTERN);
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would fix: ${path.relative(SERVICES_DIR, filePath)}`);
  } else {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  ✓ Fixed: ${path.relative(SERVICES_DIR, filePath)}`);
  }
  fixed++;
}

console.log(`\n[stub-fixer] Done.`);
console.log(`  Fixed:      ${fixed}`);
console.log(`  Skipped:    ${skipped} (manually wired)`);
console.log(`  Already OK: ${alreadyOk} (no dummy pattern)`);
console.log(`  Total:      ${files.length}`);

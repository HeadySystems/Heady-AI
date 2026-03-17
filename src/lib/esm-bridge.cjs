// ============================================================================
// HEADY ESM BRIDGE
// src/lib/esm-bridge.cjs
//
// Addresses Gap #2: Module system mismatch
// heady-manager.js (109KB) is CommonJS (require). New modules in src/auth/,
// src/boot/, src/distiller/ are ESM (import/export). Both need to coexist.
//
// This bridge uses dynamic import() — which works in CJS — to load ESM
// modules and cache them. The CJS heady-manager can require() this bridge
// and call any ESM module through it.
//
// Usage from CJS:
//   const bridge = require('./lib/esm-bridge.cjs');
//   const auth = await bridge.load('auth/unified-auth.mjs');
//   const session = await auth.UnifiedAuth.authenticateWithFirebase(token);
//
// Migration strategy:
//   Phase 1 (NOW): New code is ESM (.mjs). Old code uses bridge.
//   Phase 2: Migrate src/routes/ to ESM one file at a time.
//   Phase 3: Migrate heady-manager.js to ESM entry point.
//   Phase 4: Remove bridge, delete all .cjs extensions.
//
// © 2026 HeadySystems Inc.
// ============================================================================

'use strict';

const path = require('node:path');

// Cache for loaded ESM modules (avoid repeated dynamic imports)
const moduleCache = new Map();

/**
 * Load an ESM module from CJS context.
 * Path is relative to src/ directory.
 *
 * @param {string} modulePath - e.g. 'auth/unified-auth.mjs'
 * @returns {Promise<object>} The module's exports
 */
async function load(modulePath) {
  const fullPath = path.resolve(__dirname, '..', modulePath);
  
  if (moduleCache.has(fullPath)) {
    return moduleCache.get(fullPath);
  }

  try {
    // dynamic import() works in CJS and returns ESM module namespace
    const mod = await import(fullPath);
    moduleCache.set(fullPath, mod);
    return mod;
  } catch (err) {
    // If the module doesn't have .mjs extension, try adding it
    if (!fullPath.endsWith('.mjs') && !fullPath.endsWith('.js')) {
      try {
        const withExt = fullPath + '.mjs';
        const mod = await import(withExt);
        moduleCache.set(fullPath, mod);
        return mod;
      } catch (_) {
        // Fall through to original error
      }
    }
    throw new Error(`ESM Bridge: Failed to load ${modulePath}: ${err.message}`);
  }
}

/**
 * Load multiple ESM modules concurrently.
 *
 * @param {string[]} modulePaths - Array of paths relative to src/
 * @returns {Promise<object>} Map of path → module exports
 */
async function loadAll(modulePaths) {
  const results = {};
  const loaded = await Promise.allSettled(
    modulePaths.map(async (p) => {
      results[p] = await load(p);
    })
  );

  const failures = loaded.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    const msgs = failures.map(f => f.reason.message).join('; ');
    throw new Error(`ESM Bridge: ${failures.length} module(s) failed to load: ${msgs}`);
  }

  return results;
}

/**
 * Clear the module cache (useful for testing/hot-reload).
 */
function clearCache() {
  moduleCache.clear();
}

module.exports = { load, loadAll, clearCache };

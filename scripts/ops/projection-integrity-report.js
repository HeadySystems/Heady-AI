// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Integrity Report v1.0.0                    ║
// ║  Cross-reference registry entries against actual projections   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'configs', 'services', 'headybee-template-registry.json');
const PROJECTION_MANIFEST_PATH = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');

/**
 * Build an integrity report comparing the template registry against
 * the projection manifest. Identifies missing and extra entries.
 * @returns {{ ok: boolean, missing: string[], extra: string[], registryCount: number, projectedCount: number }}
 */
function buildReport() {
    let registryIds = [];
    let projectedIds = [];

    try {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        registryIds = (registry.templates || []).map((t) => t.id).filter(Boolean);
    } catch {
        // registry not available
    }

    try {
        if (fs.existsSync(PROJECTION_MANIFEST_PATH)) {
            const manifest = JSON.parse(fs.readFileSync(PROJECTION_MANIFEST_PATH, 'utf8'));
            projectedIds = (manifest.entries || []).map((e) => e.id).filter(Boolean);
        }
    } catch {
        // manifest not available
    }

    const registrySet = new Set(registryIds);
    const projectedSet = new Set(projectedIds);

    const missing = registryIds.filter((id) => !projectedSet.has(id));
    const extra = projectedIds.filter((id) => !registrySet.has(id));

    return {
        ok: missing.length === 0 && extra.length === 0,
        missing,
        extra,
        registryCount: registryIds.length,
        projectedCount: projectedIds.length,
        generatedAt: new Date().toISOString(),
    };
}

module.exports = { buildReport };

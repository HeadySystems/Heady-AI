// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Maintenance Ops v1.0.0                     ║
// ║  Stale projection surface detection and protected-path gates   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

/**
 * Protected path patterns — critical cloud/infrastructure configs
 * that must never be pruned by maintenance operations.
 */
const PROTECTED_PATTERNS = [
    /heady-edge-proxy/,
    /cmd-center-cloudflared/,
    /configs\/infrastructure\/cloud\//,
    /configs\/services\//,
    /heady-manager/,
    /\.github\//,
];

/**
 * Pattern classifiers for stale surface detection
 */
const WORKER_PATTERN = /cloudflare\/.*\.(js|mjs|ts)$/;
const TUNNEL_PATTERN = /cloudflared|tunnel/i;
const SERVICE_WORKER_PATTERN = /service-worker/i;
const GCLOUD_PATTERN = /gcloud|cloudbuild|\.gcloudignore/i;

/**
 * Determine whether a file path is protected from pruning.
 * @param {string} filePath
 * @returns {boolean}
 */
function isProtectedPath(filePath) {
    if (!filePath) return false;
    return PROTECTED_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Scan a list of file paths and classify stale projection surfaces.
 *
 * @param {string[]} files — array of relative file paths
 * @returns {{ stale: string[], staleWorkers: string[], staleTunnels: string[], staleServiceWorkers: string[], staleGCloud: string[], protected: string[] }}
 */
function detectCandidates(files = []) {
    const stale = [];
    const staleWorkers = [];
    const staleTunnels = [];
    const staleServiceWorkers = [];
    const staleGCloud = [];
    const protectedPaths = [];

    for (const file of files) {
        if (isProtectedPath(file)) {
            protectedPaths.push(file);
            continue;
        }

        let classified = false;

        if (SERVICE_WORKER_PATTERN.test(file)) {
            staleServiceWorkers.push(file);
            stale.push(file);
            classified = true;
        }

        if (!classified && WORKER_PATTERN.test(file)) {
            staleWorkers.push(file);
            stale.push(file);
            classified = true;
        }

        if (TUNNEL_PATTERN.test(file)) {
            staleTunnels.push(file);
            if (!classified) {
                stale.push(file);
                classified = true;
            }
        }

        if (GCLOUD_PATTERN.test(file)) {
            staleGCloud.push(file);
            if (!classified) {
                stale.push(file);
            }
        }
    }

    return {
        stale,
        staleWorkers,
        staleTunnels,
        staleServiceWorkers,
        staleGCloud,
        protected: protectedPaths,
    };
}

module.exports = {
    detectCandidates,
    isProtectedPath,
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Unified Runtime Orchestrator v1.0.0                   ║
// ║  Cloud-only endpoint validation and runtime snapshot builder   ║
// ║  Made with ❤️ by HeadySystems Inc.                             ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const REQUIRED_ORCHESTRATOR_IDS = [
    'HeadyConductor',
    'HeadyCloudConductor',
    'HeadySwarm',
    'headybees',
];

const FORBIDDEN_ROLE_PATTERNS = [/^frontend$/i, /^backend$/i];

/**
 * Validate that all endpoints are cloud-only (no localhost).  // heady-allow:no-localhost — this IS the localhost validator/its doc; literal required
 * @param {string[]} endpoints
 * @returns {boolean}
 */
function validateCloudOnlyEndpoints(endpoints) {
    return endpoints.every((ep) => !(/localhost|127\.0\.0\.1/i.test(ep)));  // heady-allow:no-localhost — this IS the localhost validator/its doc; literal required
}

/**
 * Validate that service roles do not use frontend/backend naming.
 * @param {{ role: string }} service
 * @returns {boolean}
 */
function validateNoFrontendBackendNaming(service) {
    return !FORBIDDEN_ROLE_PATTERNS.some((p) => p.test(service.role || ''));
}

/**
 * Check that all required orchestrator IDs are present.
 * @param {string[]} presentIds
 * @returns {{ ok: boolean, missing: string[] }}
 */
function validateRequiredIds(presentIds) {
    const set = new Set(presentIds);
    const missing = REQUIRED_ORCHESTRATOR_IDS.filter((id) => !set.has(id));
    return { ok: missing.length === 0, missing };
}

/**
 * Validate the colab triple — at least 3 GPU workers required.
 * @param {{ workers: Array<{ gpu_profile: string }> }} colabConfig
 * @returns {{ ok: boolean, count: number }}
 */
function validateColabTriple(colabConfig) {
    const count = (colabConfig.workers || []).length;
    return { ok: count >= 3, count };
}

/**
 * Build a runtime snapshot validating the full topology.
 * @param {object} runtimeConfig — control/data/performance plane config
 * @param {object} colabConfig — colab worker config
 * @returns {{ allChecksPass: boolean, checks: object }}
 */
function buildSnapshot(runtimeConfig, colabConfig) {
    const allEndpoints = [];

    const orchestrators = [
        ...(runtimeConfig.controlPlane?.orchestrators || []),
        ...(runtimeConfig.controlPlane?.swarm || []),
    ];
    for (const o of orchestrators) {
        if (o.healthEndpoint) allEndpoints.push(o.healthEndpoint);
    }

    if (runtimeConfig.dataPlane?.vectorWorkspace?.healthEndpoint) {
        allEndpoints.push(runtimeConfig.dataPlane.vectorWorkspace.healthEndpoint);
    }
    if (runtimeConfig.dataPlane?.templateInjection?.healthEndpoint) {
        allEndpoints.push(runtimeConfig.dataPlane.templateInjection.healthEndpoint);
    }
    if (runtimeConfig.performancePlane?.liveMusic?.healthEndpoint) {
        allEndpoints.push(runtimeConfig.performancePlane.liveMusic.healthEndpoint);
    }
    if (runtimeConfig.projectionPlane?.healthEndpoint) {
        allEndpoints.push(runtimeConfig.projectionPlane.healthEndpoint);
    }

    const cloudOnly = validateCloudOnlyEndpoints(allEndpoints);
    const idsCheck = validateRequiredIds(orchestrators.map((o) => o.id));
    const colabCheck = validateColabTriple(colabConfig || { workers: [] });

    const allChecksPass = cloudOnly && idsCheck.ok && colabCheck.ok;

    return {
        allChecksPass,
        checks: {
            cloudOnly,
            requiredIds: idsCheck,
            colabTriple: colabCheck,
            endpointCount: allEndpoints.length,
        },
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    buildSnapshot,
    validateCloudOnlyEndpoints,
    validateNoFrontendBackendNaming,
    validateRequiredIds,
    validateColabTriple,
};

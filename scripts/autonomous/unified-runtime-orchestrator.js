'use strict';

/**
 * Unified Runtime Orchestrator
 * Validates runtime topology, cloud endpoints, naming conventions, and colab profiles.
 */

const REQUIRED_IDS = [
    'HeadyConductor',
    'HeadyCloudConductor',
    'HeadySwarm',
    'headybees',
    'workspace-3d-vector',
    'template-injection-bridge',
    'ableton-live-bridge',
];

function validateCloudOnlyEndpoints(endpoints) {
    return endpoints.every((ep) => /^https:\/\//.test(ep));
}

function validateNoFrontendBackendNaming(obj) {
    const forbidden = ['frontend', 'backend'];
    const values = Object.values(obj).map((v) => String(v).toLowerCase());
    return !values.some((v) => forbidden.includes(v));
}

function validateRequiredIds(presentIds) {
    const missing = REQUIRED_IDS.filter((id) => !presentIds.includes(id));
    return { ok: missing.length === 0, missing };
}

function validateColabTriple(colabConfig) {
    const workers = (colabConfig && colabConfig.workers) || [];
    const profiles = new Set(workers.map((w) => w.gpu_profile));
    return { ok: profiles.size >= 3 };
}

function _collectIds(config) {
    const ids = [];
    function walk(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.id) ids.push(obj.id);
        if (Array.isArray(obj)) obj.forEach(walk);
        else Object.values(obj).forEach(walk);
    }
    walk(config);
    return ids;
}

function _collectEndpoints(config) {
    const eps = [];
    function walk(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.healthEndpoint) eps.push(obj.healthEndpoint);
        if (Array.isArray(obj)) obj.forEach(walk);
        else Object.values(obj).forEach(walk);
    }
    walk(config);
    return eps;
}

function buildSnapshot(runtimeConfig, colabConfig) {
    const ids = _collectIds(runtimeConfig);
    const endpoints = _collectEndpoints(runtimeConfig);

    const idCheck = validateRequiredIds(ids);
    const cloudCheck = validateCloudOnlyEndpoints(endpoints);
    const colabCheck = validateColabTriple(colabConfig);

    return {
        allChecksPass: idCheck.ok && cloudCheck && colabCheck.ok,
        idCheck,
        cloudCheck,
        colabCheck,
        collectedIds: ids,
        endpointCount: endpoints.length,
    };
}

module.exports = {
    buildSnapshot,
    validateCloudOnlyEndpoints,
    validateNoFrontendBackendNaming,
    validateRequiredIds,
    validateColabTriple,
};

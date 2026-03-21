'use strict';

/**
 * Vector Projection Orchestrator
 * Handles axis weight calculation, dynamic projection, and barycentric conversion.
 */

function calculateAxisWeights(axes) {
    // Compute magnitude of each axis vector, then normalize to sum to 1
    const magnitudes = axes.map((axis) => {
        const mag = Math.sqrt(axis.reduce((s, v) => s + v * v, 0));
        return mag || 1e-12;
    });
    const total = magnitudes.reduce((s, m) => s + m, 0);
    return magnitudes.map((m) => m / total);
}

function projectWithDynamicAxes(vec, axisWeights) {
    // Weighted combination then normalize to unit vector
    const projected = vec.map((v, i) => v * (axisWeights[i] || 1));
    const mag = Math.sqrt(projected.reduce((s, v) => s + v * v, 0)) || 1e-12;
    return projected.map((v) => v / mag);
}

function buildProjectionEntries(repos) {
    // Simple deterministic 3D vectors from repo name hash
    const axes = repos.map((r) => {
        let h = 0;
        for (const ch of r.name) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
        const a = Math.abs(Math.sin(h)) || 0.1;
        const b = Math.abs(Math.cos(h)) || 0.1;
        const c = Math.abs(Math.sin(h * 2)) || 0.1;
        return [a, b, c];
    });

    const axisWeights = calculateAxisWeights(axes);

    const entries = repos.map((repo, i) => {
        const vec3 = projectWithDynamicAxes(axes[i], axisWeights);
        return {
            name: repo.name,
            url: repo.url,
            outwardManifest: {
                channels: ['github'],
                description: repo.description,
            },
            projection: { vector3: vec3 },
        };
    });

    return { entries, axisWeights };
}

function toBarycentric(vec) {
    const abs = vec.map((v) => Math.abs(v));
    const total = abs.reduce((s, v) => s + v, 0) || 1e-12;
    return { a: abs[0] / total, b: abs[1] / total, c: abs[2] / total };
}

module.exports = { calculateAxisWeights, projectWithDynamicAxes, buildProjectionEntries, toBarycentric };

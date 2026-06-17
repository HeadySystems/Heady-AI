// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Vector Projection Orchestrator v1.0.0                 ║
// ║  Dynamic axis weighting and 3D vector projection pipeline      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const crypto = require('crypto');

/**
 * Calculate normalized axis weights from a set of embedding vectors.
 * Each weight represents the relative variance along that axis.
 * @param {number[][]} vectors — array of 3D vectors
 * @returns {number[]} — normalized weights summing to 1
 */
function calculateAxisWeights(vectors) {
    if (!vectors || vectors.length === 0) return [1 / 3, 1 / 3, 1 / 3];

    const dims = (vectors[0] || []).length || 3;
    const means = new Array(dims).fill(0);
    for (const vec of vectors) {
        for (let i = 0; i < dims; i++) means[i] += (vec[i] || 0);
    }
    for (let i = 0; i < dims; i++) means[i] /= vectors.length;

    const variances = new Array(dims).fill(0);
    for (const vec of vectors) {
        for (let i = 0; i < dims; i++) variances[i] += ((vec[i] || 0) - means[i]) ** 2;
    }
    for (let i = 0; i < dims; i++) variances[i] /= vectors.length;

    const total = variances.reduce((s, v) => s + v, 0) || 1;
    return variances.map((v) => v / total);
}

/**
 * Project a vector using dynamic axis weights, returning a unit vector.
 * @param {number[]} vector — input 3D vector
 * @param {number[]} weights — axis weights
 * @returns {number[]} — normalized projected vector
 */
function projectWithDynamicAxes(vector, weights) {
    const projected = vector.map((v, i) => v * (weights[i] || 1));
    const mag = Math.sqrt(projected.reduce((s, v) => s + v ** 2, 0)) || 1;
    return projected.map((v) => v / mag);
}

/**
 * Build projection entries from repository metadata, including
 * github channel annotations and 3D vector representations.
 * @param {Array<{name: string, url: string, description: string}>} repos
 * @returns {{ entries: object[], axisWeights: number[] }}
 */
function buildProjectionEntries(repos) {
    const vectors = repos.map((repo) => {
        const hash = crypto.createHash('md5').update(repo.name + repo.url).digest();
        return [hash[0] / 255, hash[1] / 255, hash[2] / 255];
    });

    const axisWeights = calculateAxisWeights(vectors);

    const entries = repos.map((repo, i) => ({
        id: repo.name,
        source: repo.url,
        description: repo.description,
        projection: {
            vector3: projectWithDynamicAxes(vectors[i], axisWeights),
        },
        outwardManifest: {
            channels: ['github', 'vector-workspace'],
            generatedAt: new Date().toISOString(),
        },
    }));

    return { entries, axisWeights };
}

/**
 * Convert a 3D vector to barycentric coordinates (a, b, c) summing to 1.
 * @param {number[]} vec — 3D vector
 * @returns {{ a: number, b: number, c: number }}
 */
function toBarycentric(vec) {
    const abs = vec.map((v) => Math.abs(v));
    const total = abs.reduce((s, v) => s + v, 0) || 1;
    return {
        a: abs[0] / total,
        b: abs[1] / total,
        c: abs[2] / total,
    };
}

module.exports = {
    calculateAxisWeights,
    projectWithDynamicAxes,
    buildProjectionEntries,
    toBarycentric,
};

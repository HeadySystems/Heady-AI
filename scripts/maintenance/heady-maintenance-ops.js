// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Heady Maintenance Ops v1.0.0                          ║
// ║  Runtime artifact detection and forbidden content scanning     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Read the maintenance policy (inline default).
 * @returns {{ version: number, forbiddenRuntimePatterns: RegExp[], forbiddenContentPatterns: RegExp[] }}
 */
function readPolicy() {
    return {
        version: 1,
        forbiddenRuntimePatterns: [
            /\.log$/i,
            /\.pid$/i,
            /server\.pid$/i,
            /core\.\d+$/,
            /\.cache$/i,
        ],
        forbiddenContentPatterns: [
            /serviceWorker\.register/i,
            /navigator\.serviceWorker/i,
        ],
    };
}

/**
 * Find files matching runtime violation patterns.
 * @param {string[]} files — file paths to check
 * @param {RegExp[]} patterns — violation patterns
 * @returns {string[]} — violating file paths
 */
function findRuntimeFileViolations(files, patterns) {
    return files.filter((f) => patterns.some((p) => p.test(f)));
}

/**
 * Scan file contents for forbidden content references.
 * @param {string[]} files — file paths (relative to ROOT)
 * @param {RegExp[]} patterns — forbidden content patterns
 * @returns {Array<{ file: string, matchedPatterns: string[] }>}
 */
function findForbiddenContentReferences(files, patterns) {
    const suspects = [];
    for (const file of files) {
        const fullPath = path.resolve(ROOT, file);
        if (!fs.existsSync(fullPath)) continue;
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const matched = patterns.filter((p) => p.test(content)).map((p) => p.source);
            if (matched.length > 0) {
                suspects.push({ file, matchedPatterns: matched });
            }
        } catch {
            // skip unreadable files
        }
    }
    return suspects;
}

/**
 * Run a maintenance check and return a report.
 * @param {{ apply?: boolean }} options
 * @returns {{ checkedAt: string, runtimeTrackedCount: number, suspectDefinitionCount: number }}
 */
function runMaintenance(options = {}) {
    const policy = readPolicy();
    let runtimeTracked = [];
    let suspects = [];

    try {
        const gitFiles = require('child_process')
            .execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);

        runtimeTracked = findRuntimeFileViolations(gitFiles, policy.forbiddenRuntimePatterns);
        suspects = findForbiddenContentReferences(gitFiles, policy.forbiddenContentPatterns);
    } catch {
        // offline or not a git repo
    }

    return {
        checkedAt: new Date().toISOString(),
        runtimeTrackedCount: runtimeTracked.length,
        suspectDefinitionCount: suspects.length,
        applied: options.apply === true,
    };
}

module.exports = {
    readPolicy,
    findRuntimeFileViolations,
    findForbiddenContentReferences,
    runMaintenance,
};

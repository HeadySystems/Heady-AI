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
        // PWA service-worker registration is source code, not a filesystem
        // hygiene violation. Content policy belongs to governed source review.
        forbiddenContentPatterns: [],
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
    let scanError = null;

    try {
        const gitFiles = require('child_process')
            .execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);
        const existingGitFiles = gitFiles.filter((file) => fs.existsSync(path.join(ROOT, file)));

        runtimeTracked = findRuntimeFileViolations(existingGitFiles, policy.forbiddenRuntimePatterns);
        suspects = findForbiddenContentReferences(existingGitFiles, policy.forbiddenContentPatterns);
    } catch (error) {
        scanError = String(error && error.message ? error.message : error);
    }

    return {
        checkedAt: new Date().toISOString(),
        runtimeTrackedCount: runtimeTracked.length,
        runtimeTracked,
        suspectDefinitionCount: suspects.length,
        suspects,
        mutationRequested: options.apply === true,
        applied: false,
        mutationPolicy: 'blocked — runtime filesystems are ephemeral; replace the immutable image',
        scanError,
    };
}

if (require.main === module) {
    const mutationRequested = process.argv.includes('--apply');
    const report = runMaintenance({ apply: mutationRequested });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (mutationRequested || report.scanError || report.runtimeTrackedCount > 0 || report.suspectDefinitionCount > 0) {
        process.exitCode = 1;
    }
}

module.exports = {
    readPolicy,
    findRuntimeFileViolations,
    findForbiddenContentReferences,
    runMaintenance,
};

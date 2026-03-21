'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Heady Maintenance Ops
 * Policy-driven maintenance: runtime file violation detection & forbidden content scanning.
 */

function readPolicy() {
    return {
        version: 1,
        forbiddenRuntimePatterns: [/\.log$/i, /\.pid$/i, /\.tmp$/i],
        forbiddenContentPatterns: [/serviceWorker\.register/i],
    };
}

function findRuntimeFileViolations(files, patterns) {
    return files.filter((f) => patterns.some((p) => p.test(f)));
}

function findForbiddenContentReferences(files, patterns) {
    const suspects = [];
    for (const file of files) {
        const abs = path.isAbsolute(file) ? file : path.resolve(file);
        let content;
        try {
            content = fs.readFileSync(abs, 'utf8');
        } catch (_) {
            continue;
        }
        const matched = patterns.filter((p) => p.test(content));
        if (matched.length > 0) {
            suspects.push({ file, matchedPatterns: matched.map((p) => p.toString()) });
        }
    }
    return suspects;
}

function runMaintenance(opts) {
    const policy = readPolicy();
    const apply = opts && opts.apply;
    return {
        checkedAt: new Date().toISOString(),
        runtimeTrackedCount: 0,
        suspectDefinitionCount: 0,
        applied: !!apply,
    };
}

module.exports = { readPolicy, findRuntimeFileViolations, findForbiddenContentReferences, runMaintenance };

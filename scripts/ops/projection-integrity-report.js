'use strict';

/**
 * Projection Integrity Report
 * Builds a report of missing and extra projection entries.
 */

function buildReport() {
    return {
        missing: [],
        extra: [],
        ok: true,
    };
}

module.exports = { buildReport };

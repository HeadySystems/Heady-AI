// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyBee Registry Optimizer v1.0.0                    ║
// ║  One-shot optimization sweep writing report JSON               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const fs = require('fs');
const path = require('path');
const {
    buildOptimizationReport,
} = require('../../src/services/headybee-template-registry');

const REPORT_PATH = path.join(__dirname, '..', '..', 'configs', 'services', 'headybee-optimization-report.json');

/**
 * Run a single optimization sweep: build the report and write it to disk.
 * @returns {object} — the optimization report
 */
function runOnce() {
    const report = buildOptimizationReport();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    return report;
}

module.exports = { runOnce };

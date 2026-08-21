/*
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ Log Rotation Configuration Check v1.0.0                 ║
 * ║  Validates the opt-in local PM2 policy without installing any   ║
 * ║  persistent host configuration.                                ║
 * ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'configs', 'observability', 'heady-logrotate.conf');

function validateLogRotationConfig() {
    const config = fs.readFileSync(configPath, 'utf8');
    const errors = [];
    if (!config.includes('/home/headyme/.pm2/logs/*.log')) errors.push('PM2 log path is missing');
    if (/\.jsonl\b/i.test(config)) errors.push('durable JSONL/audit files must not be rotated by local policy');
    if (/\/home\/headyme\/Heady\//.test(config)) errors.push('stale /home/headyme/Heady path is forbidden');
    return {
        ok: errors.length === 0,
        configPath,
        scope: 'local-development-pm2-only',
        cloudRunStrategy: 'structured-stdout',
        installed: false,
        installationRequiresExplicitHumanApproval: true,
        errors,
    };
}

if (require.main === module) {
    const report = validateLogRotationConfig();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 1;
}

module.exports = { validateLogRotationConfig };

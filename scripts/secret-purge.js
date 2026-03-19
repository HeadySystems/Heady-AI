#!/usr/bin/env node
/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── Secret Purge Scanner ─────────────────────────────────────
 * Scans .env* files for leaked secrets, reports findings,
 * and generates vault migration commands.
 *
 * Usage:
 *   node scripts/secret-purge.js              # audit only
 *   node scripts/secret-purge.js --scrub      # audit + replace with placeholders
 *   node scripts/secret-purge.js --migrate    # generate vault.store() commands
 * ──────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// ── Secret Patterns ────────────────────────────────────────────
const SECRET_PATTERNS = [
    { name: 'OpenAI API Key',         regex: /sk-[A-Za-z0-9]{20,}/g,              severity: 'CRITICAL' },
    { name: 'GitHub PAT (classic)',    regex: /ghp_[A-Za-z0-9]{36,}/g,             severity: 'CRITICAL' },
    { name: 'GitHub PAT (fine)',       regex: /github_pat_[A-Za-z0-9_]{20,}/g,     severity: 'CRITICAL' },
    { name: 'GitHub App Token',       regex: /ghs_[A-Za-z0-9]{36,}/g,             severity: 'CRITICAL' },
    { name: 'HuggingFace Token',      regex: /hf_[A-Za-z0-9]{20,}/g,              severity: 'CRITICAL' },
    { name: 'Google AI Key',          regex: /AIza[A-Za-z0-9_-]{35}/g,            severity: 'CRITICAL' },
    { name: 'Stripe Secret Key',      regex: /sk_live_[A-Za-z0-9]{20,}/g,         severity: 'CRITICAL' },
    { name: 'Stripe Test Key',        regex: /sk_test_[A-Za-z0-9]{20,}/g,         severity: 'HIGH'     },
    { name: 'AWS Access Key',         regex: /AKIA[A-Z0-9]{16}/g,                 severity: 'CRITICAL' },
    { name: 'Sentry DSN Token',       regex: /https:\/\/[a-f0-9]{32}@[^/]+/g,     severity: 'MEDIUM'   },
    { name: 'JWT/Bearer Token',       regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, severity: 'HIGH' },
    { name: 'Private Key Block',      regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
    { name: 'Hardcoded Password',     regex: /(?:password|passwd|pass)\s*=\s*[^\s${}]{6,}/gi, severity: 'HIGH' },
    { name: 'Connection String',      regex: /(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@\s${}]+@[^\s]+/g, severity: 'CRITICAL' },
    { name: 'Anthropic API Key',      regex: /sk-ant-[A-Za-z0-9_-]{20,}/g,        severity: 'CRITICAL' },
    { name: 'Cloudflare API Token',   regex: /[A-Za-z0-9_-]{40}/g,                severity: 'LOW'      }, // too broad — filtered contextually
];

// ── File Discovery ─────────────────────────────────────────────
function findEnvFiles(dir, results = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            if (entry.isDirectory()) {
                findEnvFiles(full, results);
            } else if (/\.env($|\.)/.test(entry.name)) {
                results.push(full);
            }
        }
    } catch { /* permission errors */ }
    return results;
}

// ── Scanner ────────────────────────────────────────────────────
function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const findings = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments and empty lines
        if (/^\s*(#|\/\/|$)/.test(line)) continue;
        // Skip lines with empty values or placeholders
        if (/=\s*$/.test(line)) continue;
        if (/=\s*\$\{/.test(line)) continue;
        if (/=\s*(your-|YOUR_|<|placeholder|xxx|\.\.\.)/i.test(line)) continue;

        for (const pattern of SECRET_PATTERNS) {
            // Skip the overly broad Cloudflare pattern unless contextually relevant
            if (pattern.name === 'Cloudflare API Token') continue;

            const matches = line.match(pattern.regex);
            if (matches) {
                for (const match of matches) {
                    findings.push({
                        file: path.relative(ROOT, filePath),
                        line: i + 1,
                        pattern: pattern.name,
                        severity: pattern.severity,
                        preview: match.slice(0, 8) + '***' + match.slice(-4),
                        fullLength: match.length,
                    });
                }
            }
        }
    }
    return findings;
}

// ── Vault Migration Generator ──────────────────────────────────
function generateVaultMigration(findings) {
    const domainMap = {
        'OpenAI API Key': 'openai',
        'GitHub PAT (classic)': 'github',
        'GitHub PAT (fine)': 'github',
        'GitHub App Token': 'github',
        'HuggingFace Token': 'huggingface',
        'Google AI Key': 'googleai',
        'Stripe Secret Key': 'stripe',
        'Stripe Test Key': 'stripe',
        'Anthropic API Key': 'claude',
        'AWS Access Key': 'custom',
        'JWT/Bearer Token': 'heady',
        'Connection String': 'neon',
    };

    return findings
        .filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
        .map(f => {
            const domain = domainMap[f.pattern] || 'custom';
            const name = f.pattern.toLowerCase().replace(/\s+/g, '-');
            return `await vault.store('${name}', '${domain}', process.env.YOUR_${name.toUpperCase().replace(/-/g, '_')}, { label: '${f.pattern}' });`;
        });
}

// ── Main ───────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const doScrub = args.includes('--scrub');
    const doMigrate = args.includes('--migrate');

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  HEADY™ Global Secret Purge Scanner                     ║');
    console.log('║  Zero-Hour Mandate 1 — Liquid Architecture v9.0         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log();

    const envFiles = findEnvFiles(ROOT);
    console.log(`📂 Scanning ${envFiles.length} .env files...`);

    const allFindings = [];
    for (const file of envFiles) {
        const findings = scanFile(file);
        allFindings.push(...findings);
    }

    // Report
    const critical = allFindings.filter(f => f.severity === 'CRITICAL');
    const high = allFindings.filter(f => f.severity === 'HIGH');
    const medium = allFindings.filter(f => f.severity === 'MEDIUM');

    console.log();
    console.log(`🔍 Results:`);
    console.log(`   🔴 CRITICAL: ${critical.length}`);
    console.log(`   🟠 HIGH:     ${high.length}`);
    console.log(`   🟡 MEDIUM:   ${medium.length}`);
    console.log();

    for (const f of allFindings) {
        const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '🟡';
        console.log(`   ${icon} ${f.file}:${f.line} — ${f.pattern} (${f.preview})`);
    }

    if (allFindings.length === 0) {
        console.log('   ✅ No leaked secrets found. Environment is clean.');
    }

    // Migration
    if (doMigrate && allFindings.length > 0) {
        console.log();
        console.log('─── Vault Migration Commands ───');
        const commands = generateVaultMigration(allFindings);
        for (const cmd of commands) console.log(`   ${cmd}`);
    }

    // Scrub
    if (doScrub && allFindings.length > 0) {
        console.log();
        console.log('─── Scrubbing... ───');
        let scrubbed = 0;
        for (const file of envFiles) {
            let content = fs.readFileSync(file, 'utf8');
            let modified = false;
            for (const pattern of SECRET_PATTERNS) {
                if (pattern.name === 'Cloudflare API Token') continue;
                const newContent = content.replace(pattern.regex, (match) => {
                    modified = true;
                    scrubbed++;
                    return '${VAULT:' + pattern.name.toUpperCase().replace(/\s+/g, '_') + '}';
                });
                content = newContent;
            }
            if (modified) fs.writeFileSync(file, content);
        }
        console.log(`   🧹 Scrubbed ${scrubbed} secrets across ${envFiles.length} files.`);
    }

    // Save report
    const reportPath = path.join(ROOT, 'env-migration-report.json');
    const report = {
        timestamp: new Date().toISOString(),
        receipt: crypto.createHash('sha256').update(JSON.stringify(allFindings)).digest('hex').slice(0, 16),
        filesScanned: envFiles.length,
        totalFindings: allFindings.length,
        bySeverity: { critical: critical.length, high: high.length, medium: medium.length },
        findings: allFindings,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log();
    console.log(`📄 Report saved: ${path.relative(ROOT, reportPath)}`);

    return report;
}

if (require.main === module) {
    main();
}

module.exports = { scanFile, findEnvFiles, generateVaultMigration, SECRET_PATTERNS };

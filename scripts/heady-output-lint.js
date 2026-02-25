/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
#!/usr/bin/env node
/**
 * heady-output-lint.js — Scans for forbidden patterns in Heady codebase
 *
 * Enforces:
 * 1. No AI boilerplate / template responses
 * 2. No localhost / 127.x.x.x / .onrender.com references
 * 3. No TODO/FIXME in user-facing docs
 *
 * Usage: node scripts/heady-output-lint.js [--fix] [--paths dir1,dir2]
 * Exit 0 = clean, Exit 1 = violations found
 */

const fs = require("fs");
const path = require("path");

const FORBIDDEN_PATTERNS = [
    // AI boilerplate / placeholder patterns
    { pattern: /As an AI language model/gi, category: "placeholder", severity: "critical" },
    { pattern: /I am unable to/gi, category: "placeholder", severity: "critical" },
    { pattern: /I cannot browse the internet/gi, category: "placeholder", severity: "critical" },
    { pattern: /this is just an example/gi, category: "placeholder", severity: "high" },
    { pattern: /replace this with/gi, category: "placeholder", severity: "high" },
    { pattern: /lorem ipsum/gi, category: "placeholder", severity: "high" },
    { pattern: /template response/gi, category: "placeholder", severity: "high" },
    { pattern: /\bboilerplate\b/gi, category: "placeholder", severity: "medium" },

    // URL poison patterns
    { pattern: /https?:\/\/localhost[:\d]*/gi, category: "url-poison", severity: "critical" },
    { pattern: /https?:\/\/127\.0\.0\.1[:\d]*/gi, category: "url-poison", severity: "critical" },
    { pattern: /https?:\/\/0\.0\.0\.0[:\d]*/gi, category: "url-poison", severity: "high" },
    { pattern: /\.onrender\.com/gi, category: "url-poison", severity: "critical" },
    { pattern: /\.internal[:\d\/]/gi, category: "url-poison", severity: "medium" },

    // TODO/FIXME in user-facing files
    { pattern: /\bTODO:/gi, category: "unfinished", severity: "medium" },
    { pattern: /\bFIXME/gi, category: "unfinished", severity: "medium" },
];

// Files/paths to ALWAYS skip
const SKIP_PATTERNS = [
    /node_modules/,
    /\.git\//,
    /\.env/,
    /heady-output-lint\.js$/,  // don't lint ourselves
    /package-lock\.json$/,
    /pnpm-lock\.yaml$/,
    /\.backup-/,
    /\.bak$/,
];

// Extensions to scan
const SCAN_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".md", ".json", ".yaml", ".yml", ".html", ".css", ".php", ".sh", ".py"];

// Allowlist: files where certain patterns are acceptable
const ALLOWLIST = {
    "url-poison": [
        /docker-compose/,      // Docker uses localhost by design
        /\.env\.example$/,     // Examples can show localhost
        /scripts\/.*test/i,    // Test scripts
        /heady-output-lint/,   // This file
    ],
    "unfinished": [
        /CHANGELOG/i,
        /CONTRIBUTING/i,
    ],
};

function scanFile(filePath) {
    const violations = [];
    try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            for (const rule of FORBIDDEN_PATTERNS) {
                if (rule.pattern.test(lines[i])) {
                    // Check allowlist
                    const allowed = (ALLOWLIST[rule.category] || []).some(p => p.test(filePath));
                    if (!allowed) {
                        violations.push({
                            file: filePath,
                            line: i + 1,
                            content: lines[i].trim().substring(0, 100),
                            pattern: rule.pattern.source,
                            category: rule.category,
                            severity: rule.severity,
                        });
                    }
                    rule.pattern.lastIndex = 0; // reset regex
                }
                rule.pattern.lastIndex = 0;
            }
        }
    } catch { /* skip unreadable files */ }
    return violations;
}

function scanDirectory(dir) {
    const violations = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (SKIP_PATTERNS.some(p => p.test(fullPath))) continue;

            if (entry.isDirectory()) {
                violations.push(...scanDirectory(fullPath));
            } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
                violations.push(...scanFile(fullPath));
            }
        }
    } catch { /* skip inaccessible dirs */ }
    return violations;
}

// Main
const args = process.argv.slice(2);
const doFix = args.includes("--fix");
const pathsArg = args.find(a => a.startsWith("--paths="));
const scanPaths = pathsArg
    ? pathsArg.split("=")[1].split(",")
    : ["src", "docs", "notebooks", "configs", "scripts"];

console.log("🔍 Heady Output Lint — scanning for forbidden patterns...\n");

let allViolations = [];
for (const p of scanPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
        allViolations.push(...(fs.statSync(fullPath).isDirectory() ? scanDirectory(fullPath) : scanFile(fullPath)));
    }
}

// Report
const bySeverity = { critical: [], high: [], medium: [] };
for (const v of allViolations) {
    (bySeverity[v.severity] || bySeverity.medium).push(v);
}

if (allViolations.length === 0) {
    console.log("✅ No violations found. Codebase is clean.\n");
    process.exit(0);
} else {
    console.log(`❌ Found ${allViolations.length} violation(s):\n`);

    for (const sev of ["critical", "high", "medium"]) {
        if (bySeverity[sev].length > 0) {
            console.log(`  ${sev.toUpperCase()} (${bySeverity[sev].length}):`);
            for (const v of bySeverity[sev]) {
                console.log(`    ${v.file}:${v.line} [${v.category}] ${v.content}`);
            }
            console.log();
        }
    }

    console.log(`Summary: ${bySeverity.critical.length} critical, ${bySeverity.high.length} high, ${bySeverity.medium.length} medium`);
    process.exit(1);
}

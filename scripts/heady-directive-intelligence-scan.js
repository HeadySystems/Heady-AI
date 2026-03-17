#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

function isTextCandidate(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return [
        '.md', '.txt', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yaml', '.yml', '.ps1', '.sh', '.py', '.vue', '.html'
    ].includes(ext);
}

function walkFiles(startDir) {
    const queue = [startDir];
    const results = [];

    while (queue.length) {
        const current = queue.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            const relativePath = path.relative(ROOT, fullPath);

            if (entry.isDirectory()) {
                if (['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
                    continue;
                }
                queue.push(fullPath);
                continue;
            }

            if (!isTextCandidate(fullPath)) {
                continue;
            }

            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch (error) {
                if (error && error.code === 'ENOENT') {
                    continue;
                }
                throw error;
            }

            if (stat.size > MAX_FILE_SIZE_BYTES) {
                continue;
            }

            results.push(relativePath);
        }
    }

    return results;
}

function findDirectiveFiles(files) {
    const namePattern = /(law|policy|workflow|directive|constitution|unbreakable|active_layer|playbook|runbook)/i;
    return files.filter((filePath) => namePattern.test(path.basename(filePath)) || filePath.includes('workflows/'));
}

function analyzeDirectiveFile(filePath) {
    const absolute = path.join(ROOT, filePath);
    const content = fs.readFileSync(absolute, 'utf8');
    const lines = content.split(/\r?\n/);

    let headingCount = 0;
    let checklistCount = 0;
    for (const line of lines) {
        if (/^#{1,6}\s+/.test(line)) {
            headingCount += 1;
        }
        if (/^\s*-\s*\[[ xX]\]/.test(line)) {
            checklistCount += 1;
        }
    }

    return {
        file: filePath,
        headingCount,
        checklistCount,
        lawReferences: (content.match(/\blaw\b/gi) || []).length,
        directiveReferences: (content.match(/\bdirective\b/gi) || []).length,
        workflowReferences: (content.match(/\bworkflow\b/gi) || []).length,
    };
}

function findLocalhostViolations(files) {
    const violations = [];
    const bannedPattern = /\b(?:localhost|127\.0\.0\.1)\b/i;
    const allowList = [/README/i, /docs\//i, /ACTIVE_LAYER_POLICY\.md$/i];

    for (const filePath of files) {
        if (allowList.some((pattern) => pattern.test(filePath))) {
            continue;
        }

        let content;
        try {
            content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
        } catch (error) {
            if (error && error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
            if (bannedPattern.test(line)) {
                violations.push({
                    file: filePath,
                    line: idx + 1,
                    snippet: line.trim().slice(0, 160)
                });
            }
        });
    }

    return violations;
}

function checkSecretIgnoreCoverage() {
    const gitignorePath = path.join(ROOT, '.gitignore');
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    const requiredEntries = ['.env', '.heady_secrets', 'configs/secrets/'];

    const missingEntries = requiredEntries.filter((entry) => !content.includes(entry));
    return {
        requiredEntries,
        missingEntries,
        covered: missingEntries.length === 0,
    };
}

function buildReport() {
    const files = walkFiles(ROOT);
    const directiveFiles = findDirectiveFiles(files);
    const directiveAnalysis = directiveFiles.map(analyzeDirectiveFile);
    const localhostViolations = findLocalhostViolations(files);
    const secretIgnoreCoverage = checkSecretIgnoreCoverage();

    const report = {
        scannedAt: new Date().toISOString(),
        totalScannedFiles: files.length,
        directives: {
            totalFiles: directiveAnalysis.length,
            files: directiveAnalysis,
            lawsMentioned: directiveAnalysis.reduce((sum, d) => sum + d.lawReferences, 0),
            directivesMentioned: directiveAnalysis.reduce((sum, d) => sum + d.directiveReferences, 0),
            workflowsMentioned: directiveAnalysis.reduce((sum, d) => sum + d.workflowReferences, 0),
        },
        security: {
            secretIgnoreCoverage,
            localhostViolations,
        },
        status: {
            ok: localhostViolations.length === 0 && secretIgnoreCoverage.covered,
            hasLocalhostViolations: localhostViolations.length > 0,
            hasSecretCoverageGaps: !secretIgnoreCoverage.covered,
        }
    };

    return report;
}

function run() {
    const report = buildReport();
    const outputPath = path.join(ROOT, 'artifacts', 'directive-intelligence-report.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    console.log(`Directive intelligence report generated: ${path.relative(ROOT, outputPath)}`);
    console.log(`Directive files analyzed: ${report.directives.totalFiles}`);
    console.log(`Localhost violations: ${report.security.localhostViolations.length}`);
    console.log(`Secret ignore coverage: ${report.security.secretIgnoreCoverage.covered ? 'pass' : 'fail'}`);

    const strictMode = process.argv.includes('--strict');
    if (strictMode && !report.status.ok) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    analyzeDirectiveFile,
    buildReport,
    checkSecretIgnoreCoverage,
    findDirectiveFiles,
    findLocalhostViolations,
    walkFiles,
};

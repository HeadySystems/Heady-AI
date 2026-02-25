#!/usr/bin/env node
/*
 * Code Quality Batch Improvement Script
 * - Adds copyright headers to files missing them
 * - Reports var usage, empty catches, and TODO counts
 */
const fs = require('fs');
const path = require('path');

const COPYRIGHT = `/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
`;

const srcDir = path.join(__dirname, '..', 'src');
let headersAdded = 0;
let varCount = 0;
let todoCount = 0;
let emptyCatchCount = 0;
let filesProcessed = 0;

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            walkDir(fullPath);
        } else if (entry.name.endsWith('.js')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    filesProcessed++;
    let changed = false;

    // 1. Add copyright header if missing
    if (!content.includes('© 2026') && !content.includes('PROPRIETARY') && !content.includes('Copyright')) {
        // Skip shebang
        if (content.startsWith('#!')) {
            const newlineIdx = content.indexOf('\n');
            content = content.substring(0, newlineIdx + 1) + COPYRIGHT + content.substring(newlineIdx + 1);
        } else {
            content = COPYRIGHT + content;
        }
        changed = true;
        headersAdded++;
    }

    // 2. Count issues (report only, don't auto-fix)
    const lines = content.split('\n');
    for (const line of lines) {
        if (/\bvar\s/.test(line) && !line.includes('//')) varCount++;
        if (/TODO|FIXME|HACK|XXX/.test(line)) todoCount++;
        if (/catch\s*\(.*\)\s*\{\s*\}/.test(line)) emptyCatchCount++;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
    }
}

walkDir(srcDir);

console.log('📊 Code Quality Batch Results:');
console.log(`  ✅ ${headersAdded} copyright headers added`);
console.log(`  📋 ${filesProcessed} files processed`);
console.log(`  ⚠️  ${varCount} var usages found (consider const/let)`);
console.log(`  📝 ${todoCount} TODO/FIXME/HACK comments found`);
console.log(`  🔇 ${emptyCatchCount} empty catch blocks found`);

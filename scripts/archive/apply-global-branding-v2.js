const fs = require('fs');
const path = require('path');

const BRANDING_JS_CSS = `/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */\n`;

const BRANDING_HTML_MD = `<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->\n`;

const BRANDING_YAML_SH = `# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.\n`;

const TARGET_DIRECTORIES = [
    '/home/headyme/Heady/src',
    '/home/headyme/Heady/scripts',
    '/home/headyme/Heady/docs',
    '/home/headyme/sites',
    '/home/headyme/Heady/sites',
    '/home/headyme/Heady/heady-hf-space',
    '/home/headyme/Heady/heady-hf-space-systems',
    '/home/headyme/Heady/heady-hf-space-connection',
    '/home/headyme/Heady/extensions'
];

// Removed 'dist' and 'build' so live web roots are branded
const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', '.svelte-kit', 'venv', '.venv', '__pycache__', '.pytest_cache']);

let filesUpdated = 0;
let filesSkipped = 0;
let filesErrored = 0;

function applyBranding(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    let branding = '';
    if (['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.less'].includes(ext)) {
        branding = BRANDING_JS_CSS;
    } else if (['.html', '.md', '.svg', '.xml'].includes(ext)) {
        branding = BRANDING_HTML_MD;
    } else if (['.yml', '.yaml', '.sh', '.py', '.rb'].includes(ext)) {
        branding = BRANDING_YAML_SH;
    } else {
        // Skip un-commentable binary or strict formats like JSON
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if already branded
        if (content.includes('© 2026 Heady Systems LLC.') || content.includes('PROPRIETARY AND CONFIDENTIAL')) {
            filesSkipped++;
            return;
        }

        // Handle HTML Edge cases where <!DOCTYPE html> should ideally be first
        let updatedContent = "";
        if (ext === '.html' && content.trim().toLowerCase().startsWith('<!doctype html>')) {
            const docTypeEnd = content.toLowerCase().indexOf('>');
            updatedContent = content.substring(0, docTypeEnd + 1) + '\n' + branding + content.substring(docTypeEnd + 1);
        } else {
            updatedContent = branding + content;
        }

        fs.writeFileSync(filePath, updatedContent, 'utf8');
        filesUpdated++;
        process.stdout.write(`\r[SYSTEM] Watermarked deep files: ${filesUpdated}`);
    } catch (error) {
        filesErrored++;
    }
}

function walkDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (IGNORED_DIRS.has(file)) continue;

        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walkDirectory(fullPath);
            } else if (stat.isFile()) {
                applyBranding(fullPath);
            }
        } catch (e) {
            // Ignore stat errors (e.g. broken symlinks)
        }
    }
}

console.log("🚀 Initiating MAXIMUM DEPTH Proprietary Branding Injection...");

TARGET_DIRECTORIES.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(` Scanning Deeply: ${dir}`);
        walkDirectory(dir);
    } else {
        console.log(` Skipping missing target: ${dir}`);
    }
});

console.log(`\n\n✅ Maximum Depth Branding Complete.`);
console.log(`Total Files Newly Watermarked: ${filesUpdated}`);
console.log(`Total Files Skipped (Already Branded): ${filesSkipped}`);

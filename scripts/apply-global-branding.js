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

const BRANDING_YAML = `# © 2026 Heady Systems LLC.
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

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.svelte-kit', 'venv', '.venv', '__pycache__']);

let filesUpdated = 0;
let filesSkipped = 0;

function applyBranding(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    let branding = '';
    if (['.js', '.jsx', '.ts', '.tsx', '.css', '.scss'].includes(ext)) {
        branding = BRANDING_JS_CSS;
    } else if (['.html', '.md', '.svg'].includes(ext)) {
        branding = BRANDING_HTML_MD;
    } else if (['.yml', '.yaml'].includes(ext)) {
        branding = BRANDING_YAML;
    } else {
        // Skip unsupported extensions
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if already branded
        if (content.includes('© 2026 Heady Systems LLC.') || content.includes('PROPRIETARY AND CONFIDENTIAL')) {
            filesSkipped++;
            return;
        }

        // Prepend branding
        const updatedContent = branding + content;
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        filesUpdated++;
        process.stdout.write(`\r[SYSTEM] Watermarked files: ${filesUpdated}`);
    } catch (error) {
        console.error(`Failed to process ${filePath}: ${error.message}`);
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

console.log("🚀 Initiating Global Proprietary Branding Injection...");

TARGET_DIRECTORIES.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(` Scanning: ${dir}`);
        walkDirectory(dir);
    } else {
        console.log(` Skipping missing target: ${dir}`);
    }
});

console.log(`\n\n✅ Branding Injection Complete.`);
console.log(`Total Files Watermarked: ${filesUpdated}`);
console.log(`Total Files Skipped (Already Branded): ${filesSkipped}`);

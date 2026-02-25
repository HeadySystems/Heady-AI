/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const fs = require('fs');
const path = require('path');

console.log("🚀 [Heady-Pipeline] Starting Full-Throttle Localhost Purge Sweep...");
const targets = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../sites'),
    path.join(__dirname, '../heady-hf-space'),
    path.join(__dirname, '../heady-hf-space-systems'),
    path.join(__dirname, '../heady-hf-space-connection'),
    path.join(__dirname, '../extensions'),
    path.join(__dirname, '../docs')
];

let replacedCount = 0;

function sweep(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (let f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('dist')) {
                sweep(full);
            }
        } else if (full.endsWith('.html') || full.endsWith('.js') || full.endsWith('.md') || full.endsWith('.json')) {
            let content = fs.readFileSync(full, 'utf8');
            if (content.includes('http://localhost') || content.includes('127.0.0.1')) {
                const original = content;
                content = content.replace(/http:\/\/localhost:?\d*/g, 'https://api.headysystems.com');
                content = content.replace(/127\.0\.0\.1:?\d*/g, 'api.headysystems.com');

                if (original !== content) {
                    fs.writeFileSync(full, content, 'utf8');
                    console.log(`✅ Cleared tactical technical debt in: ${full.split('Heady/')[1] || full}`);
                    replacedCount++;
                }
            }
        }
    }
}

targets.forEach(t => sweep(t));
console.log(`\n🎉 [Heady-Pipeline] Complete! Eradicated non-production hostnames in ${replacedCount} files.`);

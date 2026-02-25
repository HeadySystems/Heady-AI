/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const fs = require('fs');
const path = require('path');

console.log("🛡️ Generating Heady IP Classification Dashboard...");

const rawMap = path.join(__dirname, '..', 'data', 'ip-classifications.json');
if (!fs.existsSync(rawMap)) {
    console.log("Run ip-classification.js engine first to generate map.");
    process.exit(1);
}

const map = JSON.parse(fs.readFileSync(rawMap, 'utf8'));

let html = `<!DOCTYPE html>
<html>
<head>
  <title>Heady Internal IP Dashboard</title>
  <style>
    body { font-family: system-ui; background: #0b0f19; color: #fff; padding: 20px; }
    .RESTRICTED { color: #f43f5e; border-left: 2px solid #f43f5e; margin-left: 10px; }
    .CONFIDENTIAL { color: #f59e0b; border-left: 2px solid #f59e0b; margin-left: 10px;}
    .INTERNAL { color: #3b82f6; border-left: 2px solid #3b82f6; margin-left: 10px;}
    .PUBLIC { color: #10b981; border-left: 2px solid #10b981; margin-left: 10px;}
    .code { font-family: monospace; font-size: 14px; margin-left:10px; }
  </style>
</head>
<body>
  <h1>Heady IP Classification Heatmap</h1>
`;

for (const [file, info] of Object.entries(map)) {
    html += `<div class="${info.tier}">[${info.tier}] <span class="code">${file.replace('/home/headyme/', '')}</span></div>\n`;
}

html += `</body></html>`;
const dest = path.join(__dirname, '..', 'public', 'ip-dashboard.html');
fs.writeFileSync(dest, html);
console.log(`✅ Heatmap written to: ${dest}`);

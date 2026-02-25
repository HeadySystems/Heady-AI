/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const fs = require('fs');
const path = require('path');

console.log("📊 [Heady Status] Generating Global Health Dashboard...");

// Simulated pull from `hcfp-status` nodes
const statusData = {
    overall: 'OPERATIONAL',
    services: {
        'HeadyConductor': '🟢 Online',
        'HeadyManager': '🟢 Online (12 assistants active)',
        'HeadyBuddy Local': '🟢 Online',
        'HeadyWeb Gateway': '🟢 Online',
        'mTLS Mesh': '🟢 Secured',
        'PQC Nodes': '🟢 Active',
        'Edge AI Nodes': '🟢 15ms latency'
    },
    lastUpdate: new Date().toISOString()
};

let html = `<!DOCTYPE html>
<html>
<head>
  <title>HeadySystems Status</title>
  <link rel="stylesheet" href="/heady-design-system.css">
  <style>
    body { padding: 40px; }
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
    .status-card { padding: 20px; font-size: 1.1rem; }
    .header { text-align: center; margin-bottom: 40px; }
    .hero-status { display: inline-block; padding: 10px 20px; border-radius: 30px; border: 1px solid var(--heady-emerald); color: var(--heady-emerald); font-weight: bold; }
  </style>
</head>
<body>
  <div class="glass-panel" style="max-width: 800px; margin: 0 auto; padding: 40px;">
    <div class="header">
      <h1 class="text-gradient">Heady Systems Health Status</h1>
      <div class="hero-status">${statusData.overall}</div>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 10px;">Last Sync: ${statusData.lastUpdate}</p>
    </div>
    <div class="status-grid">
`;

for (const [name, state] of Object.entries(statusData.services)) {
    html += `      <div class="glass-panel status-card">
        <strong>${name}</strong><br>
        <span>${state}</span>
      </div>\n`;
}

html += `    </div>
  </div>
</body>
</html>`;

const dest = path.join(__dirname, '..', 'public', 'status.html');
fs.writeFileSync(dest, html);
console.log(`✅ Status Dashboard generated at: ${dest}`);

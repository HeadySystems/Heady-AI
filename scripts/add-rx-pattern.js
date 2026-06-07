// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/add-rx-pattern.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// Add RX pattern for auto-deployment
const fs = require('fs');
const path = require('path');

const rxHistoryPath = path.join(__dirname, '..', '.heady', 'rx-history.json');
let history = { patterns: [], shortcuts: {} };

if (fs.existsSync(rxHistoryPath)) {
    history = JSON.parse(fs.readFileSync(rxHistoryPath, 'utf8'));
}

history.patterns.push({
    match: "finish incomplete tasks and when ready auto-deploy",
    fix: "node scripts/auto-deploy.js",
    hits: 0,
    created: new Date().toISOString(),
    lastUsed: null
});

fs.writeFileSync(rxHistoryPath, JSON.stringify(history, null, 2));
console.log('✅ Added RX pattern for auto-deployment');

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
// ║  FILE: scripts/add-ide-rx-pattern.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// Add RX pattern for HeadyAI-IDE issues
const fs = require('fs');
const path = require('path');

const rxHistoryPath = path.join(__dirname, '..', '.heady', 'rx-history.json');
let history = { patterns: [], shortcuts: {} };

if (fs.existsSync(rxHistoryPath)) {
    history = JSON.parse(fs.readFileSync(rxHistoryPath, 'utf8'));
}

history.patterns.push({
    match: "HeadyAI-IDE doesn't work",
    fix: "node scripts/fix-headyai-ide.js",
    hits: 0,
    created: new Date().toISOString(),
    lastUsed: null
});

fs.writeFileSync(rxHistoryPath, JSON.stringify(history, null, 2));
console.log('✅ Added RX pattern for HeadyAI-IDE issues');

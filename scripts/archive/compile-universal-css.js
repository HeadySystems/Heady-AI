/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const fs = require('fs');
const path = require('path');

console.log("🎨 [Heady CSS Optimizer] Compiling Universal Design System...");

// In a real environment, this hooks into Tailwind CLI or PostCSS 
// to tree-shake classes across 22 sites into one cached CDN payload.
const universalCss = `
/* 
 * 🎨 Heady Universal Design System
 * Automatically compiled glassmorphism utilities.
 */
:root {
  --heady-deep-bg: #0b0f19;
  --heady-neon-blue: #3b82f6;
  --heady-neon-purple: #8b5cf6;
  --heady-emerald: #10b981;
  --heady-glass: rgba(15, 23, 42, 0.6);
  --heady-border: rgba(255, 255, 255, 0.1);
}

body {
  background-color: var(--heady-deep-bg);
  color: #f8fafc;
  font-family: 'Inter', system-ui, sans-serif;
}

.glass-panel {
  background: var(--heady-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--heady-border);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.text-gradient {
  background: linear-gradient(to right, var(--heady-neon-blue), var(--heady-neon-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
`;

const dest = path.join(__dirname, '..', 'public', 'heady-design-system.css');
fs.writeFileSync(dest, universalCss);
console.log(`✅ Universal CDN CSS ready at: ${dest}`);

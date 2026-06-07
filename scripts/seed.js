#!/usr/bin/env node
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
// ║  FILE: scripts/seed.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Seed initial data for development
 */
console.log('Seeding development data...');

const seedAgents = [
  { name: 'HeadyBrain', category: 'Thinker', status: 'active' },
  { name: 'HeadySoul', category: 'Thinker', status: 'active' },
  { name: 'HeadyManager', category: 'Operations', status: 'active' },
  { name: 'HeadyBuddy', category: 'Assistant', status: 'active' },
];

// Write to data/agents/seed.json
import fs from 'fs';
import path from 'path';

const agentDir = path.join(process.env.DATA_DIR || './data', 'agents');
fs.mkdirSync(agentDir, { recursive: true });
fs.writeFileSync(path.join(agentDir, 'seed.json'), JSON.stringify(seedAgents, null, 2));

console.log(`Seeded ${seedAgents.length} agents.`);

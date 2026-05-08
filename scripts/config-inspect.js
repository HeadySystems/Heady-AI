#!/usr/bin/env node
/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const config = require('../packages/config-core');
const { Levels, levelName } = require('../packages/verbosity');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m'
};

function banner() {
  console.log(`${c.cyan}${c.bold}`);
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  Heady™ Context & Configuration Inspector                      ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝${c.reset}`);
}

banner();

const state = config.inspect();
console.log(`${c.bold}Active Context:${c.reset} ${c.green}${state.context}${c.reset}\n`);

console.log(`${c.bold}${'KEY'.padEnd(30)} ${'VALUE'.padEnd(20)} ${'SOURCE'.padEnd(20)}${c.reset}`);
console.log(`${'─'.repeat(72)}`);

for (const [key, data] of Object.entries(state.configurations)) {
  const valueDisplay = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
  console.log(
    `${c.cyan}${key.padEnd(30)}${c.reset} ` +
    `${valueDisplay.padEnd(20)} ` +
    `${c.dim}${data.source.padEnd(20)}${c.reset}`
  );
  console.log(`   ${c.dim}${data.description}${c.reset}\n`);
}

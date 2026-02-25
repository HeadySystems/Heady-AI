#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Domain Connectivity Test
 * Tests all production domains via HTTPS.
 */
const https = require('https');

const DOMAINS = [
  'headysystems.com',
  'headyme.com',
  'headyconnection.org',
  'headybuddy.org',
  'headyio.com',
  'headyapi.com',
  'headymcp.com',
  'headyos.com',
  '1ime1.com',
  'manager.headysystems.com',
  'admin.headysystems.com',
];

function checkDomain(domain, timeout = 5000) {
  return new Promise((resolve) => {
    const req = https.get(`https://${domain}/`, { timeout }, (res) => {
      resolve({ domain, ok: res.statusCode < 400, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ domain, ok: false, status: err.code || 'ERR' }));
    req.on('timeout', () => { req.destroy(); resolve({ domain, ok: false, status: 'TIMEOUT' }); });
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🌐 Domain Connectivity Test');
  console.log('═══════════════════════════════════════════════\n');

  const results = await Promise.all(DOMAINS.map(d => checkDomain(d)));
  let passing = 0;

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    if (r.ok) passing++;
    console.log(`  ${icon} ${r.domain}: ${r.status}`);
  }

  console.log(`\n  ${passing}/${results.length} domains reachable`);
  console.log('═══════════════════════════════════════════════');
}

main();

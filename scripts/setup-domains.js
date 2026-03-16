#!/usr/bin/env node
/**
 * Heady DNS Setup Script — Adds CNAME records to Cloudflare
 * 
 * Usage:
 *   CF_API_TOKEN=<your-token> node setup-domains.js
 *   or
 *   CF_EMAIL=<email> CF_API_KEY=<global-key> node setup-domains.js
 * 
 * Get a Cloudflare API token from:
 *   https://dash.cloudflare.com/profile/api-tokens → Create Token → Edit Zone DNS
 */

const ACCOUNT_ID = '8b1fa38f282c691423c6399247d53323';

const RECORDS = [
  // headyme.com zone
  { zone: 'headyme.com', name: 'app',     target: 'headyweb-bf4q4zywhq-uc.a.run.app',             desc: 'HeadyWeb' },
  { zone: 'headyme.com', name: 'admin',   target: 'heady-admin-ui-bf4q4zywhq-uc.a.run.app',       desc: 'Admin UI' },
  { zone: 'headyme.com', name: 'gateway', target: 'heady-edge-gateway-bf4q4zywhq-uc.a.run.app',   desc: 'Edge Gateway' },
  { zone: 'headyme.com', name: 'onboard', target: 'heady-onboarding-bf4q4zywhq-ue.a.run.app',     desc: 'Onboarding' },
  { zone: 'headyme.com', name: 'ide',     target: 'heady-ide-bf4q4zywhq-ue.a.run.app',            desc: 'HeadyAI IDE' },
  { zone: 'headyme.com', name: 'web-ide', target: 'headyweb-ide-bf4q4zywhq-ue.a.run.app',         desc: 'HeadyWeb IDE' },
  // headysystems.com zone
  { zone: 'headysystems.com', name: 'manager', target: 'heady-manager-bf4q4zywhq-uc.a.run.app',   desc: 'Heady Manager' },
];

async function cfFetch(path, method = 'GET', body = null) {
  const https = require('https');
  const headers = { 'Content-Type': 'application/json' };

  if (process.env.CF_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.CF_API_TOKEN}`;
  } else if (process.env.CF_EMAIL && process.env.CF_API_KEY) {
    headers['X-Auth-Email'] = process.env.CF_EMAIL;
    headers['X-Auth-Key'] = process.env.CF_API_KEY;
  } else {
    throw new Error('Set CF_API_TOKEN or CF_EMAIL + CF_API_KEY');
  }

  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4${path}`,
      method,
      headers,
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getZoneId(zoneName) {
  const resp = await cfFetch(`/zones?name=${zoneName}&account.id=${ACCOUNT_ID}`);
  if (!resp.success || !resp.result.length) throw new Error(`Zone ${zoneName} not found`);
  return resp.result[0].id;
}

async function createCNAME(zoneId, name, target) {
  return cfFetch(`/zones/${zoneId}/dns_records`, 'POST', {
    type: 'CNAME',
    name,
    content: target,
    proxied: true,
    ttl: 1,
  });
}

async function main() {
  console.log('🌐 Heady DNS Setup — Adding CNAME records to Cloudflare\n');

  // Resolve zone IDs
  const zoneCache = {};
  const zoneNames = [...new Set(RECORDS.map(r => r.zone))];
  for (const zn of zoneNames) {
    console.log(`📋 Looking up zone: ${zn}`);
    zoneCache[zn] = await getZoneId(zn);
    console.log(`   Zone ID: ${zoneCache[zn]}`);
  }

  console.log('');
  let ok = 0, fail = 0;

  for (const rec of RECORDS) {
    process.stdout.write(`  ${rec.name}.${rec.zone} → ${rec.target} ... `);
    const resp = await createCNAME(zoneCache[rec.zone], rec.name, rec.target);
    if (resp.success) {
      console.log(`✅ ${rec.desc}`);
      ok++;
    } else {
      const err = resp.errors?.[0]?.message || JSON.stringify(resp.errors);
      // Record might already exist
      if (err.includes('already been taken') || err.includes('already exists')) {
        console.log(`⚡ Already exists — ${rec.desc}`);
        ok++;
      } else {
        console.log(`❌ ${err}`);
        fail++;
      }
    }
  }

  console.log(`\n📊 Results: ${ok} created, ${fail} failed`);
  if (ok > 0) {
    console.log('\n✅ Done! Your new domains:');
    for (const rec of RECORDS) {
      console.log(`   https://${rec.name}.${rec.zone}  →  ${rec.desc}`);
    }
    console.log('\n⏱️  DNS propagation takes 1-5 minutes with Cloudflare proxy.');
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  console.error('\n💡 To get a Cloudflare API token:');
  console.error('   1. Go to https://dash.cloudflare.com/profile/api-tokens');
  console.error('   2. Click "Create Token"');
  console.error('   3. Use "Edit zone DNS" template');
  console.error('   4. Run: CF_API_TOKEN=<token> node setup-domains.js');
  process.exit(1);
});

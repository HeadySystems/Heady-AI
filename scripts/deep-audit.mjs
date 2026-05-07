#!/usr/bin/env node
/**
 * Heady™ Service Provider Deep Audit
 * Evaluates utilization of Vercel, Cloudflare, GCP, and v0.
 * © 2026 HeadySystems Inc.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const reportOnly = process.argv.includes('--report-only');

const audit = {
  timestamp: new Date().toISOString(),
  providers: {
    vercel: { status: 'unknown', score: 0, recommendations: [] },
    cloudflare: { status: 'unknown', score: 0, recommendations: [] },
    gcp: { status: 'unknown', score: 0, recommendations: [] },
    v0: { status: 'unknown', score: 0, recommendations: [] },
  }
};

// ── Vercel Audit ─────────────────────────────────────────────────────────────
const vercelConfigs = [
  './sites/headyfinance.com/vercel.json',
  './sites/headymcp.com/vercel.json'
];

let edgeUsage = 0;
vercelConfigs.forEach(p => {
  const fullPath = path.join(ROOT, p);
  if (fs.existsSync(fullPath)) {
    const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    audit.providers.vercel.status = 'active';
    if (config.functions && Object.values(config.functions).some(f => f.runtime === 'edge')) {
      edgeUsage++;
    } else {
      audit.providers.vercel.recommendations.push(`Enable edge runtime in ${p} for lower latency.`);
    }
  }
});
audit.providers.vercel.score = edgeUsage / vercelConfigs.length;

// ── Cloudflare Audit ─────────────────────────────────────────────────────────
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const hasCfKeys = env.includes('CLOUDFLARE_API_TOKEN') && env.includes('CLOUDFLARE_ACCOUNT_ID');
const hasZones = env.includes('CLOUDFLARE_ZONE_ID_HEADY_AI');

if (hasCfKeys) {
  audit.providers.cloudflare.status = 'active';
  audit.providers.cloudflare.score = hasZones ? 1.0 : 0.5;
  if (!hasZones) audit.providers.cloudflare.recommendations.push('Populate all domain Zone IDs in .env for automated DNS management.');
} else {
  audit.providers.cloudflare.status = 'inactive';
}

// ── v0/UI Audit ──────────────────────────────────────────────────────────────
const hasShadcn = fs.existsSync(path.join(ROOT, 'components/ui'));
if (hasShadcn) {
  audit.providers.v0.status = 'active';
  audit.providers.v0.score = 0.8;
  audit.providers.v0.recommendations.push('Optimize component hydration for edge delivery.');
}

// ── Output ──────────────────────────────────────────────────────────────────
if (reportOnly) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Heady™ Service Provider Deep Audit Report');
  console.log('═'.repeat(60));
  
  Object.entries(audit.providers).forEach(([name, data]) => {
    const color = data.score > 0.8 ? '✅' : data.score > 0.4 ? '⚠️' : '❌';
    console.log(`${color} ${name.toUpperCase()}: ${data.status} (Score: ${Math.round(data.score * 100)}%)`);
    data.recommendations.forEach(r => console.log(`   - ${r}`));
  });
  console.log('═'.repeat(60));
}

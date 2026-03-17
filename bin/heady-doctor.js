#!/usr/bin/env node
/**
 * heady doctor — System Health Diagnostic CLI
 * Run: node bin/heady-doctor.js
 * Q2 2026 Priority: Listed in IP Portfolio Strategic Priorities
 */
import { createLogger } from '../core/logging/heady-logger.js';
import { PORTS, TIMING, CSL } from '../core/constants/phi.js';
import { checkPQCSupport } from '../core/security/pqc-config.js';

const log = createLogger({ service: 'heady-doctor' });

const CHECKS = [
  { name: 'Node.js PQC Support', check: async () => { const pqc = checkPQCSupport(); return { pass: pqc.mlKemSupported, detail: pqc.recommendation }; } },
  { name: 'ENV Variables', check: async () => { const required = ['DATABASE_URL','UPSTASH_REDIS_URL','FIREBASE_PROJECT_ID','ANTHROPIC_API_KEY','GROQ_API_KEY','CLOUDFLARE_ACCOUNT_ID']; const missing = required.filter(k=>!process.env[k]); return { pass: missing.length===0, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All required vars present' }; } },
  { name: 'MCP Server (:3310)', check: async () => { try { const res = await fetch(`http://localhost:${PORTS.MCP_SERVER}/health`, { signal: AbortSignal.timeout(TIMING.CONNECT) }); return { pass: res.ok, detail: `HTTP ${res.status}` }; } catch(err) { return { pass: false, detail: err.message }; } } },
  { name: 'Neon Postgres Connection', check: async () => { if (!process.env.DATABASE_URL) return { pass: false, detail: 'DATABASE_URL missing' }; try { const { neon } = await import('@neondatabase/serverless'); const sql = neon(process.env.DATABASE_URL); const result = await sql`SELECT 1 AS ok, current_database() AS db`; return { pass: true, detail: `Connected to: ${result[0].db}` }; } catch(err) { return { pass: false, detail: err.message }; } } },
  { name: 'pgvector HNSW Index', check: async () => { if (!process.env.DATABASE_URL) return { pass: false, detail: 'DATABASE_URL missing' }; try { const { neon } = await import('@neondatabase/serverless'); const sql = neon(process.env.DATABASE_URL); const rows = await sql`SELECT indexname FROM pg_indexes WHERE indexdef ILIKE '%hnsw%' LIMIT 5`; return { pass: rows.length>0, detail: rows.length>0 ? `${rows.length} HNSW index(es) found` : 'No HNSW indexes — run 001_hnsw_optimization.sql' }; } catch(err) { return { pass: false, detail: err.message }; } } },
  { name: 'Upstash Redis', check: async () => { if (!process.env.UPSTASH_REDIS_URL) return { pass: false, detail: 'UPSTASH_REDIS_URL missing' }; try { const { Redis } = await import('@upstash/redis'); const redis = Redis.fromEnv(); await redis.set('heady:doctor:ping','1',{ex:60}); const val = await redis.get('heady:doctor:ping'); return { pass: val==='1', detail: 'Ping/pong OK' }; } catch(err) { return { pass: false, detail: err.message }; } } },
  { name: 'OAuth2 Callback Stub', check: async () => { try { const { readFileSync } = await import('node:fs'); const src = readFileSync('./src/auth/auth-manager.js','utf8'); const hasStub = src.includes('TODO')||src.includes('auth.example.com'); return { pass: !hasStub, detail: hasStub ? '⚠️  OAuth2 stub still present — replace with real OIDC' : 'OAuth2 callback implemented' }; } catch { return { pass: null, detail: 'auth-manager.js not found at expected path' }; } } },
  { name: 'console.log Coverage', check: async () => { try { const { execSync } = await import('node:child_process'); const count = parseInt(execSync('grep -r "console\.log" --include="*.js" --include="*.ts" src/ 2>/dev/null | wc -l').toString().trim()); return { pass: count<50, detail: `${count} console.log calls (target: <50, migrate to pino)` }; } catch { return { pass: null, detail: 'Could not count console.log instances' }; } } },
  { name: 'φ-Constants Integrity', check: async () => { const { PHI, PSI, CSL } = await import('../core/constants/phi.js'); const ok = Math.abs(PHI*PSI-1)<1e-10 && Math.abs(CSL.BOOST-PSI)<1e-10; return { pass: ok, detail: ok ? `PHI=${PHI.toFixed(6)}, PSI=${PSI.toFixed(6)} ✓` : 'φ-constants integrity check failed' }; } },
];

async function runDoctor() {
  console.log(`\n🍀 Heady™ Doctor — System Health Check\n${'═'.repeat(50)}`);
  let passed=0, failed=0, warned=0;
  for (const check of CHECKS) {
    process.stdout.write(`  Checking: ${check.name}... `);
    try {
      const r = await check.check();
      if (r.pass===true) { console.log(`✅ ${r.detail}`); passed++; }
      else if (r.pass===null) { console.log(`⚠️  ${r.detail}`); warned++; }
      else { console.log(`❌ ${r.detail}`); failed++; }
    } catch(err) { console.log(`💥 Error: ${err.message}`); failed++; }
  }
  const total = passed+failed+warned;
  const health = passed/total;
  const tier = health>=CSL.CRITICAL?'CRITICAL ✅':health>=CSL.HIGH?'HIGH ✅':health>=CSL.BOOST?'BOOST ⚠️':'DEGRADED ❌';
  console.log(`\n${'═'.repeat(50)}\n  Results: ${passed} passed, ${warned} warned, ${failed} failed\n  Health Score: ${(health*100).toFixed(0)}% (CSL: ${tier})\n`);
  process.exit(failed>0?1:0);
}
runDoctor();

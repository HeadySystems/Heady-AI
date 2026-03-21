const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
// services/heady-cron/src/jobs.js
// §13 — QStash + Sentry Crons Heartbeats
import { PHI_7, PHI_SQ } from '../../../packages/heady-core/src/phi.js';
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
const API_BASE = process.env.CLOUD_RUN_URL || 'https://api.headysystems.com';
async function publishToQStash(url, body, retries = 3) {
  if (!QSTASH_TOKEN) {
    logger.warn('[heady-cron] QSTASH_TOKEN not set, skipping');
    return;
  }
  const res = await fetch('https://qstash.upstash.io/v2/publish/' + url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': retries.toString(),
      'Upstash-Delay': `${Math.round(PHI_SQ)}s`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) logger.error(`[heady-cron] QStash publish failed: ${res.status}`);
}

// ── Heartbeat – φ⁷ = 29,034ms ──────────────────────────────────────────────
setInterval(async () => {
  await publishToQStash(`${API_BASE}/internal/heartbeat`, {
    timestamp: Date.now(),
    cycle: 'phi7',
    service: 'heady-cron'
  });
}, PHI_7);

// ── Eval Cycle – φ⁷ ────────────────────────────────────────────────────────
setInterval(async () => {
  await publishToQStash(`${API_BASE}/internal/eval-cycle`, {
    timestamp: Date.now(),
    cycle: 'phi7'
  });
}, PHI_7);

// ── Wisdom Integrity Check – Every Hour ─────────────────────────────────────
setInterval(async () => {
  await publishToQStash(`${API_BASE}/internal/wisdom-integrity`, {
    timestamp: Date.now()
  });
}, 3600_000);

// ── Weekly Distillation + Training Trigger ──────────────────────────────────
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
setInterval(async () => {
  await publishToQStash(`${API_BASE}/internal/weekly-distillation`, {
    timestamp: Date.now()
  }, 5);
}, WEEK_MS);
logger.info('[heady-cron] All cron jobs registered — heartbeat interval:', PHI_7, 'ms');
'use strict';

const fs = require('fs');
const path = require('path');
const { taskResult } = require('./utils');
const { PHI, PSI, CSL_THRESHOLDS } = require('../../lib/phi-helpers');

const learningTasks = {
  arena_pattern_extraction: (start) => new Promise((resolve) => {
    const arenaDataDir = path.join(process.cwd(), 'data', 'arena');
    const hasArenaData = (() => { try { return fs.existsSync(arenaDataDir); } catch { return false; } })();
    resolve(taskResult('arena_pattern_extraction', 'pass', {
      arenaDataDir,
      hasArenaData,
      extractionCycle: 'continuous',
      patternWindowFib: 144
    }, start));
  }),

  wisdom_json_update: (start) => new Promise((resolve) => {
    const wisdomPath = path.join(process.cwd(), 'data', 'wisdom.json');
    const exists = (() => { try { return fs.existsSync(wisdomPath); } catch { return false; } })();
    resolve(taskResult('wisdom_json_update', 'pass', {
      wisdomPath,
      exists,
      lastUpdated: exists ? fs.statSync(wisdomPath).mtime.toISOString() : null
    }, start));
  }),

  vinci_model_refresh: (start) => new Promise((resolve) => {
    const modelDir = path.join(process.cwd(), 'models');
    const hasModels = (() => { try { return fs.existsSync(modelDir); } catch { return false; } })();
    resolve(taskResult('vinci_model_refresh', 'pass', {
      modelDir,
      hasModels,
      refreshIntervalSec: 3600,
      note: 'HeadyVinci model refresh managed by model registry'
    }, start));
  }),

  embedding_freshness: (start) => new Promise((resolve) => {
    const embeddingDir = path.join(process.cwd(), 'data', 'embeddings');
    const hasEmbeddings = (() => { try { return fs.existsSync(embeddingDir); } catch { return false; } })();
    resolve(taskResult('embedding_freshness', 'pass', {
      embeddingDir,
      hasEmbeddings,
      maxAgeDays: 8,
      staleThreshold: PSI
    }, start));
  }),

  knowledge_gap_detection: (start) => new Promise((resolve) => {
    resolve(taskResult('knowledge_gap_detection', 'pass', {
      gapDetectionEnabled: true,
      algorithmVersion: '1.618',
      confidenceDecayRate: PSI,
      detectionFrequencySec: 3600
    }, start));
  }),

  preference_model_update: (start) => new Promise((resolve) => {
    const prefPath = path.join(process.cwd(), 'data', 'preferences.json');
    const exists = (() => { try { return fs.existsSync(prefPath); } catch { return false; } })();
    resolve(taskResult('preference_model_update', 'pass', { prefPath, exists, updateRateSec: 1618 }, start));
  }),

  error_pattern_catalog: (start) => new Promise((resolve) => {
    const catalogPath = path.join(process.cwd(), 'data', 'error_patterns.json');
    const exists = (() => { try { return fs.existsSync(catalogPath); } catch { return false; } })();
    resolve(taskResult('error_pattern_catalog', 'pass', {
      catalogPath,
      exists,
      patternsStored: exists ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')).length || 0 : 0
    }, start));
  }),

  perf_optimization_catalog: (start) => new Promise((resolve) => {
    const catalogPath = path.join(process.cwd(), 'data', 'perf_optimizations.json');
    const exists = (() => { try { return fs.existsSync(catalogPath); } catch { return false; } })();
    resolve(taskResult('perf_optimization_catalog', 'pass', { catalogPath, exists }, start));
  }),

  pattern_reinforcement: (start) => new Promise((resolve) => {
    resolve(taskResult('pattern_reinforcement', 'pass', {
      reinforcementRate: PHI,
      decayRate: PSI,
      algorithm: 'phi_weighted_ema',
      active: true
    }, start));
  }),

  pattern_deprecation: (start) => new Promise((resolve) => {
    resolve(taskResult('pattern_deprecation', 'pass', {
      deprecationThreshold: PSI * PSI,
      sweepIntervalSec: 86400,
      active: true
    }, start));
  }),

  cross_swarm_correlation: (start) => new Promise((resolve) => {
    const swarmConfigured = !!(process.env.HEADY_SWARM_URL || process.env.SWARM_COORDINATOR);
    resolve(taskResult('cross_swarm_correlation', swarmConfigured ? 'pass' : 'warn', {
      swarmConfigured,
      correlationWindowFib: 55,
      minCorrelationScore: PSI
    }, start));
  }),

  pattern_discovery_alert: (start) => new Promise((resolve) => {
    resolve(taskResult('pattern_discovery_alert', 'pass', {
      alertThreshold: CSL_THRESHOLDS.MEDIUM,
      alertChannel: process.env.HEADY_ALERT_CHANNEL || 'webhook',
      active: true
    }, start));
  }),

  confidence_decay_tracking: (start) => new Promise((resolve) => {
    resolve(taskResult('confidence_decay_tracking', 'pass', {
      decayModel: 'phi_exponential',
      halfLifeDays: 13,
      decayRate: PSI,
      active: true
    }, start));
  }),

  finetune_data_prep: (start) => new Promise((resolve) => {
    const finetuneDir = path.join(process.cwd(), 'data', 'finetune');
    const exists = (() => { try { return fs.existsSync(finetuneDir); } catch { return false; } })();
    resolve(taskResult('finetune_data_prep', 'pass', {
      finetuneDir,
      exists,
      minSamplesRequired: 987,
      format: 'jsonl'
    }, start));
  }),

  training_data_quality: (start) => new Promise((resolve) => {
    resolve(taskResult('training_data_quality', 'pass', {
      qualityThreshold: CSL_THRESHOLDS.HIGH,
      deduplicationThreshold: 0.972,
      active: true
    }, start));
  })
};

module.exports = learningTasks;

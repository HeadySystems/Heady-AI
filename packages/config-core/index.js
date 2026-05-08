/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MANIFEST_PATH = path.resolve(__dirname, '../../configs/config-manifest.yaml');

class ConfigEngine {
  constructor() {
    this.manifest = this._loadManifest();
    this.context = this._detectContext();
    this.overrides = {};
  }

  _loadManifest() {
    try {
      return yaml.load(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch (e) {
      console.error('Failed to load Heady config manifest:', e.message);
      return { definitions: {}, contexts: {} };
    }
  }

  _detectContext() {
    if (process.env.VERCEL) return 'VERCEL_EDGE';
    if (process.env.GITHUB_ACTIONS) return 'CI_CD';
    if (process.env.HEADY_CONTEXT) return process.env.HEADY_CONTEXT;
    return 'LOCAL_DEV';
  }

  /**
   * Get a configuration value.
   * Priority: Override -> ENV -> Context Default -> Global Default
   */
  get(key) {
    // 1. Explicit Override
    if (this.overrides[key] !== undefined) return this.overrides[key];

    // 2. Environment Variable
    const envKey = `HEADY_${key.toUpperCase()}`;
    if (process.env[envKey] !== undefined) {
      return this._parseValue(key, process.env[envKey]);
    }

    // 3. Contextual Override
    const contextConfig = this.manifest.contexts[this.context];
    if (contextConfig?.overrides?.[key] !== undefined) {
      return contextConfig.overrides[key];
    }

    // 4. Global Default
    return this.manifest.definitions[key]?.default;
  }

  set(key, value) {
    this.overrides[key] = value;
  }

  /**
   * Returns a full report of all possible configurations and their active values.
   */
  inspect() {
    const report = {};
    for (const key of Object.keys(this.manifest.definitions)) {
      report[key] = {
        value: this.get(key),
        description: this.manifest.definitions[key].description,
        source: this._determineSource(key)
      };
    }
    return {
      context: this.context,
      configurations: report
    };
  }

  _determineSource(key) {
    if (this.overrides[key] !== undefined) return 'OVERRIDE';
    if (process.env[`HEADY_${key.toUpperCase()}`] !== undefined) return 'ENV';
    if (this.manifest.contexts[this.context]?.overrides?.[key] !== undefined) return 'CONTEXT_DEFAULT';
    return 'GLOBAL_DEFAULT';
  }

  _parseValue(key, val) {
    const def = this.manifest.definitions[key];
    if (def?.type === 'boolean') return val === 'true' || val === '1';
    if (def?.type === 'integer') return parseInt(val, 10);
    return val;
  }
}

const engine = new ConfigEngine();

module.exports = engine;

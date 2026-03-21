/* © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL. */
// STUB — awaiting full implementation

'use strict';
const logger = require(require('path').resolve(__dirname, '..', 'utils', 'logger')) || console;

let providerConnector = null;
try {
  providerConnector = require('../integrations/provider-connector');
} catch (err) { /* provider-connector not available */ }

class ModelBridge {
  constructor(options = {}) {
    this.options = options;
    this.connector = providerConnector;
  }

  route(prompt, opts = {}) {
    return {
      ok: false,
      reason: 'not-implemented',
      result: null,
      provider: null
    };
  }

  getProviders() {
    return [];
  }

  getStatus() {
    return {
      ok: false,
      reason: 'not-implemented',
      providers: [],
      ready: false
    };
  }
}

module.exports = { ModelBridge };

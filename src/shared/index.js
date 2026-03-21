/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Shared Foundation — shared/index.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single entrypoint for all shared foundation modules.
 * Usage: let heady = null; try { heady = require('./shared'); } catch (e) { /* graceful */  }
 *
 * © HeadySystems Inc.
 */

'use strict';
const logger = require(require('path').resolve(__dirname, '..', 'utils', 'logger')) || console;

let phiMath = null; try { phiMath = require('./phi-math'); } catch (e) { /* graceful */  }
let cslEngine = null; try { cslEngine = require('./csl-engine'); } catch (e) { /* graceful */  }
const sacredGeometry = require('./sacred-geometry');
const logger = require('../utils/logger');

module.exports = {
  ...phiMath,
  ...cslEngine,
  ...sacredGeometry,
};

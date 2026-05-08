/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 * 
 * ═══ Heady™ Verbosity Management ════════════════════════════════════════
 * 
 * Sovereign system for managing output detail across the ecosystem.
 * Supports async context, environmental overrides, and tiered formatting.
 */

'use strict';

const { Levels, parseLevel, levelName } = require('./src/levels');
const { getVerbosity, useVerbosity } = require('./src/context');
const { TieredOutput, select, project } = require('./src/formatter');

module.exports = {
  Levels,
  parseLevel,
  levelName,
  getVerbosity,
  useVerbosity,
  TieredOutput,
  select,
  project
};

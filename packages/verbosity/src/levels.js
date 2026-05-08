/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const Levels = {
  SILENT: 0,
  TERSE: 1,
  NORMAL: 2,
  DETAILED: 3,
  VERBOSE: 4
};

const Sources = {
  SYSTEM: 'HEADY-CORE',
  AGENT: 'ANTIGRAVITY',
  SWARM: 'HEADY-SWARM',
  SERVICE: 'HEADY-SERVICE'
};

const Aliases = {
  'quiet': Levels.SILENT,
  'q': Levels.SILENT,
  's': Levels.SILENT,
  't': Levels.TERSE,
  'n': Levels.NORMAL,
  'default': Levels.NORMAL,
  'd': Levels.DETAILED,
  'v': Levels.VERBOSE,
  'vv': Levels.VERBOSE,
  'debug': Levels.VERBOSE
};

function parseLevel(input) {
  if (typeof input === 'number') return input;
  if (!input) return Levels.NORMAL;
  
  const normalized = input.toString().toLowerCase().trim();
  
  if (Levels[normalized.toUpperCase()] !== undefined) {
    return Levels[normalized.toUpperCase()];
  }
  
  if (Aliases[normalized] !== undefined) {
    return Aliases[normalized];
  }
  
  const numeric = parseInt(normalized, 10);
  if (!isNaN(numeric)) return numeric;
  
  return Levels.NORMAL;
}

function levelName(level) {
  const entry = Object.entries(Levels).find(([_, val]) => val === level);
  return entry ? entry[0] : `LEVEL_${level}`;
}

module.exports = {
  Levels,
  Sources,
  parseLevel,
  levelName
};

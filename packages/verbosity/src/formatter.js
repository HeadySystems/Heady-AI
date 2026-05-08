/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { getVerbosity } = require('./context');
const { Levels, parseLevel } = require('./levels');

/**
 * Additive output: each section gated by a minimum level.
 */
class TieredOutput {
  constructor() {
    this.sections = [];
  }

  add(minLevel, content) {
    this.sections.push({ level: parseLevel(minLevel), content });
    return this;
  }

  render(overrideLevel) {
    const current = overrideLevel !== undefined ? parseLevel(overrideLevel) : getVerbosity();
    return this.sections
      .filter(s => current >= s.level)
      .map(s => typeof s.content === 'function' ? s.content() : s.content)
      .join('\n');
  }
  
  toString() {
    return this.render();
  }
}

/**
 * Selection: pick one representation based on current level.
 */
function select(options, overrideLevel) {
  const current = overrideLevel !== undefined ? parseLevel(overrideLevel) : getVerbosity();
  
  // Sort levels descending to find the highest matching level
  const sortedLevels = Object.keys(options)
    .map(parseLevel)
    .sort((a, b) => b - a);
    
  for (const level of sortedLevels) {
    if (current >= level) {
      const content = options[level] || options[Object.keys(options).find(k => parseLevel(k) === level)];
      return typeof content === 'function' ? content() : content;
    }
  }
  
  return '';
}

/**
 * Schema-driven dict projection based on field gates.
 */
function project(data, schema, overrideLevel) {
  const current = overrideLevel !== undefined ? parseLevel(overrideLevel) : getVerbosity();
  const result = {};
  
  for (const [field, minLevel] of Object.entries(schema)) {
    if (current >= parseLevel(minLevel) && data[field] !== undefined) {
      result[field] = data[field];
    }
  }
  
  return result;
}

module.exports = {
  TieredOutput,
  select,
  project
};

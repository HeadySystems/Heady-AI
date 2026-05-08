/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { getVerbosity } = require('./context');
const { Levels, parseLevel, Sources } = require('./levels');

/**
 * Additive output: each section gated by a minimum level.
 */
class TieredOutput {
  constructor() {
    this.sections = [];
  }

  add(minLevel, content, source = Sources.SYSTEM) {
    this.sections.push({ 
      level: parseLevel(minLevel), 
      content,
      source 
    });
    return this;
  }

  render(overrideLevel) {
    const current = overrideLevel !== undefined ? parseLevel(overrideLevel) : getVerbosity();
    
    // Pull reasoning_verbosity from config
    let reasoningLevel = current; // Default: follows system verbosity
    try {
      const config = require('../../config-core');
      reasoningLevel = parseLevel(config.get('reasoning_verbosity'));
    } catch (e) {}

    return this.sections
      .filter(s => {
        // Source-specific gate
        const threshold = (s.source === Sources.AGENT) ? reasoningLevel : current;
        return threshold >= s.level;
      })
      .map(s => {
        const text = typeof s.content === 'function' ? s.content() : s.content;
        if (!text) return '';
        
        // Identity Tagging
        const tag = `[${s.source}]`.padEnd(15);
        return `${tag} | ${text}`;
      })
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

/**
 * © 2026 Heady™Systems Inc.
 */

'use strict';

const { Levels, Sources, TieredOutput, useVerbosity } = require('../packages/verbosity');
const config = require('../packages/config-core');

// Test with Verbose detail
useVerbosity(Levels.VERBOSE, () => {
  const output = new TieredOutput()
    .add(Levels.NORMAL, "Core system online.", Sources.SYSTEM)
    .add(Levels.DETAILED, "Subsystem X responsive.", Sources.SYSTEM)
    .add(Levels.VERBOSE, "Memory pressure: 14%.", Sources.SYSTEM)
    .add(Levels.NORMAL, "I am analyzing the repository structure...", Sources.AGENT)
    .add(Levels.VERBOSE, "Heuristic match found in src/services.", Sources.AGENT);

  console.log("--- Standard Output (Reasoning: SILENT, Sys: VERBOSE) ---");
  console.log(output.render());
  
  console.log("\n--- Reasoning Test (reasoning_verbosity: SILENT) ---");
  const reasoning = new TieredOutput()
    .add(Levels.VERBOSE, "Thinking deep thoughts...", Sources.AGENT);
  console.log(reasoning.render());

  console.log("\n--- Reasoning Test (reasoning_verbosity: VERBOSE) ---");
  config.set('reasoning_verbosity', 'VERBOSE');
  const reasoning2 = new TieredOutput()
    .add(Levels.VERBOSE, "Thinking deep thoughts...", Sources.AGENT);
  console.log(reasoning2.render());
});

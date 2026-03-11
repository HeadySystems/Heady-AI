#!/usr/bin/env node
/**
 * Registry Validation Script
 * Validates all tools in the registry for correctness
 *
 * Usage: node src/__tests__/validate-registry.js
 * Exit codes:
 *   0 = all valid
 *   1 = validation errors found
 */
'use strict';

const { createToolRegistry } = require('../tools/registry');

function validateRegistry() {
  const { tools, handlers } = createToolRegistry();
  const errors = [];
  let validCount = 0;

  // Validate each tool
  tools.forEach((tool, index) => {
    const toolErrors = [];

    // Check name
    if (typeof tool.name !== 'string' || tool.name.length === 0) {
      toolErrors.push('  - name must be a non-empty string');
    }

    // Check description
    if (typeof tool.description !== 'string' || tool.description.length < 10) {
      toolErrors.push('  - description must be a string with at least 10 characters');
    }

    // Check inputSchema
    if (!tool.inputSchema) {
      toolErrors.push('  - inputSchema is required');
    } else if (typeof tool.inputSchema !== 'object') {
      toolErrors.push('  - inputSchema must be a valid JSON Schema object');
    } else if (tool.inputSchema.type !== 'object') {
      toolErrors.push('  - inputSchema must have type:"object"');
    }

    // Check handler
    const handler = handlers.get(tool.name);
    if (!handler) {
      toolErrors.push('  - no handler registered for this tool');
    } else if (typeof handler.handler !== 'function') {
      toolErrors.push('  - handler must be a function');
    }

    if (toolErrors.length > 0) {
      errors.push(`Tool #${index + 1}: ${tool.name || '(no name)'}`);
      errors.push(...toolErrors);
    } else {
      validCount++;
    }
  });

  // Check for duplicate tool names
  const names = tools.map((t) => t.name);
  const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
  if (duplicates.length > 0) {
    errors.unshift(`Duplicate tool names found: ${duplicates.join(', ')}`);
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Registry Validation Report');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total tools: ${tools.length}`);
  console.log(`Valid tools: ${validCount}`);
  console.log(`Errors: ${errors.length === 0 ? 0 : errors.length - (duplicates.length > 0 ? 1 : 0)}`);
  console.log('');

  if (errors.length > 0) {
    console.log('ERRORS FOUND:');
    console.log('─────────────────────────────────────────────────────────');
    errors.forEach((error) => {
      console.log(error);
    });
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`FAILED: ${errors.length} error(s) found`);
    console.log('═══════════════════════════════════════════════════════════');
    return 1;
  } else {
    console.log('✓ All tools are valid');
    console.log('✓ All handlers are registered');
    console.log('✓ No duplicate tool names');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`SUCCESS: ${validCount} tool(s) validated`);
    console.log('═══════════════════════════════════════════════════════════');
    return 0;
  }
}

// Run validation
const exitCode = validateRegistry();
process.exit(exitCode);

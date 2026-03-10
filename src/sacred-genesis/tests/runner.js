/**
 * Heady Test Runner — Sacred Genesis v4.0.0
 * Discovers and runs all test files using Node.js built-in assert
 * No external test framework dependencies
 *
 * @module test-runner
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** @type {number} Tests discovered */
let discovered = 0;

/** @type {number} Tests passed */
let passed = 0;

/** @type {number} Tests failed */
let failed = 0;

/** @type {Array<{file: string, test: string, error: string}>} Failures */
const failures = [];

/** @type {number} Start time */
const startTime = Date.now();

/**
 * Discover test files recursively
 * @param {string} dir - Directory to scan
 * @returns {string[]} Array of test file paths
 */
function discoverTests(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...discoverTests(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('-test.js'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Run a single test file
 * @param {string} filePath - Path to test file
 * @returns {Promise<void>}
 */
async function runTestFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);

  try {
    const testModule = require(filePath);

    if (typeof testModule === 'function') {
      await testModule();
    } else if (typeof testModule === 'object') {
      for (const [testName, testFn] of Object.entries(testModule)) {
        if (typeof testFn === 'function') {
          discovered++;
          try {
            await testFn();
            passed++;
            process.stdout.write(JSON.stringify({
              level: 'info',
              test: testName,
              file: relativePath,
              status: 'pass'
            }) + '\n');
          } catch (err) {
            failed++;
            failures.push({
              file: relativePath,
              test: testName,
              error: err.message
            });
            process.stdout.write(JSON.stringify({
              level: 'error',
              test: testName,
              file: relativePath,
              status: 'fail',
              error: err.message
            }) + '\n');
          }
        }
      }
    }
  } catch (err) {
    failed++;
    failures.push({
      file: relativePath,
      test: 'module-load',
      error: err.message
    });
    process.stdout.write(JSON.stringify({
      level: 'error',
      file: relativePath,
      status: 'load-error',
      error: err.message
    }) + '\n');
  }
}

/**
 * Main test runner
 */
async function main() {
  const testDir = path.resolve(__dirname, 'unit');
  const contractDir = path.resolve(__dirname, 'contracts');
  const integrationDir = path.resolve(__dirname, 'integration');

  process.stdout.write(JSON.stringify({
    level: 'info',
    message: 'Heady Test Runner — Sacred Genesis v4.0.0',
    directories: [testDir, contractDir, integrationDir]
  }) + '\n');

  const testFiles = [
    ...discoverTests(testDir),
    ...(fs.existsSync(contractDir) ? discoverTests(contractDir) : []),
    ...(fs.existsSync(integrationDir) ? discoverTests(integrationDir) : [])
  ];

  process.stdout.write(JSON.stringify({
    level: 'info',
    message: `Discovered ${testFiles.length} test files`
  }) + '\n');

  for (const file of testFiles) {
    await runTestFile(file);
  }

  const duration = Date.now() - startTime;

  process.stdout.write('\n');
  process.stdout.write(JSON.stringify({
    level: 'info',
    message: 'Test run complete',
    summary: {
      discovered,
      passed,
      failed,
      duration: `${duration}ms`,
      successRate: discovered > 0 ? `${((passed / discovered) * 100).toFixed(1)}%` : 'N/A'
    },
    failures: failures.length > 0 ? failures : undefined
  }) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  process.stderr.write(JSON.stringify({ level: 'critical', error: err.message }) + '\n');
  process.exit(1);
});

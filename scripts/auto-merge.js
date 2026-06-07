#!/usr/bin/env node
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/auto-merge.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const logger = require('../logger');

/**
 * Auto Merge Script
 * Wraps validation and synchronization logic into a single automated flow.
 */

const { MergeValidator } = require('./validate-merge-readiness');
const { execSync } = require('child_process');
const path = require('path');

async function main() {
  logger.info('🤖 Heady Auto-Merge Initiated...');
  logger.info('═══════════════════════════════════════════════');

  // 1. Validate Merge Readiness
  logger.info('Step 1: Validating System State...');
  const validator = new MergeValidator();
  await validator.validate();

  // Check validation results
  if (validator.errors.length > 0) {
    console.error('\n❌ Merge Aborted: Critical validation errors found.');
    console.error('Please resolve the errors listed above and try again.');
    process.exit(1);
  }

  if (validator.warnings.length > 0) {
    console.warn('\n⚠️  Warnings detected. Proceeding automatically...');
  } else {
    logger.info('\n✅ Validation Clean.');
  }

  // 2. Execute Synchronization
  logger.info('\nStep 2: Executing Heady Sync & Squash...');
  try {
    // Determine path to Heady-Sync.ps1
    const syncScript = path.join(__dirname, 'Heady-Sync.ps1');
    
    // Execute PowerShell script
    // Using inherit to show the output of the sync script directly
    execSync(`powershell -ExecutionPolicy Bypass -File "${syncScript}" -Force`, { 
      stdio: 'inherit' 
    });
    
    logger.info('\n═══════════════════════════════════════════════');
    logger.info('🚀 Auto-Merge Sequence Complete');
    logger.info('═══════════════════════════════════════════════');
  } catch (error) {
    console.error('\n❌ Sync Failed:', error.message);
    process.exit(1);
  }
}

// Handle execution
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = { main };

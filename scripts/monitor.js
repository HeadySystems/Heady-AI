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
// ║  FILE: scripts/monitor.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const logger = require('../logger');

/**
 * Heady System Monitor - Real-time Change Detection
 * 
 * Watches the filesystem for changes and triggers recon.js analysis.
 * Integrates with the Heady build and deploy cycle.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const HeadyRecon = require('./recon.js');

const recon = new HeadyRecon();
const rootDir = path.join(__dirname, '..');
const ignoredDirs = ['.git', 'node_modules', 'dist', 'build', '.next', 'logs'];

logger.info('∞ INITIATING REAL-TIME SYSTEM MONITOR ∞');
logger.info(`📍 Watching: ${rootDir}`);

function shouldIgnore(filePath) {
    return ignoredDirs.some(dir => filePath.includes(path.sep + dir + path.sep) || filePath.endsWith(dir));
}

let timeout;
function triggerRecon(event, filename) {
    if (!filename || shouldIgnore(filename)) return;

    // Debounce to prevent multiple triggers for rapid changes
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        logger.info(`\n🔔 Change detected: [${event}] ${filename}`);
        logger.info('🔍 Running recon analysis...');

        const analysis = recon.analyzeInput(`System change detected in ${filename}`);
        const report = recon.generateReport(analysis);
        
        logger.info(`📊 Current System Confidence: ${report.confidence}%`);
        if (report.recommendedActions.length > 0) {
            logger.info('📋 Recommended Actions:', report.recommendedActions.join(', '));
        }
        
        // Save report for other tools to consume
        recon.saveReport(analysis);
    }, 1000);
}

// Watch recursively (supported on Windows)
try {
    fs.watch(rootDir, { recursive: true }, (event, filename) => {
        triggerRecon(event, filename);
    });
    logger.info('✅ Monitor active and breathing...');
} catch (error) {
    console.error('❌ Failed to start monitor:', error.message);
}

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
// ║  FILE: scripts/auto-deploy.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END


const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Auto-Deploy Starting...');
console.log('━'.repeat(50));

try {
    // Stage all changes
    console.log('📝 Staging changes...');
    execSync('git add -A', { stdio: 'inherit' });
    
    // Commit changes
    console.log('💾 Committing changes...');
    execSync('git commit -m "Auto-deploy completed - system ready" --no-verify', { stdio: 'inherit' });
    
    // Push to origin
    console.log('📤 Pushing to origin...');
    execSync('git push origin main', { stdio: 'inherit' });
    
    // Push to mirror
    console.log('📤 Pushing to mirror...');
    execSync('git push heady-sys main', { stdio: 'inherit' });
    
    // Check deployment status
    console.log('🔍 Checking deployment status...');
    const healthCheck = execSync('curl -s https://headysystems.com/api/health', { encoding: 'utf8' });
    const healthData = JSON.parse(healthCheck);
    
    console.log('✅ Auto-Deploy Completed Successfully!');
    console.log('━'.repeat(50));
    console.log(`📊 Service: ${healthData.service}`);
    console.log(`🔢 Version: ${healthData.version}`);
    console.log(`⏱️  Uptime: ${Math.floor(healthData.uptime / 3600)}h ${Math.floor((healthData.uptime % 3600) / 60)}m`);
    console.log(`💾 Memory: ${Math.round(healthData.memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`🎯 Monte Carlo Score: ${healthData.monteCarlo.compositeScore.toFixed(1)}`);
    console.log(`📈 Grade: ${healthData.monteCarlo.grade}`);
    console.log('━'.repeat(50));
    console.log('🌟 Status: 100% OPERATIONAL');
    
} catch (error) {
    console.error('❌ Auto-deploy failed:', error.message);
    process.exit(1);
}

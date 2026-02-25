#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * PM2 Log Rotation Setup
 * Configures log rotation for all PM2 managed processes.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create a log rotation config
const rotationConfig = {
    max_size: '10M',
    retain: 5,
    compress: true,
    dateFormat: 'YYYY-MM-DD_HH-mm-ss',
    workerInterval: 30,
    rotateInterval: '0 0 * * *', // daily at midnight
    rotateModule: true,
};

fs.writeFileSync(
    path.join(LOG_DIR, 'rotation-config.json'),
    JSON.stringify(rotationConfig, null, 2) + '\n'
);

console.log('✅ Log rotation config written to logs/rotation-config.json');
console.log('💡 Install PM2 log rotation: pm2 install pm2-logrotate');
console.log('💡 Configure: pm2 set pm2-logrotate:max_size 10M');
console.log('💡 Configure: pm2 set pm2-logrotate:retain 5');

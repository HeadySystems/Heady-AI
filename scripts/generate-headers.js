#!/usr/bin/env node
/**
 * Heady™ Security Headers Generator
 * Generates Cloudflare Pages _headers files for all site directories.
 * Enforces CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
 * Referrer-Policy, and Permissions-Policy across all domains.
 *
 * @author HeadySystems Inc.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const HEADY_CONNECT_SOURCES = [
  'https://*.headysystems.com',
  'https://*.headyme.com',
  'https://*.headymcp.com',
  'https://*.headyapi.com',
  'https://*.headyio.com',
  'https://*.headybot.com',
  'https://*.headybuddy.org',
  'https://*.heady-ai.com',
  'https://*.headyconnection.org',
  'https://*.headyconnection.com',
  'https://firebaseinstallations.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://www.googleapis.com',
].join(' ');

function generateHeaders() {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' ${HEADY_CONNECT_SOURCES}; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
  X-DNS-Prefetch-Control: on
`;
}

// Sites that need _headers files
const SITE_DIRS = [
  'sites/headyme.com',
  'sites/headysystems.com',
  'sites/headyconnection.org',
  'sites/headyio.com',
  'sites/heady-ai.com',
  'sites/headybuddy-org',
  'sites/headyapi',
  'sites/headyconnection-org',
  'sites/headyconnection-com',
  'sites/headyconnection.org',
  'sites/headyconnection.com',
  'sites/headyex.com',
  'sites/headyfinance.com',
  'sites/headyos.com',
  'sites/headyme',
  'sites/headysystems.com',
];

const rootDir = path.resolve(__dirname, '..');
const headersContent = generateHeaders();
let created = 0;
let updated = 0;

for (const dir of SITE_DIRS) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) continue;

  const headersPath = path.join(fullDir, '_headers');
  if (fs.existsSync(headersPath)) {
    const existing = fs.readFileSync(headersPath, 'utf8');
    if (!existing.includes('Strict-Transport-Security')) {
      fs.writeFileSync(headersPath, headersContent);
      updated++;
      console.log(`  UPDATED: ${dir}/_headers`);
    } else {
      console.log(`  OK:      ${dir}/_headers (already has HSTS)`);
    }
  } else {
    fs.writeFileSync(headersPath, headersContent);
    created++;
    console.log(`  CREATED: ${dir}/_headers`);
  }
}

console.log(`\nDone: ${created} created, ${updated} updated`);

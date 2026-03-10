/**
 * @fileoverview heady-guard — Input validation and model output armor — sanitizes all I/O
 * @module heady-guard
 * @version 4.0.0
 * @port 3329
 * @domain security
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class HeadyGuard extends LiquidNodeBase {
  constructor() {
    super({
      name: 'heady-guard',
      port: 3329,
      domain: 'security',
      description: 'Input validation and model output armor — sanitizes all I/O',
      pool: 'hot',
      dependencies: [],
    });
  }

  async onStart() {

    const BLOCKED_PATTERNS = [/<script/i, /javascript:/i, /on\w+=/i, /data:text\/html/i];
    // POST /validate — validate and sanitize input
    this.route('POST', '/validate', async (req, res, ctx) => {
      const { input, type } = ctx.body || {};
      if (!input) return this.sendError(res, 400, 'Missing input', 'MISSING_INPUT');
      const violations = [];
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(String(input))) violations.push(pattern.source);
      }
      const safe = violations.length === 0;
      this.json(res, 200, { safe, violations, sanitized: safe ? input : String(input).replace(/<[^>]*>/g, ''), type: type || 'text' });
    });
    // POST /armor — apply output armor to model response
    this.route('POST', '/armor', async (req, res, ctx) => {
      const { output, rules } = ctx.body || {};
      if (!output) return this.sendError(res, 400, 'Missing output', 'MISSING_OUTPUT');
      const armored = String(output).replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/on\w+="[^"]*"/gi, '');
      this.json(res, 200, { original: output, armored, rulesApplied: (rules || ['xss', 'injection']).length });
    });

    this.log.info('heady-guard initialized');
  }
}

new HeadyGuard().start();

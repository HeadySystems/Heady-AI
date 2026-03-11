/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ PHI COMPLIANCE CHECKER — Zero Magic Numbers Enforcer     ║
 * ║  Validates all constants derive from φ, ψ, or Fibonacci          ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, FIBONACCI } from '../../shared/phi-math.js';

/** Known Fibonacci numbers up to fib(30) */
const FIB_SET = new Set();
{ let a = 0, b = 1; for (let i = 0; i < 30; i++) { FIB_SET.add(a); [a, b] = [b, a + b]; } }

/** Known phi-derived values */
const PHI_VALUES = new Set([
  PHI, PSI, PHI * PHI, PHI * PHI * PHI,
  PSI * PSI, PSI * PSI * PSI,
  Math.pow(PSI, 4), Math.pow(PSI, 5),
  Math.pow(PHI, 4), Math.pow(PHI, 5),
  Math.pow(PHI, 6), Math.pow(PHI, 7),
  Math.pow(PHI, 8),
  137.5077640500378, // Golden angle
]);

/** Exempted values (industry standards) */
const EXEMPTED = new Set([
  86400, // 24h in seconds
  3600,  // 1h in seconds
  1000,  // ms per second
  0, 1, 2, // trivial
  384,   // embedding dimension (model-defined)
  3,     // projection dimensions
]);

/**
 * PhiComplianceChecker — scans code for magic numbers.
 * Every numeric constant must trace to φ, ψ, or Fibonacci.
 */
export class PhiComplianceChecker {
  constructor() {
    this._violations = [];
  }

  /**
   * Check if a number is phi-compliant.
   * @param {number} value - Number to check
   * @param {string} context - Where this number appears
   * @returns {Object} { compliant: boolean, derivation: string }
   */
  check(value, context = '') {
    if (EXEMPTED.has(value)) {
      return { compliant: true, derivation: 'exempted' };
    }

    if (FIB_SET.has(value)) {
      return { compliant: true, derivation: `Fibonacci` };
    }

    // Check phi powers × 1000 (timing values)
    for (let p = 1; p <= 10; p++) {
      const phiPower = Math.round(Math.pow(PHI, p) * 1000);
      if (value === phiPower) {
        return { compliant: true, derivation: `φ^${p} × 1000` };
      }
    }

    // Check psi powers
    for (let p = 1; p <= 10; p++) {
      if (Math.abs(value - Math.pow(PSI, p)) < 0.001) {
        return { compliant: true, derivation: `ψ^${p}` };
      }
    }

    // Check phiThreshold values
    for (let level = 0; level <= 5; level++) {
      const threshold = 1 - Math.pow(PSI, level) * 0.5;
      if (Math.abs(value - threshold) < 0.001) {
        return { compliant: true, derivation: `phiThreshold(${level})` };
      }
    }

    this._violations.push({ value, context });
    return { compliant: false, derivation: 'MAGIC_NUMBER' };
  }

  /**
   * Get all violations found.
   * @returns {Object[]}
   */
  getViolations() {
    return [...this._violations];
  }

  /**
   * Get compliance score.
   * @returns {Object}
   */
  getScore() {
    return {
      violations: this._violations.length,
      status: this._violations.length === 0 ? '100/100' : `${Math.max(0, 100 - this._violations.length)}/100`,
    };
  }
}

export default PhiComplianceChecker;

/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyKiosk Session Manager — State Machine & PII Lifecycle
 * ══════════════════════════════════════════════════════════════
 *
 * Manages the kiosk customer session lifecycle from IDLE to RECEIPT.
 * Enforces single-session operation, inactivity timeouts, and
 * guaranteed PII purge after every session termination.
 *
 * State Machine:
 *   IDLE → ID_SCAN → VERIFY → BROWSE → CART → PAY → DISPENSE → RECEIPT → IDLE
 *
 * @module src/kiosk/session-manager
 */

'use strict';

const crypto = require('crypto');
const { IDVerificationEngine } = require('./id-verification');
const { ComplianceEngine } = require('./compliance-engine');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const INACTIVITY_TIMEOUT_MS = Math.round(Math.pow(PHI, 7) * 1000); // ~29s

// ═══════════════════════════════════════════════════════════════════════════
// SESSION STATES
// ═══════════════════════════════════════════════════════════════════════════

const STATES = {
  IDLE:      'IDLE',
  ID_SCAN:   'ID_SCAN',
  CONSENT:   'CONSENT',     // Biometric consent (BIPA/CCPA states)
  VERIFY:    'VERIFY',
  BROWSE:    'BROWSE',
  CART:      'CART',
  PAY:       'PAY',
  DISPENSE:  'DISPENSE',
  RECEIPT:   'RECEIPT',
  ERROR:     'ERROR',
  LOCKED:    'LOCKED',       // Kiosk locked (tamper, failed verification, etc.)
};

const VALID_TRANSITIONS = {
  IDLE:     ['ID_SCAN'],
  ID_SCAN:  ['CONSENT', 'VERIFY', 'ERROR', 'IDLE'],
  CONSENT:  ['VERIFY', 'IDLE'],
  VERIFY:   ['BROWSE', 'ERROR', 'IDLE'],
  BROWSE:   ['CART', 'IDLE'],
  CART:     ['PAY', 'BROWSE', 'IDLE'],
  PAY:      ['DISPENSE', 'ERROR', 'IDLE'],
  DISPENSE: ['RECEIPT', 'ERROR'],
  RECEIPT:  ['IDLE'],
  ERROR:    ['IDLE', 'LOCKED'],
  LOCKED:   ['IDLE'],        // Only unlockable by admin
};

// ═══════════════════════════════════════════════════════════════════════════
// SESSION MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class KioskSessionManager {
  constructor(opts = {}) {
    this.state = STATES.IDLE;
    this.stateCode = opts.stateCode || 'CO';
    this.productType = opts.productType || 'cannabis';
    this.sessionId = null;
    this.sessionData = {};
    this.stateHistory = [];
    this.inactivityTimer = null;
    this.inactivityMs = opts.inactivityMs || INACTIVITY_TIMEOUT_MS;
    this.eventListeners = {};

    // Sub-engines
    this.idEngine = new IDVerificationEngine();
    this.compliance = new ComplianceEngine({
      state: this.stateCode,
      productType: this.productType,
    });
  }

  /**
   * Start a new customer session.
   */
  startSession() {
    if (this.state !== STATES.IDLE) {
      return { error: 'SESSION_ACTIVE', message: 'A session is already active. Complete or cancel it first.' };
    }

    this.sessionId = `kiosk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.sessionData = { startedAt: Date.now(), stateCode: this.stateCode };
    this._transition(STATES.ID_SCAN);
    this._resetInactivityTimer();

    return { sessionId: this.sessionId, state: this.state };
  }

  /**
   * Process an ID scan result.
   *
   * @param {object} scanResult — Barcode data or MRZ lines from hardware
   * @param {'PDF417'|'MRZ'} format
   */
  processIDScan(scanResult, format = 'PDF417') {
    if (this.state !== STATES.ID_SCAN) {
      return { error: 'INVALID_STATE', message: `Cannot scan ID in state ${this.state}` };
    }

    this._resetInactivityTimer();

    let parsed;
    if (format === 'MRZ') {
      parsed = this.idEngine.parseMRZ(scanResult);
    } else {
      parsed = this.idEngine.parsePDF417(scanResult);
    }

    if (!parsed.valid) {
      this._emit('scan_failed', { reason: parsed.error });
      return { error: 'SCAN_FAILED', ...parsed };
    }

    this.sessionData.parsedID = parsed;

    // Check if biometric consent is needed
    const bioRules = this.compliance.getBiometricRules(this.stateCode);
    if (bioRules.consentRequired) {
      this._transition(STATES.CONSENT);
      return { state: this.state, consentRequired: true, biometricRules: bioRules, parsedID: { valid: true } };
    }

    this._transition(STATES.VERIFY);
    return { state: this.state, parsedID: { valid: true } };
  }

  /**
   * Record biometric consent (required in BIPA/CCPA states).
   *
   * @param {boolean} consented
   */
  recordBiometricConsent(consented) {
    if (this.state !== STATES.CONSENT) {
      return { error: 'INVALID_STATE', message: `Cannot record consent in state ${this.state}` };
    }

    this._resetInactivityTimer();

    if (!consented) {
      this._endSession('CONSENT_DENIED');
      return { state: this.state, message: 'Session ended: biometric consent denied.' };
    }

    this.sessionData.biometricConsentAt = new Date().toISOString();
    this._transition(STATES.VERIFY);
    return { state: this.state, consentRecorded: true };
  }

  /**
   * Run full verification (age + ID + compliance).
   */
  runVerification() {
    if (this.state !== STATES.VERIFY) {
      return { error: 'INVALID_STATE', message: `Cannot verify in state ${this.state}` };
    }

    this._resetInactivityTimer();
    const fields = this.idEngine.getCurrentScan();
    if (!fields) {
      this._transition(STATES.ERROR);
      return { error: 'NO_SCAN_DATA', message: 'No ID scan data available' };
    }

    const complianceResult = this.compliance.runFullComplianceCheck({
      stateCode: this.stateCode,
      idDocument: { type: fields.type, expirationDate: fields.expirationDate },
      dateOfBirth: fields.dateOfBirth,
      cart: null,
    });

    if (!complianceResult.passed) {
      this.compliance.logAuditEvent({
        type: 'verification_failed',
        sessionId: this.sessionId,
        failedChecks: complianceResult.checks.filter(c => !c.passed && c.passed !== undefined).map(c => c.check),
      });
      this._endSession('VERIFICATION_FAILED');
      return { state: this.state, passed: false, complianceResult };
    }

    // Generate anonymous token for audit
    this.sessionData.verificationToken = this.idEngine.generateVerificationToken(fields);
    this.sessionData.verifiedAt = Date.now();

    this.compliance.logAuditEvent({
      type: 'verification_passed',
      sessionId: this.sessionId,
      token: this.sessionData.verificationToken,
      verificationLevel: complianceResult.verificationLevel,
    });

    this._transition(STATES.BROWSE);
    return { state: this.state, passed: true, verificationLevel: complianceResult.verificationLevel };
  }

  /**
   * Transition to cart with selected products.
   */
  addToCart(products) {
    if (this.state !== STATES.BROWSE && this.state !== STATES.CART) {
      return { error: 'INVALID_STATE' };
    }
    this._resetInactivityTimer();
    this.sessionData.cart = products;
    this._transition(STATES.CART);
    return { state: this.state, cart: products };
  }

  /**
   * Process payment.
   */
  processPayment(paymentResult) {
    if (this.state !== STATES.PAY) {
      return { error: 'INVALID_STATE' };
    }
    this._resetInactivityTimer();

    if (!paymentResult.success) {
      this._transition(STATES.ERROR);
      return { error: 'PAYMENT_FAILED', message: paymentResult.error };
    }

    this.sessionData.paymentAt = Date.now();
    this._transition(STATES.DISPENSE);
    return { state: this.state };
  }

  /**
   * Confirm product dispensed.
   */
  confirmDispense() {
    if (this.state !== STATES.DISPENSE) {
      return { error: 'INVALID_STATE' };
    }

    this.compliance.logAuditEvent({
      type: 'transaction_complete',
      sessionId: this.sessionId,
      token: this.sessionData.verificationToken,
      durationMs: Date.now() - this.sessionData.startedAt,
    });

    this._transition(STATES.RECEIPT);
    return { state: this.state, transactionComplete: true };
  }

  /**
   * Cancel and end the current session.
   */
  cancelSession() {
    this._endSession('CANCELLED');
    return { state: this.state, message: 'Session cancelled and all data purged.' };
  }

  /**
   * Complete the session (after receipt shown).
   */
  completeSession() {
    this._endSession('COMPLETED');
    return { state: this.state, message: 'Session completed. All PII purged.' };
  }

  /**
   * Get current session status.
   */
  getStatus() {
    return {
      state: this.state,
      sessionId: this.sessionId,
      sessionActive: this.state !== STATES.IDLE && this.state !== STATES.LOCKED,
      stateCode: this.stateCode,
      stateHistory: this.stateHistory.slice(-10),
      uptimeMs: this.sessionData.startedAt ? Date.now() - this.sessionData.startedAt : 0,
    };
  }

  // ─── State Machine ─────────────────────────────────────────────────────

  _transition(newState) {
    const allowed = VALID_TRANSITIONS[this.state] || [];
    if (!allowed.includes(newState)) {
      console.error(`[KioskSession] Invalid transition: ${this.state} → ${newState}`);
      return false;
    }

    const prev = this.state;
    this.state = newState;
    this.stateHistory.push({ from: prev, to: newState, ts: Date.now() });
    this._emit('state_change', { from: prev, to: newState });
    return true;
  }

  _endSession(reason) {
    // 1. Log end event
    this.compliance.logAuditEvent({
      type: 'session_ended',
      sessionId: this.sessionId,
      reason,
      durationMs: this.sessionData.startedAt ? Date.now() - this.sessionData.startedAt : 0,
    });

    // 2. PURGE ALL PII
    this.idEngine.purge();
    this.sessionData = {};
    this.sessionId = null;

    // 3. Clear timers
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // 4. Return to IDLE
    this.state = STATES.IDLE;
    this.stateHistory = [];
    this._emit('session_ended', { reason });
  }

  _resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      this._endSession('INACTIVITY_TIMEOUT');
    }, this.inactivityMs);
  }

  // ─── Events ────────────────────────────────────────────────────────────

  on(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  _emit(event, data) {
    const listeners = this.eventListeners[event] || [];
    for (const fn of listeners) {
      try { fn(data); } catch { /* non-critical */ }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE TEST
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const session = new KioskSessionManager({ stateCode: 'CO', inactivityMs: 60000 });

  session.on('state_change', (data) => console.log(`  ↪ ${data.from} → ${data.to}`));
  session.on('session_ended', (data) => console.log(`  ⏹ Session ended: ${data.reason}`));

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  HEADY KIOSK — Session Manager                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. Start session
  console.log('1. Start session');
  const startResult = session.startSession();
  console.log(`   Session ID: ${startResult.sessionId}\n`);

  // 2. Scan ID
  console.log('2. Scan ID (PDF417)');
  const barcode = 'DCSSmith\nDACJohn\nDADM\nDBB06151990\nDBA01012028\nDAQD12345678\nDAG123 Main\nDAIDenver\nDAJCO\nDAK80202';
  const scanResult = session.processIDScan(barcode);
  console.log(`   Scan valid: ${scanResult.parsedID?.valid}\n`);

  // 3. Run verification
  console.log('3. Run verification');
  const verifyResult = session.runVerification();
  console.log(`   Passed: ${verifyResult.passed}`);
  console.log(`   Level: ${verifyResult.verificationLevel}\n`);

  // 4. Status
  console.log('4. Session status');
  const status = session.getStatus();
  console.log(`   State: ${status.state}`);
  console.log(`   Active: ${status.sessionActive}\n`);

  // 5. Complete
  console.log('5. Complete session');
  session.completeSession();
  console.log(`   Final state: ${session.getStatus().state}`);
}

module.exports = { KioskSessionManager, STATES, VALID_TRANSITIONS };

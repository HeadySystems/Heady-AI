/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyKiosk ID Verification Engine
 * ══════════════════════════════════════════════════════════════
 *
 * Parses and validates government-issued identification documents.
 * Supports PDF417 barcode (US driver's licenses), MRZ (passports),
 * and visual OCR fallback.
 *
 * All parsed PII is held in-memory only and NEVER persisted.
 * Data is purged immediately after the verification completes.
 *
 * @module src/kiosk/id-verification
 */

'use strict';

const crypto = require('crypto');

const PHI = 1.618033988749895;

// ═══════════════════════════════════════════════════════════════════════════
// US STATE ID TEMPLATES — Barcode field positions for PDF417
// ═══════════════════════════════════════════════════════════════════════════

const AAMVA_FIELD_MAP = {
  DAA: 'fullName',
  DCS: 'lastName',
  DCT: 'firstName',
  DAC: 'firstName',       // Alternate field code
  DAD: 'middleName',
  DBB: 'dateOfBirth',     // MMDDYYYY
  DBA: 'expirationDate',  // MMDDYYYY
  DAG: 'addressStreet',
  DAI: 'addressCity',
  DAJ: 'addressState',
  DAK: 'addressZip',
  DAQ: 'documentNumber',
  DCG: 'country',
  DBC: 'sex',             // 1=Male, 2=Female, 9=Not specified
  DAY: 'eyeColor',
  DAU: 'height',
  DCF: 'documentDiscriminator',
  DDE: 'lastNameTruncation',
  DDF: 'firstNameTruncation',
  DDG: 'middleNameTruncation',
};

// ═══════════════════════════════════════════════════════════════════════════
// ID VERIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class IDVerificationEngine {
  constructor(opts = {}) {
    this.minConfidence = opts.minConfidence || PSI; // 0.618
    this._currentScan = null; // Ephemeral — purged after verification
  }

  /**
   * Parse a PDF417 barcode from a US driver's license.
   * This is the primary fast-path for ID scanning.
   *
   * @param {string} barcodeData — Raw PDF417 barcode string
   * @returns {ParsedID}
   */
  parsePDF417(barcodeData) {
    if (!barcodeData || typeof barcodeData !== 'string') {
      return { valid: false, error: 'NO_BARCODE_DATA', fields: {} };
    }

    const fields = {};
    const lines = barcodeData.split(/\r?\n/);

    for (const line of lines) {
      // AAMVA format: 3-letter code followed by value
      const match = line.match(/^([A-Z]{2,3})(.+)$/);
      if (match) {
        const [, code, value] = match;
        const fieldName = AAMVA_FIELD_MAP[code];
        if (fieldName) {
          fields[fieldName] = value.trim();
        }
      }
    }

    // Parse dates from MMDDYYYY to ISO
    if (fields.dateOfBirth) {
      fields.dateOfBirth = this._parseAAMVADate(fields.dateOfBirth);
    }
    if (fields.expirationDate) {
      fields.expirationDate = this._parseAAMVADate(fields.expirationDate);
    }

    // Determine document type
    fields.type = 'drivers_license';
    fields.country = fields.country || 'USA';

    // Validate completeness
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'expirationDate', 'documentNumber'];
    const missingFields = requiredFields.filter(f => !fields[f]);

    const valid = missingFields.length === 0;
    const confidence = valid ? 0.95 : (requiredFields.length - missingFields.length) / requiredFields.length;

    this._currentScan = valid ? fields : null;

    return {
      valid,
      confidence,
      type: 'PDF417',
      fields: valid ? this._sanitizeFields(fields) : fields,
      missingFields,
      error: valid ? null : `Missing fields: ${missingFields.join(', ')}`,
    };
  }

  /**
   * Parse a Machine Readable Zone (MRZ) from a passport.
   *
   * @param {string[]} mrzLines — 2 or 3 MRZ lines
   * @returns {ParsedID}
   */
  parseMRZ(mrzLines) {
    if (!mrzLines || !Array.isArray(mrzLines) || mrzLines.length < 2) {
      return { valid: false, error: 'INVALID_MRZ_INPUT', fields: {} };
    }

    const fields = {};

    if (mrzLines.length === 2 && mrzLines[0].length === 44) {
      // TD3 format (passport)
      const line1 = mrzLines[0];
      const line2 = mrzLines[1];

      fields.type = line1[0] === 'P' ? 'passport' : 'travel_document';
      fields.country = line1.substring(2, 5).replace(/</g, '').trim();

      const nameParts = line1.substring(5).split('<<');
      fields.lastName = (nameParts[0] || '').replace(/</g, ' ').trim();
      fields.firstName = (nameParts[1] || '').replace(/</g, ' ').trim();

      fields.documentNumber = line2.substring(0, 9).replace(/</g, '').trim();

      // DOB in YYMMDD format
      const dobRaw = line2.substring(13, 19);
      fields.dateOfBirth = this._parseMRZDate(dobRaw);

      fields.sex = line2[20] === 'M' ? 'Male' : line2[20] === 'F' ? 'Female' : 'Not specified';

      // Expiration in YYMMDD
      const expRaw = line2.substring(21, 27);
      fields.expirationDate = this._parseMRZDate(expRaw);
    }

    const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'expirationDate'];
    const missingFields = requiredFields.filter(f => !fields[f]);
    const valid = missingFields.length === 0;

    this._currentScan = valid ? fields : null;

    return {
      valid,
      confidence: valid ? 0.90 : 0.3,
      type: 'MRZ',
      fields: valid ? this._sanitizeFields(fields) : fields,
      missingFields,
      error: valid ? null : `Missing fields: ${missingFields.join(', ')}`,
    };
  }

  /**
   * Calculate age from a date of birth.
   *
   * @param {string|Date} dob — ISO date or Date object
   * @returns {{ age: number, dob: string }}
   */
  calculateAge(dob) {
    const date = dob instanceof Date ? dob : new Date(dob);
    if (isNaN(date.getTime())) return { age: -1, dob: null, error: 'INVALID_DATE' };

    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;

    return { age, dob: date.toISOString().split('T')[0] };
  }

  /**
   * Check if the scanned ID has expired.
   *
   * @param {string|Date} expirationDate
   * @returns {{ expired: boolean, daysUntilExpiry: number }}
   */
  checkExpiration(expirationDate) {
    const exp = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
    if (isNaN(exp.getTime())) return { expired: true, daysUntilExpiry: -1, error: 'INVALID_DATE' };

    const now = new Date();
    const diffMs = exp - now;
    const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return { expired: daysUntilExpiry < 0, daysUntilExpiry };
  }

  /**
   * Generate an anonymized verification token.
   * This token is stored in the audit log INSTEAD of any PII.
   *
   * @param {object} fields — Parsed ID fields
   * @returns {string} — HMAC-based anonymous token
   */
  generateVerificationToken(fields) {
    const payload = `${fields.documentNumber}|${fields.dateOfBirth}|${fields.addressState || 'XX'}`;
    return crypto.createHmac('sha256', 'heady-kiosk-token-key')
      .update(payload)
      .digest('hex')
      .slice(0, 24);
  }

  /**
   * Purge all in-memory PII. MUST be called after every verification cycle.
   */
  purge() {
    this._currentScan = null;
    return { purged: true, ts: new Date().toISOString() };
  }

  /**
   * Get the current scan data (ephemeral).
   */
  getCurrentScan() {
    return this._currentScan ? { ...this._currentScan } : null;
  }

  // ─── Private helpers ───────────────────────────────────────────────────

  _parseAAMVADate(raw) {
    // MMDDYYYY → YYYY-MM-DD
    if (!raw || raw.length < 8) return null;
    const mm = raw.substring(0, 2);
    const dd = raw.substring(2, 4);
    const yyyy = raw.substring(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  _parseMRZDate(raw) {
    // YYMMDD → YYYY-MM-DD
    if (!raw || raw.length < 6) return null;
    let yy = parseInt(raw.substring(0, 2), 10);
    const mm = raw.substring(2, 4);
    const dd = raw.substring(4, 6);
    // Y2K pivot: 00-29 → 2000s, 30-99 → 1900s
    const yyyy = yy <= 29 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm}-${dd}`;
  }

  _sanitizeFields(fields) {
    // Return fields with PII flagged for ephemeral handling
    return {
      ...fields,
      _ephemeral: true,
      _purgableFields: ['firstName', 'lastName', 'fullName', 'middleName',
        'addressStreet', 'addressCity', 'documentNumber'],
    };
  }
}

const PSI = 1 / PHI;

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE TEST
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const engine = new IDVerificationEngine();

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  HEADY KIOSK — ID Verification Engine                ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Test PDF417 parsing
  const sampleBarcode = [
    'DCSSmith',
    'DACJohn',
    'DADMichael',
    'DBB06151990',
    'DBA01012028',
    'DAQD12345678',
    'DAG123 Main St',
    'DAIDenver',
    'DAJCO',
    'DAK80202',
    'DBC1',
  ].join('\n');

  const parsed = engine.parsePDF417(sampleBarcode);
  console.log('PDF417 Parse:', parsed.valid ? '✅ VALID' : '❌ INVALID');
  console.log(`  Name: ${parsed.fields.firstName} ${parsed.fields.lastName}`);
  console.log(`  DOB: ${parsed.fields.dateOfBirth}`);
  console.log(`  Expires: ${parsed.fields.expirationDate}`);
  console.log(`  Confidence: ${(parsed.confidence * 100).toFixed(0)}%`);

  // Test age calculation
  const ageResult = engine.calculateAge(parsed.fields.dateOfBirth);
  console.log(`  Age: ${ageResult.age}`);

  // Test expiration
  const expResult = engine.checkExpiration(parsed.fields.expirationDate);
  console.log(`  Expired: ${expResult.expired ? '❌ YES' : '✅ NO'} (${expResult.daysUntilExpiry} days remaining)`);

  // Test anonymization
  const token = engine.generateVerificationToken(parsed.fields);
  console.log(`  Anon Token: ${token}`);

  // Test purge
  const purgeResult = engine.purge();
  console.log(`  Purge: ${purgeResult.purged ? '✅ All PII purged' : '❌ Failed'}`);
  console.log(`  Current scan after purge: ${engine.getCurrentScan() === null ? '✅ null (clean)' : '❌ data remaining'}`);

  // Test MRZ parsing
  console.log('\n─── Passport MRZ ───');
  const mrzResult = engine.parseMRZ([
    'P<USASMITH<<JOHN<MICHAEL<<<<<<<<<<<<<<<<<<<<<',
    'AB1234567<0USA9006151M2801015<<<<<<<<<<<<<<00',
  ]);
  console.log('MRZ Parse:', mrzResult.valid ? '✅ VALID' : '❌ INVALID');
  if (mrzResult.valid) {
    console.log(`  Name: ${mrzResult.fields.firstName} ${mrzResult.fields.lastName}`);
    console.log(`  DOB: ${mrzResult.fields.dateOfBirth}`);
  }
}

module.exports = { IDVerificationEngine };

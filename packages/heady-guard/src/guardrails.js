// packages/heady-guard/src/guardrails.js
// Pipeline stage validators — PII detection, injection prevention, quality gates
import { CSL } from '../../heady-core/src/phi.js';

// ── PII Patterns (Microsoft Presidio-inspired) ────────────────────────────────
const PII_PATTERNS = [{
  type: 'SSN',
  pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g
}, {
  type: 'CREDIT_CARD',
  pattern: /\b(?:\d[ -]*?){13,19}\b/g
}, {
  type: 'EMAIL',
  pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
}, {
  type: 'PHONE',
  pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
}, {
  type: 'IP_ADDRESS',
  pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
}, {
  type: 'API_KEY',
  pattern: /\b(?:sk|pk|api)[-_][A-Za-z0-9]{20,}\b/gi
}, {
  type: 'JWT',
  pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
}];

// ── Injection Patterns ────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [{
  type: 'PROMPT_INJECTION',
  pattern: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|above|prior)\s*(?:instructions|rules|prompts)/i
}, {
  type: 'SYSTEM_OVERRIDE',
  pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/i
}, {
  type: 'JAILBREAK',
  pattern: /(?:DAN|Do\s+Anything\s+Now|\\n\\nHuman:|ADMIN\s+MODE|DEVELOPER\s+MODE)/i
}, {
  type: 'SQL_INJECTION',
  pattern: /(?:UNION\s+SELECT|DROP\s+TABLE|;\s*DELETE|OR\s+1\s*=\s*1|--\s*$)/i
}, {
  type: 'XSS',
  pattern: /<script|javascript:|on(?:load|error|click)\s*=|eval\s*\(/i
}];

/**
 * Detect PII in text — returns detected entities with types and positions.
 * @param {string} text
 * @returns {{ hasPII: boolean, entities: Array<{type: string, match: string, index: number}> }}
 */
export function detectPII(text) {
  const entities = [];
  for (const {
    type,
    pattern
  } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        match: match[0],
        index: match.index
      });
    }
  }
  return {
    hasPII: entities.length > 0,
    entities
  };
}

/**
 * Anonymize PII in text — replaces detected entities with type-labeled placeholders.
 * @param {string} text
 * @returns {string}
 */
export function anonymizePII(text) {
  let result = text;
  for (const {
    type,
    pattern
  } of PII_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, pattern.flags), `[REDACTED:${type}]`);
  }
  return result;
}
export function detectInjection(text) {
  const threats = [];
  for (const {
    type,
    pattern
  } of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) threats.push({
      type,
      match: match[0]
    });
  }
  return {
    safe: threats.length === 0,
    threats
  };
}

/**
 * Quality gate — validates output meets CSL threshold.
 * @param {string} output — generated text
 * @param {{ minLength?: number, maxLength?: number, cslThreshold?: number }} opts
 * @returns {{ passed: boolean, score: number, reason?: string }}
 */
export function qualityGate(output, opts = {}) {
  const {
    minLength = 10,
    maxLength = 50000,
    cslThreshold = CSL.INCLUDE
  } = opts;
  if (!output || typeof output !== 'string') return {
    passed: false,
    score: 0,
    reason: 'Empty output'
  };
  if (output.length < minLength) return {
    passed: false,
    score: 0.1,
    reason: `Too short: ${output.length} < ${minLength}`
  };
  if (output.length > maxLength) return {
    passed: false,
    score: 0.2,
    reason: `Too long: ${output.length} > ${maxLength}`
  };

  // Content quality heuristics
  let score = 0.5;
  if (output.length > 100) score += 0.1;
  if (/\n/.test(output)) score += 0.05; // Has structure
  if (/[.!?]$/.test(output.trim())) score += 0.05; // Proper ending
  if (!/(.)\1{10,}/.test(output)) score += 0.1; // No excessive repetition
  if (detectInjection(output).safe) score += 0.1;
  if (!detectPII(output).hasPII) score += 0.1;
  return {
    passed: score >= cslThreshold,
    score,
    reason: score < cslThreshold ? `Score ${score.toFixed(3)} < ${cslThreshold}` : undefined
  };
}

/**
 * Full pipeline stage validator — runs all guardrails on input and output.
 * @param {string} input
 * @param {string} output
 * @returns {{ inputSafe: boolean, outputSafe: boolean, piiDetected: boolean, qualityPassed: boolean, details: object }}
 */
export function validatePipelineStage(input, output) {
  const inputInjection = detectInjection(input);
  const inputPII = detectPII(input);
  const outputPII = detectPII(output);
  const quality = qualityGate(output);
  return {
    inputSafe: inputInjection.safe,
    outputSafe: !outputPII.hasPII && quality.passed,
    piiDetected: inputPII.hasPII || outputPII.hasPII,
    qualityPassed: quality.passed,
    details: {
      inputThreats: inputInjection.threats,
      inputPII: inputPII.entities,
      outputPII: outputPII.entities,
      qualityScore: quality.score,
      qualityReason: quality.reason
    }
  };
}
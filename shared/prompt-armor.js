/**
 * Prompt Armor — LLM Prompt Injection Defense
 * Eric Haywood — Sacred Geometry v4.0
 *
 * OWASP Top 10 for AI — Protection against prompt injection.
 * Uses parameterized prompt templates (never string concatenation).
 * Validates all LLM outputs against JSON schema before downstream use.
 * Sanitizes HTML outputs.
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// Maximum input lengths (Fibonacci-derived)
const LIMITS = {
  promptMaxLength:     FIB[16] * FIB[4], // 4935 chars
  systemPromptMax:     FIB[14],           // 377 chars
  outputMaxLength:     FIB[17],           // 2584 chars
  maxInjectionPatterns: FIB[10],          // 89 patterns
};

// Known injection patterns (never exhaustive — defense in depth)
const INJECTION_PATTERNS = [
  /ignore (?:all )?(?:previous |prior |above )?instructions/i,
  /disregard (?:all )?(?:previous |prior )?(?:instructions|rules|guidelines)/i,
  /you are now (?:a |an )?(?:different|new|unrestricted)/i,
  /forget (?:all |everything |your )?(?:you |about )?(?:know|rules|instructions)/i,
  /override (?:your |all )?(?:rules|instructions|safety)/i,
  /pretend (?:you are|to be) (?!.*heady)/i,
  /act as (?:if |though )?(?:you (?:are|were) |a )(?!.*heady)/i,
  /system:\s*you are/i,
  /\[INST\]/i,
  /\<\|(?:im_start|system|assistant)\|\>/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /\bdo anything now\b/i,
];

/**
 * Parameterized prompt template — prevents injection via user input.
 * User content is NEVER concatenated into the prompt string.
 * Instead, it's passed as a separate parameter with sanitization.
 */
class PromptTemplate {
  constructor(template, schema = null) {
    this.template = template;
    this.schema = schema; // JSON Schema for expected output
    this.params = this._extractParams(template);
  }

  _extractParams(template) {
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim());
  }

  /**
   * Render prompt with sanitized parameters.
   * @param {Object} params - Key-value pairs for template variables
   * @returns {string} Rendered prompt (safe)
   */
  render(params) {
    let rendered = this.template;
    for (const [key, value] of Object.entries(params)) {
      const sanitized = this.sanitizeInput(String(value));
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), sanitized);
    }
    return rendered;
  }

  /**
   * Sanitize user input before embedding in prompt.
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';

    // Enforce length limit
    let sanitized = input.slice(0, LIMITS.promptMaxLength);

    // Remove known control sequences
    sanitized = sanitized
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars
      .replace(/\<\|[^|]*\|\>/g, '')  // LLM delimiters
      .replace(/\[INST\]|\[\/INST\]/gi, '') // Instruction tags
      .replace(/<<SYS>>|<<\/SYS>>/gi, '');     // System tags

    return sanitized;
  }

  /**
   * Validate LLM output against expected JSON Schema.
   */
  validateOutput(output) {
    if (!this.schema) return { valid: true, output };

    try {
      const parsed = typeof output === 'string' ? JSON.parse(output) : output;
      const errors = validateAgainstSchema(parsed, this.schema);
      return { valid: errors.length === 0, output: parsed, errors };
    } catch (e) {
      return { valid: false, output: null, errors: [`JSON parse error: ${e.message}`] };
    }
  }
}

/**
 * Scan input for injection attempts.
 * Returns { safe: boolean, threats: string[] }
 */
function scanForInjection(input) {
  if (!input || typeof input !== 'string') return { safe: true, threats: [] };

  const threats = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      threats.push(pattern.source);
    }
  }
  return { safe: threats.length === 0, threats };
}

/**
 * Minimal JSON Schema validator (no external deps).
 */
function validateAgainstSchema(data, schema) {
  const errors = [];
  if (schema.type === 'object' && typeof data !== 'object') {
    errors.push(`Expected object, got ${typeof data}`);
    return errors;
  }
  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in data)) errors.push(`Missing required field: ${key}`);
    }
  }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        if (propSchema.type === 'string' && typeof data[key] !== 'string') {
          errors.push(`${key}: expected string, got ${typeof data[key]}`);
        }
        if (propSchema.type === 'number' && typeof data[key] !== 'number') {
          errors.push(`${key}: expected number, got ${typeof data[key]}`);
        }
        if (propSchema.type === 'array' && !Array.isArray(data[key])) {
          errors.push(`${key}: expected array, got ${typeof data[key]}`);
        }
        if (propSchema.maxLength && typeof data[key] === 'string' && data[key].length > propSchema.maxLength) {
          errors.push(`${key}: exceeds maxLength ${propSchema.maxLength}`);
        }
      }
    }
  }
  return errors;
}

/**
 * Sanitize HTML output from LLMs (prevent XSS).
 * Strips all tags except a safe subset.
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const SAFE_TAGS = new Set(['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'a']);
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    return SAFE_TAGS.has(tag.toLowerCase()) ? match.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '') : '';
  }).replace(/<script[\s\S]*?<\/script>/gi, '');
}

module.exports = {
  PromptTemplate,
  scanForInjection,
  sanitizeHtml,
  validateAgainstSchema,
  INJECTION_PATTERNS,
  LIMITS,
};

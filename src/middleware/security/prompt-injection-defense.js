'use strict';

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI; // ≈ 0.618
const PSI2 = PSI * PSI; // ≈ 0.382
const CSL_GATES = {
  include: PSI2,
  boost: PSI,
  inject: PSI + 0.1
};

// ─── Injection Patterns ──────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
// Direct instruction override
{
  pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
  weight: 0.9,
  category: 'override'
}, {
  pattern: /forget\s+(everything|all|your)\s*(instructions?|training|rules?|context)?/i,
  weight: 0.85,
  category: 'override'
}, {
  pattern: /disregard\s+(all|your|the)\s*(previous|prior|system)?\s*(instructions?|prompts?|rules?)/i,
  weight: 0.9,
  category: 'override'
},
// Role manipulation
{
  pattern: /you\s+are\s+now\s+(a|an|the)\s+/i,
  weight: 0.7,
  category: 'role'
}, {
  pattern: /pretend\s+(to\s+be|you\s+are|you're)\s/i,
  weight: 0.75,
  category: 'role'
}, {
  pattern: /act\s+as\s+(if\s+you\s+are|a|an|the)\s/i,
  weight: 0.6,
  category: 'role'
}, {
  pattern: /your\s+new\s+(role|persona|identity|character)\s+is/i,
  weight: 0.85,
  category: 'role'
},
// System prompt extraction
{
  pattern: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?|initial)/i,
  weight: 0.95,
  category: 'extraction'
}, {
  pattern: /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  weight: 0.8,
  category: 'extraction'
}, {
  pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?|config)/i,
  weight: 0.9,
  category: 'extraction'
}, {
  pattern: /output\s+(your|the)\s+(system\s+)?(prompt|instructions?|initialization)/i,
  weight: 0.9,
  category: 'extraction'
},
// Delimiter attacks
{
  pattern: /```system/i,
  weight: 0.85,
  category: 'delimiter'
}, {
  pattern: /\[SYSTEM\]|\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/i,
  weight: 0.9,
  category: 'delimiter'
}, {
  pattern: /###\s*(system|instruction|human|assistant)\s*:/i,
  weight: 0.8,
  category: 'delimiter'
},
// Encoding/obfuscation
{
  pattern: /base64\s*(encode|decode|convert)/i,
  weight: 0.5,
  category: 'encoding'
}, {
  pattern: /rot13|caesar\s*cipher|hex\s*encode/i,
  weight: 0.6,
  category: 'encoding'
},
// Data exfiltration
{
  pattern: /send\s+(this|the|all)\s+(data|info|information|response)\s+to\s/i,
  weight: 0.8,
  category: 'exfiltration'
}, {
  pattern: /fetch\s*\(\s*['"]https?:\/\/(?!.*headysystems)/i,
  weight: 0.7,
  category: 'exfiltration'
}, {
  pattern: /curl\s+|wget\s+|nc\s+/i,
  weight: 0.6,
  category: 'exfiltration'
}];
class PromptTemplate {
  constructor(template, schema = {}) {
    this._template = template;
    this._schema = schema;
    this._paramNames = [...template.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
  }
  render(params = {}) {
    let result = this._template;
    for (const name of this._paramNames) {
      const value = params[name];
      if (value === undefined && this._schema[name]?.required) {
        throw new Error(`Missing required prompt parameter: ${name}`);
      }

      // Sanitize: strip potential injection markers
      const sanitized = _sanitizeParam(String(value ?? ''), this._schema[name]);
      result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), sanitized);
    }
    return result;
  }
  get paramNames() {
    return [...this._paramNames];
  }
}
function _sanitizeParam(value, schema = {}) {
  let sanitized = value;

  // Truncate to max length
  if (schema.maxLength && sanitized.length > schema.maxLength) {
    sanitized = sanitized.slice(0, schema.maxLength);
  }

  // Strip system-like delimiters
  sanitized = sanitized.replace(/<\|[^|]*\|>/g, '').replace(/\[SYSTEM\]|\[INST\]|\[\/INST\]/gi, '').replace(/###\s*(system|instruction|human|assistant)\s*:/gi, '');

  // Strip markdown injection (code fences claiming to be system)
  sanitized = sanitized.replace(/```(system|instruction|prompt)[^`]*```/gis, '[filtered]');
  return sanitized;
}

// ─── Input Analyzer ──────────────────────────────────────────────────────────

/**
 * Analyze input text for injection patterns.
 * Returns a CSL confidence score of injection likelihood.
 *
 * @param {string} text - Input text to analyze
 * @returns {{ score: number, patterns: string[], blocked: boolean, category: string|null }}
 */
function analyzeInput(text) {
  if (!text || typeof text !== 'string') {
    return {
      score: 0,
      patterns: [],
      blocked: false,
      category: null
    };
  }
  let totalWeight = 0;
  const matched = [];
  const categories = {};
  for (const {
    pattern,
    weight,
    category
  } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      totalWeight += weight;
      matched.push(category);
      categories[category] = (categories[category] || 0) + weight;
    }
  }

  // Normalize to 0-1 using sigmoid-like function
  const score = Math.min(1, totalWeight / 2);

  // Determine top category
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    score,
    patterns: [...new Set(matched)],
    blocked: score >= PSI,
    // Block at φ⁻¹ ≈ 0.618
    category: topCategory
  };
}

// ─── Output Validator ────────────────────────────────────────────────────────

/**
 * Validate LLM output against expected JSON schema shape.
 *
 * @param {*} output - The LLM response to validate
 * @param {object} schema - Simple schema { type, properties, required }
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateOutput(output, schema = {}) {
  const errors = [];
  if (schema.type === 'string' && typeof output !== 'string') {
    errors.push(`Expected string, got ${typeof output}`);
  }
  if (schema.type === 'object') {
    if (typeof output !== 'object' || output === null) {
      errors.push(`Expected object, got ${typeof output}`);
      return {
        valid: false,
        errors
      };
    }
    for (const field of schema.required || []) {
      if (!(field in output)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (key in output) {
        if (propSchema.type && typeof output[key] !== propSchema.type) {
          errors.push(`Field ${key}: expected ${propSchema.type}, got ${typeof output[key]}`);
        }
        if (propSchema.maxLength && typeof output[key] === 'string' && output[key].length > propSchema.maxLength) {
          errors.push(`Field ${key}: exceeds maxLength ${propSchema.maxLength}`);
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize HTML output from LLM responses.
 * Strips dangerous tags and attributes — server-side DOMPurify equivalent.
 *
 * @param {string} html
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
  if (typeof html !== 'string') return '';
  return html
  // Remove script/style/iframe/object/embed tags and content
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/<object[\s\S]*?<\/object>/gi, '').replace(/<embed[\s\S]*?\/?>/gi, '').replace(/<link[\s\S]*?\/?>/gi, '')
  // Remove event handlers
  .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '').replace(/\s+on\w+\s*=\s*\S+/gi, '')
  // Remove javascript: and data: URIs
  .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"').replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '').replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, '')
  // Remove base tags
  .replace(/<base[\s\S]*?\/?>/gi, '')
  // Remove form action to external
  .replace(/action\s*=\s*["']https?:\/\/(?!.*headysystems)[^"']*["']/gi, 'action="#"');
}

// ─── Express Middleware ──────────────────────────────────────────────────────

/**
 * Middleware that scans request body for prompt injection patterns.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.fields]      - Body fields to scan (default: ['message', 'prompt', 'query', 'input', 'text'])
 * @param {boolean}  [opts.blockMode]   - If true, return 400 on injection. If false, flag but allow.
 * @param {Function} [opts.onDetection] - Callback on detection: (req, analysis) => void
 * @returns {Function} Express middleware
 */
function promptInjectionDefense(opts = {}) {
  const {
    fields = ['message', 'prompt', 'query', 'input', 'text', 'content', 'question'],
    blockMode = true,
    onDetection = null
  } = opts;
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') return next();
    for (const field of fields) {
      const value = req.body[field];
      if (typeof value !== 'string') continue;
      const analysis = analyzeInput(value);
      if (analysis.score >= PSI2) {
        // Suspicious — log it
        const logData = {
          level: analysis.blocked ? 'warn' : 'info',
          service: 'prompt-defense',
          event: 'injection-detected',
          field,
          score: +analysis.score.toFixed(3),
          categories: analysis.patterns,
          blocked: analysis.blocked,
          ip: req.ip,
          path: req.path,
          timestamp: new Date().toISOString()
        };
        process.stdout.write(JSON.stringify(logData) + '\n');
        if (onDetection) onDetection(req, analysis);
        if (blockMode && analysis.blocked) {
          return res.status(400).json({
            error: 'HEADY-SECURITY-001',
            message: 'Input rejected: contains patterns that violate content safety policy',
            category: analysis.category
          });
        }

        // Flag for downstream handlers
        req.promptInjectionRisk = analysis;
      }
    }
    next();
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  promptInjectionDefense,
  analyzeInput,
  validateOutput,
  sanitizeHTML,
  PromptTemplate,
  INJECTION_PATTERNS,
  CSL_GATES
};
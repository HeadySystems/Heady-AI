/**
 * Heady™ Vector-Native Security Scanner
 * Encodes threat patterns as hypervectors. Scans via cosine similarity.
 * Patent coverage: HS-062 (Vector-Native Security Scanner)
 * @module core/security/vector-scanner
 */
import { CSL, PHI, PSI } from '../constants/phi.js';
import { randomHV, bind, bundle, hvSimilarity } from '../memory/vsa-ops.js';

const THREAT_PATTERNS = {
  SQL_INJECTION:    ["SELECT * FROM users WHERE","\'; DROP TABLE","UNION SELECT NULL","1=1--","OR \'1\'=\'1","information_schema"],
  PROMPT_INJECTION: ["ignore previous instructions","disregard your system prompt","you are now","pretend you are","jailbreak","DAN mode"],
  SECRET_EXFIL:     ["API_KEY=","OPENAI_API_KEY","process.env","Authorization: Bearer","private_key","secret_access_key"],
  PATH_TRAVERSAL:   ["../../../etc/passwd","..\\windows\\system32","%2e%2e%2f","file:///"],
  CODE_INJECTION:   ["eval(","exec(","subprocess.run","__import__(\'os\')","require(\'child_process\')","process.mainModule"],
};

export class VectorScanner {
  #threatHVs = new Map();
  #embedder;

  constructor({ embedder } = {}) {
    this.#embedder = embedder;
    this.#buildThreatLibrary();
  }

  #buildThreatLibrary() {
    for (const [category, patterns] of Object.entries(THREAT_PATTERNS)) {
      this.#threatHVs.set(category, bundle(patterns.map(p => this.#hashToHV(p))));
    }
  }

  async scan(payload, { threshold = CSL.INCLUDE } = {}) {
    const payloadHV = this.#hashToHV(String(payload).toLowerCase());
    const threats = [];
    for (const [category, threatHV] of this.#threatHVs) {
      const similarity = hvSimilarity(payloadHV, threatHV);
      if (similarity > threshold) threats.push({ category, confidence: similarity, tier: similarity > CSL.BOOST ? 'HIGH' : 'MEDIUM' });
    }
    return { clean: threats.length === 0, threats: threats.sort((a,b) => b.confidence-a.confidence), maxThreatConfidence: threats[0]?.confidence ?? 0, payloadLength: payload.length };
  }

  addThreatPattern(category, pattern) {
    const newHV = this.#hashToHV(pattern.toLowerCase());
    const existing = this.#threatHVs.get(category);
    this.#threatHVs.set(category, existing ? bundle([existing, newHV]) : newHV);
  }

  #hashToHV(text, dim = 10000) {
    const hv = new Float32Array(dim);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const stride = Math.round(PHI * charCode) % dim;
      const pos = (i * 2654435761 + stride) % dim;
      hv[pos] += Math.sin(charCode * PHI + i) * PSI;
    }
    let mag = 0; for (let i = 0; i < dim; i++) mag += hv[i]*hv[i]; mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < dim; i++) hv[i] /= mag;
    return hv;
  }
}

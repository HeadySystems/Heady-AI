/**
 * ProjectionEngine — Latent-to-Physical Projection Engine
 * Projects vectors from the latent embedding space to physical representations
 * (code, configs, documents) using learned projection matrices.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887; const PSI = 0.6180339887; const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
function phiThreshold(level, spread = PSI2) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = { CRITICAL: phiThreshold(4), HIGH: phiThreshold(3), MEDIUM: phiThreshold(2), LOW: phiThreshold(1), MINIMUM: phiThreshold(0) };
function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) { return value * (1 / (1 + Math.exp(-(score - tau) / temp))); }
function cosineSimilarity(a, b) { let dot = 0, magA = 0, magB = 0; const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; } const d = Math.sqrt(magA) * Math.sqrt(magB); return d > 0 ? dot / d : 0; }
function hashSHA256(data) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

class ProjectionMatrix {
  constructor(inputDim, outputDim) { this.inputDim = inputDim; this.outputDim = outputDim; this.weights = new Float32Array(inputDim * outputDim); this.bias = new Float32Array(outputDim); this._init(); }
  _init() {
    const scale = Math.sqrt(PHI / (this.inputDim + this.outputDim)); let seed = 42;
    for (let i = 0; i < this.weights.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; this.weights[i] = (seed / 0x7fffffff * 2 - 1) * scale; }
    for (let i = 0; i < this.bias.length; i++) this.bias[i] = 0;
  }
  project(input) { const output = new Float32Array(this.outputDim); for (let o = 0; o < this.outputDim; o++) { let sum = this.bias[o]; for (let i = 0; i < this.inputDim; i++) sum += input[i] * this.weights[o * this.inputDim + i]; output[o] = sum; } return output; }
  update(gradients, learningRate = Math.pow(PSI, 5)) {
    for (let i = 0; i < this.weights.length; i++) this.weights[i] -= learningRate * (gradients.weights?.[i] ?? 0);
    for (let i = 0; i < this.bias.length; i++) this.bias[i] -= learningRate * (gradients.bias?.[i] ?? 0);
  }
}

const DOMAIN_CATALOG = {
  code: { outputDim: FIB[12], description: 'Projects embeddings to code structure representations', targetFormats: ['javascript', 'typescript', 'python'] },
  config: { outputDim: FIB[10], description: 'Projects embeddings to configuration schemas', targetFormats: ['yaml', 'json', 'toml'] },
  document: { outputDim: FIB[11], description: 'Projects embeddings to document structure representations', targetFormats: ['markdown', 'html', 'latex'] },
  architecture: { outputDim: FIB[11], description: 'Projects embeddings to architecture topology representations', targetFormats: ['c4', 'mermaid', 'dot'] },
  security: { outputDim: FIB[10], description: 'Projects embeddings to security policy representations', targetFormats: ['opa', 'cedar', 'json-policy'] },
};

class ProjectionEngine {
  constructor(config = {}) {
    this.inputDim = config.inputDim ?? 384; this.projectors = new Map();
    this.projectionHistory = []; this.maxHistory = FIB[16]; this.coherenceThreshold = CSL_THRESHOLDS.MEDIUM;
    this.auditLog = []; this.maxAuditEntries = FIB[16];
    for (const [domain, spec] of Object.entries(DOMAIN_CATALOG)) this.projectors.set(domain, { matrix: new ProjectionMatrix(this.inputDim, spec.outputDim), spec, usageCount: 0, avgCoherence: 1.0 });
  }
  _audit(action, detail) { const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) }; this.auditLog.push(entry); if (this.auditLog.length > this.maxAuditEntries) this.auditLog = this.auditLog.slice(-FIB[14]); }

  project(embedding, domain, context = {}) {
    const projector = this.projectors.get(domain);
    if (!projector) return { error: `Unknown projection domain: ${domain}` };
    const projected = projector.matrix.project(embedding); projector.usageCount++;
    let mag = 0; for (let i = 0; i < projected.length; i++) mag += projected[i] * projected[i]; mag = Math.sqrt(mag);
    const coherence = mag > 0 ? cslGate(1.0, Math.min(1.0, mag / PHI), this.coherenceThreshold) : 0;
    const gatedProjection = new Float32Array(projected.length);
    for (let i = 0; i < projected.length; i++) gatedProjection[i] = projected[i] * coherence;
    const result = { domain, projection: gatedProjection, coherence, magnitude: mag, targetFormats: projector.spec.targetFormats, hash: hashSHA256({ domain, mag, coherence }) };
    projector.avgCoherence = projector.avgCoherence * PSI + coherence * PSI2;
    this.projectionHistory.push({ domain, coherence, ts: Date.now(), contextKeys: Object.keys(context) });
    if (this.projectionHistory.length > this.maxHistory) this.projectionHistory = this.projectionHistory.slice(-FIB[14]);
    this._audit('project', { domain, coherence, magnitude: mag }); return result;
  }

  projectMulti(embedding, domains) { const results = {}; for (const domain of domains) results[domain] = this.project(embedding, domain); return results; }

  inverseProject(projected, domain) {
    const projector = this.projectors.get(domain);
    if (!projector) return { error: `Unknown domain: ${domain}` };
    const matrix = projector.matrix; const reconstructed = new Float32Array(this.inputDim);
    for (let i = 0; i < this.inputDim; i++) { let sum = 0; for (let o = 0; o < matrix.outputDim; o++) sum += projected[o] * matrix.weights[o * this.inputDim + i]; reconstructed[i] = sum; }
    let mag = 0; for (let i = 0; i < reconstructed.length; i++) mag += reconstructed[i] * reconstructed[i]; mag = Math.sqrt(mag);
    if (mag > 0) for (let i = 0; i < reconstructed.length; i++) reconstructed[i] /= mag;
    return { embedding: reconstructed, domain, reconstructionMagnitude: mag };
  }

  registerDomain(domain, spec) {
    if (this.projectors.has(domain)) return { error: `Domain already registered: ${domain}` };
    const outputDim = spec.outputDim ?? FIB[10];
    this.projectors.set(domain, { matrix: new ProjectionMatrix(this.inputDim, outputDim), spec: { ...spec, outputDim }, usageCount: 0, avgCoherence: 1.0 });
    this._audit('register-domain', { domain, outputDim }); return { domain, outputDim };
  }

  stats() {
    const domainStats = {};
    for (const [domain, proj] of this.projectors) domainStats[domain] = { outputDim: proj.spec.outputDim, usageCount: proj.usageCount, avgCoherence: proj.avgCoherence, targetFormats: proj.spec.targetFormats };
    return { inputDim: this.inputDim, domains: domainStats, totalProjections: this.projectionHistory.length, auditLogSize: this.auditLog.length };
  }
}

export default ProjectionEngine;
export { ProjectionEngine, ProjectionMatrix, DOMAIN_CATALOG };

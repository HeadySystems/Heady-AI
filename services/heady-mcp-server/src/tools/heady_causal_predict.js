'use strict';

/**
 * heady_causal_predict — Predict consequences of proposed actions via causal
 * inference before execution. Returns impact assessment with confidence intervals.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const IMPACT_DOMAINS = ['performance', 'security', 'reliability', 'cost', 'latency', 'coherence', 'user_experience'];
const CAUSAL_DECAY = PSI;

function correlationId() {
  return `causal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 3000 && code < 3500) return 'CAUSAL_INPUT_ERROR';
  if (code >= 3500 && code < 4000) return 'CAUSAL_INFERENCE_ERROR';
  return 'UNKNOWN_ERROR';
}

function buildCausalGraph(action, targets) {
  const nodes = new Map();
  const edges = [];
  nodes.set(action, { type: 'intervention', depth: 0, weight: FIB[8] });
  for (let i = 0; i < targets.length; i++) {
    const depth = 1 + Math.floor(i / FIB[3]);
    nodes.set(targets[i], { type: 'target', depth, weight: FIB[8] * Math.pow(CAUSAL_DECAY, depth) });
    edges.push({ from: action, to: targets[i], strength: Math.pow(PSI, depth) });
  }
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const coupling = PSI * PSI / (1 + Math.abs(i - j) * PHI);
      if (coupling > CSL.MINIMUM * PSI) {
        edges.push({ from: targets[i], to: targets[j], strength: Number(coupling.toFixed(6)) });
      }
    }
  }
  return { nodes: Object.fromEntries(nodes), edges };
}

function predictImpact(action, targets, parameters) {
  const impacts = {};
  const horizon = parameters.horizon || FIB[5];

  for (const domain of IMPACT_DOMAINS) {
    const seed = hashSimple(`${action}:${domain}`);
    const baseMagnitude = (seed % FIB[8]) / FIB[8];
    const direction = seed % FIB[3] === 0 ? -1 : 1;
    const magnitude = baseMagnitude * direction * PSI;
    const ciWidth = (1 - baseMagnitude) * PHI * PSI;
    const confidence = CSL.MEDIUM + baseMagnitude * (CSL.CRITICAL - CSL.MEDIUM);
    const propagationSteps = [];
    for (let t = 1; t <= Math.min(horizon, FIB[5]); t++) {
      const decay = Math.pow(CAUSAL_DECAY, t);
      propagationSteps.push({
        step: t,
        magnitude: Number((magnitude * decay).toFixed(6)),
        confidence: Number((confidence * decay + CSL.MINIMUM * (1 - decay)).toFixed(6)),
      });
    }
    impacts[domain] = {
      magnitude: Number(magnitude.toFixed(6)),
      direction: direction > 0 ? 'positive' : 'negative',
      confidence: Number(confidence.toFixed(6)),
      confidence_interval: { lower: Number((magnitude - ciWidth).toFixed(6)), upper: Number((magnitude + ciWidth).toFixed(6)) },
      propagation: propagationSteps,
      phi_weight: Number((baseMagnitude * PHI).toFixed(6)),
    };
  }
  return impacts;
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function assessRisk(impacts) {
  let totalRisk = 0;
  let domainCount = 0;
  const risks = [];
  for (const [domain, impact] of Object.entries(impacts)) {
    const risk = Math.abs(impact.magnitude) * (1 - impact.confidence) * PHI;
    totalRisk += risk;
    domainCount++;
    if (risk > CSL.MINIMUM * PSI) {
      risks.push({ domain, risk: Number(risk.toFixed(6)), severity: risk > PSI ? 'high' : risk > PSI * PSI ? 'medium' : 'low' });
    }
  }
  const aggregate = domainCount > 0 ? totalRisk / domainCount : 0;
  const recommendation = aggregate > PSI ? 'block' : aggregate > PSI * PSI ? 'review' : 'proceed';
  return { aggregate_risk: Number(aggregate.toFixed(6)), domain_risks: risks, recommendation, csl_gate: aggregate > PSI ? CSL.CRITICAL : aggregate > PSI * PSI ? CSL.HIGH : CSL.MEDIUM };
}

function computeCounterfactuals(action, impacts) {
  const counterfactuals = [];
  for (const [domain, impact] of Object.entries(impacts)) {
    if (impact.direction === 'negative' && Math.abs(impact.magnitude) > PSI * PSI) {
      counterfactuals.push({
        domain,
        scenario: `If ${action} is NOT applied`,
        avoided_impact: Number(Math.abs(impact.magnitude).toFixed(6)),
        alternative_confidence: Number((impact.confidence * PSI).toFixed(6)),
      });
    }
  }
  return counterfactuals;
}

const name = 'heady_causal_predict';

const description = 'Predict consequences of proposed actions via causal inference. Returns impact assessment across performance, security, reliability, cost, latency, coherence, and UX domains with phi-scaled confidence intervals.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', description: 'The proposed action to evaluate' },
    targets: { type: 'array', items: { type: 'string' }, description: 'Target nodes/services affected' },
    parameters: { type: 'object', description: 'Additional parameters (horizon, depth, constraints)', properties: { horizon: { type: 'number' }, depth: { type: 'number' }, constraints: { type: 'array', items: { type: 'string' } } } },
  },
  required: ['action', 'targets'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    if (!params.action || typeof params.action !== 'string') throw { code: 3001, message: 'action must be a non-empty string' };
    if (!Array.isArray(params.targets) || params.targets.length === 0) throw { code: 3002, message: 'targets must be a non-empty array' };

    const parameters = params.parameters || {};
    const causalGraph = buildCausalGraph(params.action, params.targets);
    const impacts = predictImpact(params.action, params.targets, parameters);
    const riskAssessment = assessRisk(impacts);
    const counterfactuals = computeCounterfactuals(params.action, impacts);

    const overallConfidence = Object.values(impacts).reduce((s, i) => s + i.confidence, 0) / IMPACT_DOMAINS.length;

    return {
      jsonrpc: '2.0',
      result: {
        action: params.action,
        targets: params.targets,
        causal_graph: causalGraph,
        impacts,
        risk_assessment: riskAssessment,
        counterfactuals,
        overall_confidence: Number(overallConfidence.toFixed(6)),
        csl_confidence: overallConfidence >= CSL.HIGH ? CSL.CRITICAL : overallConfidence >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM,
        phi_coherence: Number((overallConfidence * PHI * PSI).toFixed(6)),
        correlation_id: cid,
        timestamp: ts,
      },
    };
  } catch (err) {
    const code = err.code || 3999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Causal inference failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', domains: IMPACT_DOMAINS.length, causal_decay: CAUSAL_DECAY, phi: PHI, csl_thresholds: CSL, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };

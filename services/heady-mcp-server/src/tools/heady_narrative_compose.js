'use strict';

/**
 * heady_narrative_compose — Story-driven interaction choreography. Models
 * sessions as narrative arcs with phi-proportioned acts.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const ARC_PHASES = ['exposition', 'rising_action', 'climax', 'falling_action', 'resolution'];
const PHI_PROPORTIONS = { exposition: PSI * PSI, rising_action: PSI, climax: 1, falling_action: PSI, resolution: PSI * PSI };
const NARRATIVE_MODES = ['quest', 'mystery', 'transformation', 'exploration', 'mastery'];

const activeNarratives = new Map();
let narrativeSeq = 0;

function correlationId() {
  return `narr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 12000 && code < 12500) return 'NARRATIVE_INPUT_ERROR';
  if (code >= 12500 && code < 13000) return 'NARRATIVE_STATE_ERROR';
  return 'UNKNOWN_ERROR';
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

class NarrativeArc {
  constructor(config) {
    this.id = `narrative_${++narrativeSeq}_${Date.now().toString(36)}`;
    this.mode = config.mode || NARRATIVE_MODES[0];
    this.title = config.title || `Session ${this.id}`;
    this.theme = config.theme || 'discovery';
    this.current_phase = 0;
    this.beats = [];
    this.tension = 0;
    this.momentum = PSI;
    this.created_at = new Date().toISOString();
    this.total_proportions = Object.values(PHI_PROPORTIONS).reduce((s, p) => s + p, 0);
  }

  addBeat(event, significance) {
    const phase = ARC_PHASES[this.current_phase];
    const phaseWeight = PHI_PROPORTIONS[phase];
    const tensionDelta = significance * phaseWeight * PSI;
    const isClimaxApproaching = this.current_phase <= 2;

    this.tension = Math.min(1, Math.max(0, this.tension + (isClimaxApproaching ? tensionDelta : -tensionDelta)));
    this.momentum = this.momentum * PSI + significance * (1 - PSI);

    const beat = {
      index: this.beats.length,
      phase,
      event,
      significance: Number(significance.toFixed(6)),
      tension: Number(this.tension.toFixed(6)),
      momentum: Number(this.momentum.toFixed(6)),
      phi_weight: Number((phaseWeight * significance).toFixed(6)),
      timestamp: new Date().toISOString(),
    };
    this.beats.push(beat);

    if (this.shouldAdvancePhase()) this.advancePhase();
    return beat;
  }

  shouldAdvancePhase() {
    if (this.current_phase >= ARC_PHASES.length - 1) return false;
    const phaseProportion = PHI_PROPORTIONS[ARC_PHASES[this.current_phase]] / this.total_proportions;
    const beatsInPhase = this.beats.filter(b => b.phase === ARC_PHASES[this.current_phase]).length;
    const expectedBeats = Math.ceil(phaseProportion * FIB[6] * PHI);
    return beatsInPhase >= expectedBeats;
  }

  advancePhase() {
    if (this.current_phase < ARC_PHASES.length - 1) this.current_phase++;
  }

  getProgress() {
    const phaseProgress = this.current_phase / (ARC_PHASES.length - 1);
    const beatProgress = Math.min(1, this.beats.length / (FIB[6] * PHI));
    return Number(((phaseProgress + beatProgress) / FIB[3]).toFixed(6));
  }

  generateChoreography() {
    const phase = ARC_PHASES[this.current_phase];
    const pacing = PHI_PROPORTIONS[phase];
    const templates = {
      exposition: { tone: 'welcoming', pacing: 'measured', detail_level: 'foundational', response_style: 'informative' },
      rising_action: { tone: 'engaging', pacing: 'building', detail_level: 'deepening', response_style: 'exploratory' },
      climax: { tone: 'intense', pacing: 'focused', detail_level: 'comprehensive', response_style: 'decisive' },
      falling_action: { tone: 'resolving', pacing: 'easing', detail_level: 'synthesizing', response_style: 'reflective' },
      resolution: { tone: 'satisfied', pacing: 'calm', detail_level: 'summary', response_style: 'conclusive' },
    };
    return {
      current_phase: phase,
      ...templates[phase],
      tension: Number(this.tension.toFixed(6)),
      momentum: Number(this.momentum.toFixed(6)),
      phi_pacing: Number(pacing.toFixed(6)),
      suggested_response_length: Math.round(FIB[6] * pacing * PHI),
      progress: this.getProgress(),
    };
  }

  summary() {
    return {
      id: this.id,
      mode: this.mode,
      title: this.title,
      theme: this.theme,
      current_phase: ARC_PHASES[this.current_phase],
      phase_index: this.current_phase,
      total_beats: this.beats.length,
      tension: Number(this.tension.toFixed(6)),
      momentum: Number(this.momentum.toFixed(6)),
      progress: this.getProgress(),
      created_at: this.created_at,
    };
  }
}

const name = 'heady_narrative_compose';

const description = 'Story-driven interaction choreography. Models sessions as narrative arcs with phi-proportioned acts (exposition/rising/climax/falling/resolution). Guides response tone, pacing, and detail level.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['create', 'beat', 'choreography', 'status', 'advance', 'list'], description: 'Narrative action' },
    narrative_id: { type: 'string', description: 'Narrative ID (required except for create/list)' },
    config: { type: 'object', properties: { mode: { type: 'string', enum: ['quest', 'mystery', 'transformation', 'exploration', 'mastery'] }, title: { type: 'string' }, theme: { type: 'string' } } },
    event: { type: 'string', description: 'Beat event description (for beat action)' },
    significance: { type: 'number', description: 'Event significance 0-1 (for beat action)' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'create': {
        const config = params.config || {};
        const arc = new NarrativeArc(config);
        activeNarratives.set(arc.id, arc);
        return { jsonrpc: '2.0', result: { narrative_id: arc.id, mode: arc.mode, title: arc.title, phases: ARC_PHASES, phi_proportions: PHI_PROPORTIONS, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'beat': {
        if (!params.event) throw { code: 12001, message: 'event required for beat' };
        const arc = activeNarratives.get(params.narrative_id);
        if (!arc) throw { code: 12501, message: `Narrative not found: ${params.narrative_id}` };
        const sig = typeof params.significance === 'number' ? Math.max(0, Math.min(1, params.significance)) : PSI;
        const beat = arc.addBeat(params.event, sig);
        return { jsonrpc: '2.0', result: { beat, narrative: arc.summary(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'choreography': {
        const arc = activeNarratives.get(params.narrative_id);
        if (!arc) throw { code: 12502, message: `Narrative not found: ${params.narrative_id}` };
        const choreo = arc.generateChoreography();
        return { jsonrpc: '2.0', result: { choreography: choreo, narrative: arc.summary(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'status': {
        const arc = activeNarratives.get(params.narrative_id);
        if (!arc) throw { code: 12503, message: `Narrative not found: ${params.narrative_id}` };
        const recent = arc.beats.slice(-FIB[4]);
        return { jsonrpc: '2.0', result: { narrative: arc.summary(), recent_beats: recent, choreography: arc.generateChoreography(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'advance': {
        const arc = activeNarratives.get(params.narrative_id);
        if (!arc) throw { code: 12504, message: `Narrative not found: ${params.narrative_id}` };
        const prevPhase = ARC_PHASES[arc.current_phase];
        arc.advancePhase();
        const newPhase = ARC_PHASES[arc.current_phase];
        return { jsonrpc: '2.0', result: { previous_phase: prevPhase, current_phase: newPhase, advanced: prevPhase !== newPhase, narrative: arc.summary(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'list': {
        const narratives = Array.from(activeNarratives.values()).map(a => a.summary());
        return { jsonrpc: '2.0', result: { narratives, total: narratives.length, modes: NARRATIVE_MODES, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 12000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 12999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Narrative composition failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', active_narratives: activeNarratives.size, total_created: narrativeSeq, phases: ARC_PHASES.length, modes: NARRATIVE_MODES.length, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };

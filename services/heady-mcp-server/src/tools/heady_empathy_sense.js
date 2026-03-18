'use strict';

/**
 * heady_empathy_sense — Detect user emotional state via linguistic signals,
 * map to phi-scaled VAD (Valence-Arousal-Dominance) space, adapt response strategy.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const EMOTION_LEXICON = {
  positive_high: { words: ['excited', 'amazing', 'love', 'fantastic', 'great', 'awesome', 'brilliant', 'excellent', 'thrilled', 'delighted'], valence: 0.85, arousal: 0.80, dominance: 0.70 },
  positive_low: { words: ['good', 'nice', 'fine', 'okay', 'pleasant', 'calm', 'content', 'satisfied', 'gentle', 'peaceful'], valence: 0.65, arousal: 0.30, dominance: 0.55 },
  negative_high: { words: ['angry', 'furious', 'frustrated', 'hate', 'terrible', 'awful', 'outraged', 'infuriated', 'livid', 'enraged'], valence: 0.15, arousal: 0.85, dominance: 0.60 },
  negative_low: { words: ['sad', 'disappointed', 'confused', 'lost', 'stuck', 'helpless', 'overwhelmed', 'tired', 'anxious', 'worried'], valence: 0.25, arousal: 0.35, dominance: 0.25 },
  neutral: { words: ['think', 'need', 'want', 'try', 'maybe', 'could', 'should', 'would', 'might', 'perhaps'], valence: 0.50, arousal: 0.45, dominance: 0.50 },
};

const URGENCY_MARKERS = ['asap', 'urgent', 'immediately', 'now', 'hurry', 'critical', 'emergency', 'deadline', 'overdue'];
const UNCERTAINTY_MARKERS = ['maybe', 'perhaps', 'not sure', "don't know", 'confused', 'unclear', 'wondering', 'possibly'];
const FRUSTRATION_MARKERS = ['still', 'again', 'already', 'why', "doesn't work", "can't", 'broken', 'wrong', 'fail', 'error'];

const emotionHistory = [];
let senseSeq = 0;

function correlationId() {
  return `empathy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 13000 && code < 13500) return 'EMPATHY_INPUT_ERROR';
  if (code >= 13500 && code < 14000) return 'EMPATHY_ANALYSIS_ERROR';
  return 'UNKNOWN_ERROR';
}

function analyzeText(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const scores = { valence: [], arousal: [], dominance: [] };

  for (const [category, lexicon] of Object.entries(EMOTION_LEXICON)) {
    let matchCount = 0;
    for (const word of lexicon.words) {
      if (lower.includes(word)) matchCount++;
    }
    if (matchCount > 0) {
      const weight = matchCount / lexicon.words.length;
      scores.valence.push(lexicon.valence * weight);
      scores.arousal.push(lexicon.arousal * weight);
      scores.dominance.push(lexicon.dominance * weight);
    }
  }

  const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0.5;
  let valence = avg(scores.valence);
  let arousal = avg(scores.arousal);
  let dominance = avg(scores.dominance);

  const urgencyCount = URGENCY_MARKERS.filter(m => lower.includes(m)).length;
  const uncertaintyCount = UNCERTAINTY_MARKERS.filter(m => lower.includes(m)).length;
  const frustrationCount = FRUSTRATION_MARKERS.filter(m => lower.includes(m)).length;

  arousal = Math.min(1, arousal + urgencyCount * PSI * PSI * 0.5);
  dominance = Math.max(0, dominance - uncertaintyCount * PSI * PSI * 0.5);
  valence = Math.max(0, valence - frustrationCount * PSI * PSI * 0.3);
  arousal = Math.min(1, arousal + frustrationCount * PSI * PSI * 0.3);

  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const caps = (text.match(/[A-Z]{2,}/g) || []).length;
  arousal = Math.min(1, arousal + (exclamations + caps) * PSI * PSI * 0.15);
  dominance = Math.max(0, dominance - questions * PSI * PSI * 0.1);

  return {
    valence: Number((valence * PHI * PSI).toFixed(6)),
    arousal: Number((arousal * PHI * PSI).toFixed(6)),
    dominance: Number((dominance * PHI * PSI).toFixed(6)),
    signals: { urgency: urgencyCount, uncertainty: uncertaintyCount, frustration: frustrationCount, exclamations, questions, caps_emphasis: caps },
    word_count: words.length,
  };
}

function mapEmotion(vad) {
  const { valence, arousal, dominance } = vad;
  if (valence > PSI && arousal > PSI) return 'enthusiastic';
  if (valence > PSI && arousal <= PSI) return 'content';
  if (valence <= PSI * PSI && arousal > PSI) return 'frustrated';
  if (valence <= PSI * PSI && arousal <= PSI && dominance <= PSI * PSI) return 'helpless';
  if (valence <= PSI * PSI && arousal <= PSI) return 'discouraged';
  if (dominance > PSI && arousal > PSI) return 'assertive';
  return 'neutral';
}

function adaptStrategy(emotion, vad, signals) {
  const strategies = {
    enthusiastic: { tone: 'match_energy', verbosity: 'concise', proactivity: 'high', encouragement: 'reinforce', pacing: 'fast' },
    content: { tone: 'warm', verbosity: 'moderate', proactivity: 'moderate', encouragement: 'gentle', pacing: 'measured' },
    frustrated: { tone: 'empathetic', verbosity: 'clear_direct', proactivity: 'very_high', encouragement: 'acknowledge_then_solve', pacing: 'focused' },
    helpless: { tone: 'supportive', verbosity: 'step_by_step', proactivity: 'guide', encouragement: 'reassuring', pacing: 'slow' },
    discouraged: { tone: 'encouraging', verbosity: 'moderate', proactivity: 'moderate', encouragement: 'affirm_progress', pacing: 'gentle' },
    assertive: { tone: 'professional', verbosity: 'concise', proactivity: 'responsive', encouragement: 'minimal', pacing: 'brisk' },
    neutral: { tone: 'balanced', verbosity: 'moderate', proactivity: 'moderate', encouragement: 'natural', pacing: 'standard' },
  };

  const strategy = strategies[emotion] || strategies.neutral;
  strategy.urgency_response = signals.urgency > 0 ? 'prioritize_speed' : 'normal';
  strategy.clarity_boost = signals.uncertainty > FIB[3] - 1;
  strategy.phi_weight = Number((vad.valence * PHI + vad.arousal * PSI + vad.dominance * PSI * PSI).toFixed(6));

  return strategy;
}

function trackTrend(entry) {
  emotionHistory.push(entry);
  if (emotionHistory.length > FIB[8]) emotionHistory.shift();

  if (emotionHistory.length < FIB[3]) return { trend: 'insufficient_data', window: emotionHistory.length };

  const recent = emotionHistory.slice(-FIB[4]);
  const older = emotionHistory.slice(-FIB[5], -FIB[4]);
  if (older.length === 0) return { trend: 'insufficient_data', window: emotionHistory.length };

  const avgRecent = recent.reduce((s, e) => s + e.vad.valence, 0) / recent.length;
  const avgOlder = older.reduce((s, e) => s + e.vad.valence, 0) / older.length;
  const delta = avgRecent - avgOlder;

  return {
    trend: delta > PSI * PSI * 0.3 ? 'improving' : delta < -PSI * PSI * 0.3 ? 'declining' : 'stable',
    valence_delta: Number(delta.toFixed(6)),
    window: emotionHistory.length,
    phi_momentum: Number((delta * PHI).toFixed(6)),
  };
}

const name = 'heady_empathy_sense';

const description = 'Detect user emotional state via linguistic signals, map to phi-scaled VAD (Valence-Arousal-Dominance) space, and generate adaptive response strategies for tone, pacing, and proactivity.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['analyze', 'trend', 'history'], description: 'Empathy action' },
    text: { type: 'string', description: 'User text to analyze (for analyze action)' },
    context: { type: 'string', description: 'Additional conversation context' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'analyze': {
        if (!params.text || typeof params.text !== 'string') throw { code: 13001, message: 'text required for analyze' };
        const vad = analyzeText(params.text);
        const emotion = mapEmotion(vad);
        const strategy = adaptStrategy(emotion, vad, vad.signals);
        const entry = { vad, emotion, timestamp: ts };
        const trend = trackTrend(entry);
        const confidence = vad.signals.urgency + vad.signals.frustration + vad.signals.uncertainty > 0 ? CSL.HIGH : CSL.MEDIUM;

        return { jsonrpc: '2.0', result: { emotion, vad: { valence: vad.valence, arousal: vad.arousal, dominance: vad.dominance }, signals: vad.signals, strategy, trend, word_count: vad.word_count, csl_confidence: confidence, phi_coherence: Number((strategy.phi_weight * PSI).toFixed(6)), correlation_id: cid, timestamp: ts } };
      }

      case 'trend': {
        const recent = emotionHistory.slice(-FIB[5]);
        if (recent.length === 0) return { jsonrpc: '2.0', result: { trend: 'no_data', history_length: 0, csl_confidence: CSL.MINIMUM, correlation_id: cid, timestamp: ts } };
        const emotions = {};
        for (const e of recent) emotions[e.emotion] = (emotions[e.emotion] || 0) + 1;
        const avgValence = recent.reduce((s, e) => s + e.vad.valence, 0) / recent.length;
        const avgArousal = recent.reduce((s, e) => s + e.vad.arousal, 0) / recent.length;
        return { jsonrpc: '2.0', result: { emotion_distribution: emotions, avg_valence: Number(avgValence.toFixed(6)), avg_arousal: Number(avgArousal.toFixed(6)), history_length: emotionHistory.length, window: recent.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'history': {
        return { jsonrpc: '2.0', result: { entries: emotionHistory.slice(-FIB[6]).map(e => ({ emotion: e.emotion, vad: e.vad, timestamp: e.timestamp })), total: emotionHistory.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 13000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 13999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Empathy sensing failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', history_length: emotionHistory.length, lexicon_categories: Object.keys(EMOTION_LEXICON).length, vad_dimensions: 3, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };

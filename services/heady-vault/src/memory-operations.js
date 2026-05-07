const { PHI, PSI, CSL } = require('../../../src/kernel');

/**
 * Pure functions implementing Agentic Memory (AgeMem) operation semantics.
 */

/**
 * Calculates a phi-weighted decayed importance score.
 * score = baseImportance * (PSI ^ days_old)
 * where PSI is 1/PHI (approx 0.618)
 */
function importanceScore(baseImportance, createdAtMs) {
  const daysOld = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
  // As days increase, importance decays according to golden ratio
  const decayed = baseImportance * Math.pow(PSI, Math.max(0, daysOld));
  return Math.max(0, Math.min(1, decayed));
}

/**
 * Uses CSL (Continuous Semantic Logic) threshold gates to determine 
 * if a memory should be discarded based on system pressure.
 */
function shouldDiscard(memoryEntry, systemPressure) {
  const score = importanceScore(memoryEntry.importance || 0.5, memoryEntry.createdAt);
  
  // Dynamic threshold based on CSL:
  // High pressure -> lower threshold to evict more
  // Low pressure -> strict threshold to keep more
  const threshold = systemPressure >= CSL.HIGH_CONFIDENCE 
    ? CSL.LOW_CONFIDENCE 
    : CSL.NOISE_FLOOR;
  
  return score < threshold;
}

/**
 * Summarizes a set of episodic memories up to a target length
 * by prioritizing them based on their phi-weighted importance score.
 */
function compressEpisodic(memories, targetLength = 1000) {
  if (!memories || memories.length === 0) return "";

  // Sort by decayed importance (highest first)
  const sorted = [...memories].sort((a, b) => 
    importanceScore(b.importance || 0.5, b.createdAt) - 
    importanceScore(a.importance || 0.5, a.createdAt)
  );

  let summary = "";
  for (const mem of sorted) {
    // Assuming mem.content or mem.text holds the string payload
    const text = mem.content || mem.text || JSON.stringify(mem.metadata || {});
    const snippet = `[${new Date(mem.createdAt).toISOString()}] ${text}\n`;
    
    if (summary.length + snippet.length > targetLength && summary.length > 0) {
      break;
    }
    summary += snippet;
  }
  
  return summary.trim();
}

module.exports = {
  importanceScore,
  shouldDiscard,
  compressEpisodic
};

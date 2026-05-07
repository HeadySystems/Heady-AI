const { CSL_THRESHOLDS } = require('./phi-math');
const { AGENT_MANIFESTS } = require('./agent-manifest');
const { getLog } = require('../src/kernel');

const logger = getLog('tom-initializer');

class ToMInitializer {
  /**
   * Returns the full agent manifest catalog.
   */
  static async loadAgentManifest() {
    return AGENT_MANIFESTS;
  }

  /**
   * Constructs the Theory of Mind initialization block for a sub-agent.
   * @param {string} agentId - ID of the agent receiving the prompt
   * @param {string} sharedObjective - The global objective of the swarm
   * @param {string[]} activeAgents - List of active agent IDs
   * @returns {string} - The ToM prompt block
   */
  static buildToMPrompt(agentId, sharedObjective, activeAgents = Object.keys(AGENT_MANIFESTS)) {
    const me = AGENT_MANIFESTS[agentId];
    if (!me) throw new Error(`Unknown agent: ${agentId}`);

    let prompt = `[Theory of Mind Initialization for ${agentId}]\n`;
    prompt += `Your Role: ${me.role}\n`;
    prompt += `Your Objective: ${me.objective}\n`;
    prompt += `Shared System Objective: ${sharedObjective}\n\n`;

    prompt += `[Other Active Agents in Swarm]\n`;
    for (const otherId of activeAgents) {
      if (otherId === agentId) continue;
      const other = AGENT_MANIFESTS[otherId];
      if (other) {
        prompt += `- ${otherId} (${other.role}): Focuses on ${other.objective}\n`;
      }
    }
    
    prompt += `\nKeep these other agents in mind. Do not duplicate their work, and structure your output so it can be utilized by them if needed.\n`;
    return prompt;
  }

  /**
   * Measures emergence capacity using information-theoretic metrics (simplified).
   * @param {Array<{id: string, syncScore: number}>} swarmTelemetry
   * @returns {number} synergy score between 0 and 1
   */
  static measureEmergenceCapacity(swarmTelemetry) {
    if (!swarmTelemetry || swarmTelemetry.length === 0) return 0;
    
    let sum = 0;
    for (const telemetry of swarmTelemetry) {
      sum += (telemetry.syncScore || 0.5);
    }
    
    const avgSync = sum / swarmTelemetry.length;
    // Slight boost for multi-agent synergy, max capped at 1.0
    const capacity = Math.min(1, avgSync * 1.2); 

    // Alert if capacity is below degraded threshold
    if (capacity < CSL_THRESHOLDS.LOW) {
      logger.warn('Low emergence capacity detected in swarm', { 
        capacity, 
        threshold: CSL_THRESHOLDS.LOW,
        action: 'conductor_rebalance_suggested' 
      });
    }

    return capacity;
  }
}

module.exports = { ToMInitializer };

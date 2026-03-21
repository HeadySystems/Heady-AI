const path = require('path');
const fs = require('fs');

// ── Import factories ─────────────────────────────────────────────
let beeFactory;
try {
  beeFactory = require('../bees/bee-factory');
} catch {
  // Fallback if bee-factory not available
  beeFactory = {
    createBee: (domain, cfg) => ({
      domain,
      ...cfg,
      created: true
    }),
    spawnBee: (name, fn) => ({
      name,
      spawned: true
    }),
    createFromTemplate: (tpl, cfg) => ({
      template: tpl,
      ...cfg,
      created: true
    }),
    listDynamicBees: () => []
  };
}
let swarmIntelligence;
try {
  swarmIntelligence = require('../orchestration/swarm-intelligence');
} catch {
  swarmIntelligence = null;
}
const generatedTemplates = new Map();
const templateHistory = [];
function checkForTemplate(toolName, args) {
  const key = `${toolName}:${JSON.stringify(args).substring(0, 100)}`;
  if (generatedTemplates.has(key)) {
    return {
      found: true,
      template: generatedTemplates.get(key),
      source: 'generated-cache'
    };
  }
  try {
    const scenarios = require('../config/headybee-template-scenarios.json');
    const match = scenarios.find(s => s.toolPattern === toolName);
    if (match) {
      return {
        found: true,
        template: match,
        source: 'scenario-config'
      };
    }
  } catch {/* no scenarios file */}
  return {
    found: false
  };
}
function generateTemplateFromResult(toolName, args, result) {
  const templateMeta = {
    toolName,
    timestamp: new Date().toISOString(),
    bees: [],
    swarms: []
  };

  // ── Generate HeadyBee for the task pattern ──
  const beeDomain = `template-${toolName.replace('heady_', '')}`;
  const bee = beeFactory.createBee(beeDomain, {
    description: `Template bee for ${toolName} pattern`,
    priority: 0.7,
    workers: [{
      name: `${toolName}-replay`,
      fn: async () => ({
        bee: beeDomain,
        action: 'template-replay',
        originalTool: toolName,
        originalArgs: args,
        templateCreated: templateMeta.timestamp
      })
    }]
  });
  templateMeta.bees.push({
    domain: beeDomain,
    description: bee.description
  });

  // ── Generate HeadySwarm if task involves multiple tools ──
  const multiToolPatterns = ['heady_auto_flow', 'heady_deep_scan', 'heady_deploy', 'heady_ops', 'heady_battle', 'heady_coder'];
  if (multiToolPatterns.includes(toolName)) {
    const swarmId = `swarm-${toolName.replace('heady_', '')}-${Date.now()}`;
    const swarmDef = {
      id: swarmId,
      coordinator: beeDomain,
      bees: [beeDomain],
      strategy: 'fan-out',
      description: `Swarm template for ${toolName} orchestration`,
      createdAt: templateMeta.timestamp
    };

    // If swarm intelligence is available, register
    if (swarmIntelligence?.registerSwarm) {
      swarmIntelligence.registerSwarm(swarmDef);
    }
    templateMeta.swarms.push(swarmDef);
  }
  const key = `${toolName}:${JSON.stringify(args).substring(0, 100)}`;
  generatedTemplates.set(key, {
    bee: beeDomain,
    args,
    result: typeof result === 'string' ? result.substring(0, 500) : null,
    created: templateMeta.timestamp
  });
  templateHistory.push(templateMeta);
  return templateMeta;
}
function getTemplateStats() {
  return {
    cachedTemplates: generatedTemplates.size,
    totalGenerated: templateHistory.length,
    activeBees: beeFactory.listDynamicBees().filter(b => b.domain.startsWith('template-')).length,
    history: templateHistory.slice(-10) // Last 10
  };
}
async function withTemplateAutoGen(originalCallTool, toolName, args) {
  const existingTemplate = checkForTemplate(toolName, args);

  // 2. Execute the tool
  const result = await originalCallTool(toolName, args);
  const readOnlyTools = ['heady_health', 'heady_hcfp_status', 'heady_vector_stats'];
  let templateResult = null;
  if (!readOnlyTools.includes(toolName)) {
    templateResult = generateTemplateFromResult(toolName, args, result);
  }
  if (templateResult && result?.content?.[0]) {
    try {
      const originalText = result.content[0].text;
      const parsed = JSON.parse(originalText);
      parsed._heady_template = {
        injected: existingTemplate.found,
        generated: !!templateResult,
        bees: templateResult?.bees?.length || 0,
        swarms: templateResult?.swarms?.length || 0
      };
      result.content[0].text = JSON.stringify(parsed, null, 2);
    } catch {
      // Non-JSON response, skip metadata injection
    }
  }
  return result;
}
module.exports = {
  checkForTemplate,
  generateTemplateFromResult,
  getTemplateStats,
  withTemplateAutoGen,
  generatedTemplates,
  templateHistory
};
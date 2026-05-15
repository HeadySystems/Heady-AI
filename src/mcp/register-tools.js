import { ToolRegistry } from './tool-registry.js';

// Import tool definitions and handlers
import { headyConfiguratorDef, handleHeadyConfigurator } from './tools/heady-configurator-tool.js';
import { headyOrchestratorDef, handleHeadyOrchestrator } from './tools/heady-orchestrator-tool.js';
import { headyMemoryOpsDef, handleHeadyMemoryOps } from './tools/heady-memory-ops-tool.js';
import { headyBattleSimDef, handleHeadyBattleSim } from './tools/heady-battle-sim-tool.js';
import { headyDriftAnalyzerDef, handleHeadyDriftAnalyzer } from './tools/heady-drift-analyzer-tool.js';
import { headyRegenBootstrapDef, handleHeadyRegenBootstrap } from './tools/heady-regenerative-bootstrap-tool.js';
import { headyTradingIntelDef, handleHeadyTradingIntel } from './tools/heady-trading-intelligence-tool.js';
import { headyAutoAuditDef, handleHeadyAutoAudit } from './tools/heady-auto-audit-tool.js';

export const toolRegistry = new ToolRegistry();

export function registerAllTools() {
    // 1. Configurator
    toolRegistry.register(headyConfiguratorDef);
    toolRegistry.attachHandler(headyConfiguratorDef.name, handleHeadyConfigurator);

    // 2. Orchestrator
    if (typeof headyOrchestratorDef !== 'undefined') {
        toolRegistry.register(headyOrchestratorDef);
        toolRegistry.attachHandler(headyOrchestratorDef.name, handleHeadyOrchestrator);
    }

    // 3. Memory Ops
    if (typeof headyMemoryOpsDef !== 'undefined') {
        toolRegistry.register(headyMemoryOpsDef);
        toolRegistry.attachHandler(headyMemoryOpsDef.name, handleHeadyMemoryOps);
    }

    // 4. Battle Sim
    if (typeof headyBattleSimDef !== 'undefined') {
        toolRegistry.register(headyBattleSimDef);
        toolRegistry.attachHandler(headyBattleSimDef.name, handleHeadyBattleSim);
    }

    // 5. Drift Analyzer
    if (typeof headyDriftAnalyzerDef !== 'undefined') {
        toolRegistry.register(headyDriftAnalyzerDef);
        toolRegistry.attachHandler(headyDriftAnalyzerDef.name, handleHeadyDriftAnalyzer);
    }

    // 6. Regenerative Bootstrap
    if (typeof headyRegenBootstrapDef !== 'undefined') {
        toolRegistry.register(headyRegenBootstrapDef);
        toolRegistry.attachHandler(headyRegenBootstrapDef.name, handleHeadyRegenBootstrap);
    }

    // 7. Trading Intelligence
    if (typeof headyTradingIntelDef !== 'undefined') {
        toolRegistry.register(headyTradingIntelDef);
        toolRegistry.attachHandler(headyTradingIntelDef.name, handleHeadyTradingIntel);
    }

    // 8. Auto Audit
    if (typeof headyAutoAuditDef !== 'undefined') {
        toolRegistry.register(headyAutoAuditDef);
        toolRegistry.attachHandler(headyAutoAuditDef.name, handleHeadyAutoAudit);
    }

    return toolRegistry;
}

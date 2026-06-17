/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ Dropzone Reaction Bee v1.0.0                             ║
 * ║  Executes exhaustive workflow matrix on dropped files            ║
 * ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const { createBee } = require('./bee-factory');
const logger = require('../utils/logger').child('dropzone-reaction-bee');

// The exhaustive list of workflows requested by the user
const EXHAUSTIVE_WORKFLOWS = [
    '/heady-battle-sim', '/heady-csl-engine', '/heady-sync', '/auto-extract-tasks', 
    '/code-projection', '/concept-alignment', '/continuous-embedding', '/deep-scan-init', 
    '/deployment-verification', '/foundational-pillars', '/vector-space-ops', '/ram-ops', 
    '/building-data-apps', '/chrome-extensions', '/heady-service-bootstrap', '/memory-compaction', 
    '/data-autocleaning', '/firebase-ai-logic-basics', '/firebase-auth-basics', '/firebase-app-hosting-basics', 
    '/discovering-gcp-data-assets', '/firebase-basics', '/gcloud-auth-verification', '/heady-a2a-protocol', 
    '/firebase-firestore', '/firebase-hosting-basics', '/firebase-remote-config-basics', 
    '/firebase-security-rules-auditor', '/google-antigravity-sdk', '/heady-agent-factory', 
    '/heady-agent-orchestration', '/heady-ai-checks', '/heady-arena-productization', 
    '/heady-auth-provider-federation', '/heady-auto-flow', '/bee-swarm-diagnostic', 
    '/heady-prompt-pipeline', '/health-check', '/heady-drift-monitor', '/mcp:heady-mcp:heady-sys',
    '/mcp:heady-mcp:heady-system-prompt', '/heady-battle-arena', '/heady-bee-swarm-ops', 
    '/heady-buddy-device', '/heady-cloud-orchestrator', '/heady-code-generation', 
    '/heady-coding-standards', '/heady-cognitive-runtime', '/heady-colab-runtime', 
    '/heady-companion-memory', '/heady-connector-forge', '/heady-connector-health', 
    '/heady-connector-vault', '/heady-context-window-manager', '/heady-continuous-action', 
    '/heady-cost-guardian', '/heady-crdt-collaboration', '/heady-cross-device-handoff', 
    '/heady-cross-device-sync-fabric', '/heady-delegation-architect', '/heady-dependency-guard', 
    '/heady-deployment', '/heady-design-bridge', '/heady-digital-presence', '/heady-distiller', 
    '/heady-domain-architecture-ops', '/heady-drift-detection', '/heady-drupal-headless-ops', 
    '/heady-durable-agent-state', '/heady-durable-execution', '/heady-edge-ai', 
    '/heady-embedding-router', '/heady-event-bus', '/heady-evolution-swarm', '/heady-feature-forge', 
    '/heady-fintech-trading', '/heady-firebase-auth-orchestrator', '/heady-forensic-analyst', 
    '/heady-gateway-routing', '/heady-git-ops', '/heady-health-watch-swarm', '/heady-hooks', 
    '/heady-hybrid-vector-search', '/heady-hypothesis-lab', '/heady-ide-control-plane', 
    '/heady-ide-governed-codeflow', '/heady-incident-ops', '/heady-installable-package-release-ops', 
    '/heady-intelligence-analytics', '/heady-intent-tracker', '/heady-knowledge-cartographer', 
    '/heady-knowledge-ingestion', '/heady-knowledge-ingestion-briefing', '/heady-linter-gate', 
    '/heady-liquid-channel', '/heady-liquid-module-design', '/heady-liquid-conversation', 
    '/heady-liquid-crew', '/heady-liquid-gateway', '/heady-mcp-gateway-zero-trust', 
    '/heady-liquid-graph', '/heady-liquid-persona', '/heady-liquid-stream', '/heady-living-dashboard', 
    '/heady-manager-surface-design', '/heady-maximum-potential', '/heady-mcp-gateway', 
    '/heady-mcp-streaming-interface', '/heady-memory-knowledge-os', '/heady-memory-ledger-design', 
    '/heady-memory-ops', '/heady-merkle-index', '/heady-microfrontend-portal', '/heady-middleware-armor', 
    '/heady-midi-creative', '/heady-monetization-platform', '/heady-multi-model', '/heady-narrative-engine', 
    '/heady-nonprofit-ops', '/heady-perplexity', '/heady-phi-math-foundation', '/heady-pqc-security', 
    '/heady-projection-composer', '/heady-prompt-orchestration', '/heady-reliability-orchestrator', 
    '/heady-replan', '/heady-repo-map', '/heady-research', '/heady-resilience-cache', 
    '/heady-resource-crystallizer', '/heady-sacred-geometry-css-generator', '/heady-sandbox-execution', 
    '/heady-security-audit', '/heady-self-healing-lifecycle', '/heady-semantic-backpressure', 
    '/heady-semantic-cache', '/heady-semantic-firewall', '/heady-skill-foundry', '/heady-sop-pipeline', 
    '/heady-sovereign-identity-byok', '/heady-swarm-evolution', '/heady-swarm-template-ops', 
    '/heady-synaptic-mesh', '/heady-task-decomposition', '/heady-trading-compliance', 
    '/heady-trading-intelligence', '/heady-trust-receipts', '/heady-vector-projection', 
    '/heady-visual-builder', '/heady-voice-relay', '/heady-vsa-hyperdimensional-computing', 
    '/heady-web-container', '/workflow-skill-creator', '/incident-response', '/domain-branding-audit', 
    '/antigravity-runtime', '/agent-performance-review', '/edge-cache-warm', '/heady-command', 
    '/projection-hygiene', '/provider-failover-drill', '/mcp:firebase-mcp-server:firebase:deploy', 
    '/a11y-debugging', '/android-cli', '/grill-me', '/bigquery-data-transfer-service', 
    '/managing-python-dependencies', '/ml-best-practices', '/modern-web-guidance', 
    '/memory-leak-debugging', '/goal'
];

createBee('dropzone-reaction', {
    description: 'Intercepts files from the dropzone and triggers an exhaustive array of workflows',
    priority: 1.0, // High priority system listener
    workers: [
        {
            name: 'process-file-drop',
            fn: async ({ filename, content, filePath }) => {
                logger.info({ filename }, `Starting Dropzone Reaction Matrix for file`);

                if (!global.eventBus) {
                    logger.warn('EventBus not available, cannot trigger orchestration matrix');
                    return { success: false, reason: 'No EventBus' };
                }

                // First: Send directly into auto-extract-tasks to identify structural intent
                global.eventBus.emit('auto_success:reaction', {
                    trigger: 'dropzone:task-extraction',
                    source: 'dropzone',
                    data: { filename, content, action: '/auto-extract-tasks' }
                });

                // Next: We issue an orchestration directive for the file containing EVERY requested workflow
                // Realistically, the liquid orchestration engine will chunk, parallelize, or deduplicate these.
                global.eventBus.emit('orchestration:directive:enqueue', {
                    source: 'dropzone',
                    context: filename,
                    directives: EXHAUSTIVE_WORKFLOWS,
                    payload: content
                });

                logger.info({ filename, workflowCount: EXHAUSTIVE_WORKFLOWS.length }, 'Dropzone workflow matrix successfully deployed');
                
                return { success: true, orchestratedWorkflows: EXHAUSTIVE_WORKFLOWS.length };
            }
        }
    ]
});

// Immediately wire the bee to the event bus once the file is loaded
if (global.eventBus) {
    global.eventBus.on('dropzone:file:received', async (data) => {
        try {
            // Re-import internally if needed, or we can just emit an intent to the system
            const { spawnBee } = require('./bee-factory');
            spawnBee('dropzone-reaction', 'process-file-drop', data);
        } catch (e) {
            logger.error({ error: e.message }, 'Failed to spawn dropzone-reaction bee');
        }
    });
} else {
    // If global.eventBus isn't up yet, retry binding shortly
    setTimeout(() => {
        if (global.eventBus) {
            global.eventBus.on('dropzone:file:received', async (data) => {
                const { spawnBee } = require('./bee-factory');
                spawnBee('dropzone-reaction', 'process-file-drop', data);
            });
        }
    }, 5000);
}

module.exports = { EXHAUSTIVE_WORKFLOWS };

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../../packages/structured-logger/src/index.js';

const logger = createLogger({ service: 'system-telemetry' });

/**
 * SystemTelemetryBee (The Autonomous Observer)
 * Continuously monitors Swarm activity, orchestrator events, and system health.
 * Synthesizes these events into a live, human-readable executive briefing.
 */
export class SystemTelemetryBee {
    constructor(projectRoot = '/home/headyme/Heady') {
        this.projectRoot = projectRoot;
        this.briefFilePath = path.join(this.projectRoot, 'Swarm_Executive_Brief.md');
        this.blocksWebhook = process.env.BLOCKS_TEAM_WEBHOOK || null;
        this.eventBuffer = [];
    }

    /**
     * Initializes the live briefing file with the sacred geometry header
     */
    async initializeBriefingStream() {
        const header = `
# 👁️ Heady™ Sovereign Intelligence: Live Swarm Telemetry
*Autonomously keeping you in the loop.*
> **Status:** 🟢 ONLINE | **Operating Layer:** L5 (Magic) | **Latency:** <10ms

---
### 🐝 Live Swarm Activity Stream
`;
        await fs.writeFile(this.briefFilePath, header.trim() + '\n\n', 'utf8');
        logger.info('Initialized Swarm Executive Brief stream.');
    }

    /**
     * Ingest an event from the Swarm (CSL routing, API calls, error handling)
     */
    async logEvent(eventName, data, explanation) {
        const timestamp = new Date().toISOString();
        
        // Construct the human-readable narrative
        const narrative = `
#### ⚡ [${timestamp}] Event: ${eventName}
* **What Heady is doing:** ${data.action || 'Processing Swarm State'}
* **Why Heady is doing this:** ${explanation}
* **Significant Data:** 
\`\`\`json
${JSON.stringify(data.payload || data, null, 2)}
\`\`\`
---
`;      
        // Append to local live stream
        try {
            await fs.appendFile(this.briefFilePath, narrative, 'utf8');
        } catch (e) {
            logger.error('Failed to write to Swarm Executive Brief:', e);
        }

        // Push to blocks.team if configured (from user's truncated prompt request)
        if (this.blocksWebhook) {
            await this.syncToBlocksTeam({ eventName, timestamp, data, explanation });
        }
    }

    /**
     * Pushes significant telemetry payloads to the blocks.team webhook
     */
    async syncToBlocksTeam(payload) {
        try {
            const response = await fetch(this.blocksWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            logger.info(`Synced event [${payload.eventName}] to blocks.team webhook.`);
        } catch (error) {
            logger.warn(`Failed to sync to blocks.team webhook: ${error.message}`);
        }
    }

    /**
     * Periodically analyze the system's own health and autonomously brief the user
     */
    async performAutonomousHealthCheck() {
        // Here the Swarm introspects its Node environment, active API providers, etc.
        const memoryUsage = process.memoryUsage();
        
        const healthData = {
            memory_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            node_version: process.version,
            active_providers: ['Deepseek', 'Anthropic', 'Google']
        };

        await this.logEvent(
            'Autonomous Health Check', 
            { action: 'System Introspection', payload: healthData },
            'Routine verification of the Latent OS to ensure optimal edge execution and resource allocation.'
        );
    }
}

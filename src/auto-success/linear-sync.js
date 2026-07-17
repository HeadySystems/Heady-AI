// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/auto-success/linear-sync.js                           ║
// ║  LAYER: backend/src/auto-success                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { LinearClient } = require("@linear/sdk");
const logger = require("../utils/logger");

/**
 * Synchronize tasks with Linear and return statistics/stale issues.
 */
async function syncLinearIssues() {
    logger.logSystem('linear_sync:started', { message: 'Initiating Linear Sync task' });

    if (!process.env.LINEAR_API_KEY) {
        logger.logSystem('linear_sync:skipped', { message: 'No LINEAR_API_KEY found, skipping sync' });
        return { status: 'skipped', reason: 'Missing API key' };
    }

    try {
        const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
        
        // Fetch the authenticated user
        const me = await client.viewer;
        
        // Fetch issues assigned to me
        const myIssues = await me.assignedIssues();
        
        let staleCount = 0;
        let activeCount = 0;
        const now = Date.now();
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

        const issues = [];
        for (const issue of myIssues.nodes) {
            const updatedAt = new Date(issue.updatedAt).getTime();
            const state = await issue.state;
            
            const isCompleted = ['Done', 'Completed', 'Canceled'].includes(state.name);
            if (!isCompleted) {
                activeCount++;
                if (now - updatedAt > FORTY_EIGHT_HOURS) {
                    staleCount++;
                }
                issues.push({
                    id: issue.id,
                    title: issue.title,
                    state: state.name,
                    stale: (now - updatedAt > FORTY_EIGHT_HOURS)
                });
            }
        }

        const metrics = {
            activeIssues: activeCount,
            staleIssues: staleCount,
            syncTimeMs: Date.now() - now,
            issues
        };

        logger.logSystem('linear_sync:completed', metrics);
        return { status: 'completed', metrics };

    } catch (error) {
        logger.errorSystem('linear_sync:failed', { error: error.message });
        return { status: 'failed', error: error.message };
    }
}

module.exports = {
    syncLinearIssues
};

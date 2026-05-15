/**
 * src/mcp/tools/heady-blocks-sync-tool.js
 * Handler for synchronizing state with blocks.team
 */
'use strict';

const { getSecret, loadAllSecrets, hasSecret } = require('../../shared/secret-manager');

async function handler(args) {
    let webhookUrl = args.webhook_url;
    
    if (!webhookUrl) {
        try {
            // Attempt to load from Secret Manager (GCP or Native fallback)
            if (!hasSecret('BLOCKS_WEBHOOK_URL')) {
                await loadAllSecrets();
            }
            webhookUrl = getSecret('BLOCKS_WEBHOOK_URL');
        } catch (e) {
            // Fallback to direct process.env if Secret Manager is not yet initialized or fails
            webhookUrl = process.env.BLOCKS_WEBHOOK_URL;
        }
    }

    if (!webhookUrl) {
        return {
            success: false,
            message: 'No blocks.team webhook URL provided or configured in environment',
            hint: 'Set BLOCKS_WEBHOOK_URL in .env or GCP Secret Manager'
        };
    }

    const payloadType = args.payload_type || 'health';
    let data = {};

    // Gather data based on payload type
    if (payloadType === 'health') {
        data = {
            system: 'Heady™ Latent OS',
            status: 'operational',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    } else if (payloadType === 'audit') {
        // Integrate with auto-audit tool logic
        try {
            const auditHandler = require('./heady-auto-audit-tool').handler;
            data = await auditHandler({ fix_drift: false });
        } catch (e) {
            data = { error: `Failed to generate audit: ${e.message}` };
        }
    }

    // Send to blocks.team
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: 'heady-mcp-gateway',
                type: payloadType,
                payload: data,
                sentAt: new Date().toISOString()
            })
        });

        return {
            success: response.ok,
            status: response.status,
            message: response.ok ? 'Successfully synchronized with blocks.team' : `Failed to sync: ${response.statusText}`,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return {
            success: false,
            error: e.message,
            message: 'Network error during blocks.team synchronization'
        };
    }
}

module.exports = { handler };

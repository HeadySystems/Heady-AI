/**
 * src/mcp/tools/heady-blocks-sync-tool.js
 * Handler for synchronizing state with blocks.team
 */
'use strict';

async function handler(args) {
    const webhookUrl = args.webhook_url || process.env.BLOCKS_WEBHOOK_URL;
    if (!webhookUrl) {
        return {
            success: false,
            message: 'No blocks.team webhook URL provided or configured in environment',
            hint: 'Set BLOCKS_WEBHOOK_URL in .env'
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

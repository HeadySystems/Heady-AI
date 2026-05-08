/**
 * src/mcp/tools/heady-render-deploy-tool.js
 * Unified handler for triggering Render deployments
 */
'use strict';

const RENDER_API_BASE = 'https://api.render.com/v1';

async function handler(args) {
    const apiKey = process.env.RENDER_API_KEY;
    if (!apiKey) throw new Error('RENDER_API_KEY not configured');

    const { service_id, clear_cache } = args;
    if (!service_id) throw new Error('service_id is required');

    const response = await fetch(`${RENDER_API_BASE}/services/${service_id}/deploys`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clearCache: clear_cache ? 'clear' : 'do_not_clear' })
    });

    if (!response.ok) {
        throw new Error(`Render API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
        success: true,
        deployId: data.id,
        status: data.status,
        serviceId: service_id,
        timestamp: new Date().toISOString()
    };
}

module.exports = { handler };

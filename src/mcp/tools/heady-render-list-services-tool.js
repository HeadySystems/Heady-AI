/**
 * src/mcp/tools/heady-render-list-services-tool.js
 * Unified handler for listing Render services
 */
'use strict';

const RENDER_API_BASE = 'https://api.render.com/v1';

async function handler(args) {
    const apiKey = process.env.RENDER_API_KEY;
    if (!apiKey) throw new Error('RENDER_API_KEY not configured');

    const limit = args.limit || 20;
    const response = await fetch(`${RENDER_API_BASE}/services?limit=${limit}`, {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error(`Render API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const services = data.map(s => ({
        id: s.service.id,
        name: s.service.name,
        type: s.service.type,
        status: s.service.serviceDetails?.suspenders?.status || 'unknown',
        updatedAt: s.service.updatedAt
    }));

    return {
        success: true,
        count: services.length,
        services: services,
        timestamp: new Date().toISOString()
    };
}

module.exports = { handler };

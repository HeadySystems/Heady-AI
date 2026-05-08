/**
 * src/mcp/tools/heady-auto-audit-tool.js
 * Comprehensive system health and configuration audit tool
 */
'use strict';

const fs = require('fs');
const path = require('path');

async function handler(args) {
    const results = {
        timestamp: new Date().toISOString(),
        registry_drift: [],
        connectivity: {},
        recommendations: []
    };

    // 1. Check Registry Drift
    try {
        const registryPath = path.join(process.cwd(), 'heady-registry.json');
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        
        // Audit: mcp-gateway component
        const mcpGateway = (registry.components || []).find(c => c.id === 'mcp-gateway');
        if (!mcpGateway) {
            results.registry_drift.push({
                type: 'MISSING_COMPONENT',
                id: 'mcp-gateway',
                severity: 'critical',
                message: 'mcp-gateway vertical exists but component definition is missing in the main registry'
            });
            
            if (args.fix_drift) {
                // Logic to fix drift would go here
                results.recommendations.push('Run fix-registry automation to add mcp-gateway component');
            }
        }
    } catch (e) {
        results.registry_drift.push({ type: 'ERROR', message: `Registry check failed: ${e.message}` });
    }

    // 2. Check Domain Connectivity (Canonical Domains)
    const domains = [
        'headyme.com',
        'headysystems.com',
        'headyconnection.org',
        'headyio.com'
    ];

    for (const domain of domains) {
        try {
            const start = Date.now();
            const res = await fetch(`https://${domain}/api/pulse`, { timeout: 5000 });
            results.connectivity[domain] = {
                ok: res.ok,
                status: res.status,
                latency: Date.now() - start
            };
        } catch (e) {
            results.connectivity[domain] = { ok: false, error: e.message };
        }
    }

    // 3. Infrastructure Check (Render API)
    const apiKey = process.env.RENDER_API_KEY;
    if (apiKey) {
        try {
            const res = await fetch('https://api.render.com/v1/services?limit=1', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            results.connectivity['render_api'] = { ok: res.ok, status: res.status };
        } catch (e) {
            results.connectivity['render_api'] = { ok: false, error: e.message };
        }
    }

    // Generate summary
    const criticalIssues = results.registry_drift.filter(d => d.severity === 'critical').length;
    const connectivityFailures = Object.values(results.connectivity).filter(c => !c.ok).length;

    results.status = (criticalIssues === 0 && connectivityFailures === 0) ? 'HEALTHY' : 'DEGRADED';
    
    if (criticalIssues > 0) {
        results.recommendations.push('URGENT: Reconcile registry drift for mcp-gateway');
    }
    if (connectivityFailures > 0) {
        results.recommendations.push('Investigate domain connectivity failures in Cloudflare');
    }

    return results;
}

module.exports = { handler };

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ AI Gateway — Cloudflare Edge Worker ═══
 *
 * Single endpoint for ALL Swarm LLM requests.
 * Routes to the cheapest/fastest/available provider dynamically.
 * CostOptimizationBee updates the routing table via KV.
 *
 * Provider routing: Claude → GPT-5.4 → Gemini → Groq → Local Colab
 */

const DEFAULT_ROUTES = {
    'chat': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    'think': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    'fast': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    'code': { provider: 'openai', model: 'gpt-4.1' },
    'research': { provider: 'perplexity', model: 'sonar-pro' },
    'vision': { provider: 'google', model: 'gemini-2.5-pro' },
    'embed': { provider: 'openai', model: 'text-embedding-3-large' },
    'local': { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct' },
};

const PROVIDER_ENDPOINTS = {
    anthropic: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions',
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    perplexity: 'https://api.perplexity.ai/chat/completions',
};

export default {
    async fetch(request, env) {
        if (!isAuthorized(request, env)) {
            return json({ error: 'Unauthorized' }, 401);
        }

        if (request.method !== 'POST') {
            return json({ routes: DEFAULT_ROUTES });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON body' }, 400);
        }
        const intent = body.intent || 'chat';

        // Check for dynamic routing overrides from CostOptimizationBee
        let route;
        try {
            const override = await env.AI_ROUTING_RULES.get(`route:${intent}`, { type: 'json' });
            route = override || DEFAULT_ROUTES[intent] || DEFAULT_ROUTES.chat;
        } catch {
            route = DEFAULT_ROUTES[intent] || DEFAULT_ROUTES.chat;
        }

        // Workers AI (local edge inference)
        if (route.provider === 'workers-ai') {
            const result = await env.WORKERS_AI.run(route.model, {
                messages: body.messages || [{ role: 'user', content: body.prompt || '' }],
            });
            return new Response(JSON.stringify({ provider: 'workers-ai', model: route.model, result }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // External provider proxy
        const endpoint = PROVIDER_ENDPOINTS[route.provider];
        if (!endpoint) {
            return new Response(JSON.stringify({ error: 'Unknown provider' }), { status: 400 });
        }

        const apiKey = await env.AI_ROUTING_RULES.get(`key:${route.provider}`);
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured for ' + route.provider }), { status: 500 });
        }

        // Format request for the target provider
        const providerBody = formatForProvider(route.provider, route.model, body);
        const providerHeaders = getProviderHeaders(route.provider, apiKey);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: providerHeaders,
                body: JSON.stringify(providerBody),
            });

            const result = await response.json();

            // Log usage for cost tracking
            await env.AI_COST_TRACKER.put(`usage:${route.provider}:${Date.now()}`, JSON.stringify({
                provider: route.provider,
                model: route.model,
                intent,
                tokens: result.usage?.total_tokens || 0,
                timestamp: new Date().toISOString(),
            }), { expirationTtl: 86400 });

            return json({
                provider: route.provider,
                model: route.model,
                result,
            });
        } catch (err) {
            // Failover: try next provider
            return new Response(JSON.stringify({ error: err.message, failover: true }), { status: 502 });
        }
    },
};

function isAuthorized(request, env) {
    const configured = env.HEADY_API_KEY;
    if (!configured) return false;
    const value = request.headers.get('Authorization') || '';
    return value === `Bearer ${configured}`;
}

function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function formatForProvider(provider, model, body) {
    const messages = body.messages || [{ role: 'user', content: body.prompt || '' }];
    if (provider === 'anthropic') {
        return { model, max_tokens: body.max_tokens || 4096, messages };
    }
    return { model, messages, max_tokens: body.max_tokens || 4096 };
}

function getProviderHeaders(provider, apiKey) {
    if (provider === 'anthropic') {
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        };
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
}

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Model Discovery Daemon — Query providers for new/updated LLM models.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const ROSTER_FILE = path.join(__dirname, '..', '..', 'data', 'model-roster.json');

const MODEL_FAMILY_TEMPLATES = {
    'gemini-2.5-flash': {
        displayName: 'Gemini 2.5 Flash',
        tier: 'credits',
        costTier: 'economy',
        contextWindow: 1048576,
        outputWindow: 8192,
        inputCostPer1MTokens: 0.075,
        outputCostPer1MTokens: 0.30,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode', 'long-context'],
        strengths: ['speed', 'ultra-long-context', 'multimodal'],
        latencyProfile: 'fast',
    },
    'gemini-2.5-pro': {
        displayName: 'Gemini 2.5 Pro',
        tier: 'quality',
        costTier: 'standard',
        contextWindow: 2097152,
        outputWindow: 8192,
        inputCostPer1MTokens: 1.25,
        outputCostPer1MTokens: 5.00,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode', 'long-context', 'reasoning'],
        strengths: ['complex-reasoning', 'largest-context-window', 'multimodal'],
        latencyProfile: 'medium',
    },
    'gemini-2.0-flash': {
        displayName: 'Gemini 2.0 Flash',
        tier: 'credits',
        costTier: 'economy',
        contextWindow: 1048576,
        outputWindow: 8192,
        inputCostPer1MTokens: 0.075,
        outputCostPer1MTokens: 0.30,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode', 'long-context'],
        strengths: ['speed', 'ultra-long-context', 'multimodal'],
        latencyProfile: 'fast',
    },
    'gemini-1.5-pro': {
        displayName: 'Gemini 1.5 Pro',
        tier: 'quality',
        costTier: 'standard',
        contextWindow: 2097152,
        outputWindow: 8192,
        inputCostPer1MTokens: 1.25,
        outputCostPer1MTokens: 5.00,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode', 'long-context'],
        strengths: ['largest-context-window', 'multimodal'],
        latencyProfile: 'medium',
    },
    'llama-3.3-70b': {
        displayName: 'Llama 3.3 70B',
        tier: 'speed',
        costTier: 'economy',
        contextWindow: 128000,
        outputWindow: 8192,
        inputCostPer1MTokens: 0.59,
        outputCostPer1MTokens: 0.79,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'streaming', 'json-mode'],
        strengths: ['ultra-fast-inference', 'open-weights', 'cost-efficiency'],
        latencyProfile: 'ultra-fast',
    },
    'llama-3.1-70b': {
        displayName: 'Llama 3.1 70B',
        tier: 'speed',
        costTier: 'economy',
        contextWindow: 128000,
        outputWindow: 8192,
        inputCostPer1MTokens: 0.59,
        outputCostPer1MTokens: 0.79,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'streaming', 'json-mode'],
        strengths: ['ultra-fast-inference', 'open-weights', 'cost-efficiency'],
        latencyProfile: 'ultra-fast',
    },
    'llama-3.1-8b': {
        displayName: 'Llama 3.1 8B',
        tier: 'speed',
        costTier: 'free',
        contextWindow: 128000,
        outputWindow: 8192,
        inputCostPer1MTokens: 0.05,
        outputCostPer1MTokens: 0.08,
        capabilities: ['text-generation', 'code-generation', 'streaming', 'json-mode'],
        strengths: ['ultra-fast-inference', 'cost-free-tier'],
        latencyProfile: 'ultra-fast',
    },
    'gpt-4o': {
        displayName: 'GPT-4o',
        tier: 'quality',
        costTier: 'standard',
        contextWindow: 128000,
        outputWindow: 16384,
        inputCostPer1MTokens: 2.50,
        outputCostPer1MTokens: 10.00,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode'],
        strengths: ['coding', 'multimodal', 'instruction-following'],
        latencyProfile: 'medium',
    },
    'gpt-4o-mini': {
        displayName: 'GPT-4o Mini',
        tier: 'fast',
        costTier: 'economy',
        contextWindow: 128000,
        outputWindow: 16384,
        inputCostPer1MTokens: 0.15,
        outputCostPer1MTokens: 0.60,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode'],
        strengths: ['cost-efficiency', 'speed', 'simple-tasks'],
        latencyProfile: 'fast',
    },
    'claude-3-5-sonnet': {
        displayName: 'Claude 3.5 Sonnet',
        tier: 'quality',
        costTier: 'standard',
        contextWindow: 200000,
        outputWindow: 8192,
        inputCostPer1MTokens: 3.00,
        outputCostPer1MTokens: 15.00,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'vision', 'streaming', 'json-mode'],
        strengths: ['coding', 'reasoning', 'instruction-following', 'vision'],
        latencyProfile: 'medium',
    },
    'claude-3-5-haiku': {
        displayName: 'Claude 3.5 Haiku',
        tier: 'fast',
        costTier: 'standard',
        contextWindow: 200000,
        outputWindow: 8192,
        inputCostPer1MTokens: 1.00,
        outputCostPer1MTokens: 5.00,
        capabilities: ['text-generation', 'code-generation', 'function-calling', 'streaming', 'json-mode'],
        strengths: ['speed', 'instruction-following', 'chat'],
        latencyProfile: 'fast',
    }
};

const ANTHROPIC_PROBE_MODELS = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
];

class DynamicModelRegistry {
    constructor() {
        this.roster = { models: {}, lastScan: null };
        this.loadRoster();
    }

    loadRoster() {
        try {
            if (fs.existsSync(ROSTER_FILE)) {
                this.roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
            }
        } catch (e) {
            logger.error('[DynamicModelRegistry] Failed to load roster file', { error: e.message });
        }
    }

    saveRoster() {
        try {
            const dir = path.dirname(ROSTER_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(ROSTER_FILE, JSON.stringify(this.roster, null, 2));
            logger.info('[DynamicModelRegistry] Saved active model roster cache', { count: Object.keys(this.roster.models).length });
        } catch (e) {
            logger.error('[DynamicModelRegistry] Failed to save roster file', { error: e.message });
        }
    }

    classifyModel(modelId, provider) {
        const idLower = modelId.toLowerCase();
        let matchedTemplate = null;
        let bestMatchLen = 0;

        for (const [key, template] of Object.entries(MODEL_FAMILY_TEMPLATES)) {
            if (idLower.includes(key) && key.length > bestMatchLen) {
                matchedTemplate = template;
                bestMatchLen = key.length;
            }
        }

        if (matchedTemplate) {
            return {
                id: modelId,
                displayName: matchedTemplate.displayName + ` (${modelId.replace(provider + '/', '')})`,
                provider: provider,
                tier: matchedTemplate.tier,
                costTier: matchedTemplate.costTier,
                contextWindow: matchedTemplate.contextWindow,
                outputWindow: matchedTemplate.outputWindow,
                inputCostPer1MTokens: matchedTemplate.inputCostPer1MTokens,
                outputCostPer1MTokens: matchedTemplate.outputCostPer1MTokens,
                capabilities: [...matchedTemplate.capabilities],
                strengths: [...matchedTemplate.strengths],
                latencyProfile: matchedTemplate.latencyProfile,
                elo: this.roster.models[modelId]?.elo || 1000,
                available: true,
                discoveredAt: this.roster.models[modelId]?.discoveredAt || new Date().toISOString(),
            };
        }

        let guessedTier = 'fast';
        let guessedCostTier = 'economy';
        const guessedContext = 128000;
        let guessedLatency = 'medium';
        const guessedCaps = ['text-generation', 'streaming'];

        if (idLower.includes('pro') || idLower.includes('large') || idLower.includes('70b') || idLower.includes('opus')) {
            guessedTier = 'quality';
            guessedCostTier = 'standard';
            guessedLatency = 'medium';
        }
        if (idLower.includes('flash') || idLower.includes('mini') || idLower.includes('8b') || idLower.includes('haiku')) {
            guessedTier = 'fast';
            guessedCostTier = 'economy';
            guessedLatency = 'fast';
        }
        if (idLower.includes('vision') || idLower.includes('multimodal')) {
            guessedCaps.push('vision');
        }
        if (idLower.includes('fc') || idLower.includes('instruct') || idLower.includes('code')) {
            guessedCaps.push('function-calling', 'code-generation');
        }

        return {
            id: modelId,
            displayName: modelId,
            provider: provider,
            tier: guessedTier,
            costTier: guessedCostTier,
            contextWindow: guessedContext,
            outputWindow: 4096,
            inputCostPer1MTokens: guessedCostTier === 'economy' ? 0.20 : 2.50,
            outputCostPer1MTokens: guessedCostTier === 'economy' ? 0.80 : 10.00,
            capabilities: guessedCaps,
            strengths: ['general-purpose'],
            latencyProfile: guessedLatency,
            elo: this.roster.models[modelId]?.elo || 1000,
            available: true,
            discoveredAt: this.roster.models[modelId]?.discoveredAt || new Date().toISOString(),
        };
    }

    async scan() {
        logger.info('[DynamicModelRegistry] Starting dynamic model discovery scan...');
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

        const foundModels = {};
        const activeProviders = new Set();

        // 1. Google Gemini Scan
        if (GOOGLE_API_KEY) {
            try {
                activeProviders.add('google');
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.models) {
                        for (const m of data.models) {
                            const modelId = m.name.replace('models/', '');
                            foundModels[modelId] = this.classifyModel(modelId, 'google');
                        }
                    }
                }
            } catch (e) {
                logger.error('[DynamicModelRegistry] Google Gemini scan failed', { error: e.message });
            }
        }

        // 2. OpenAI Scan
        if (OPENAI_API_KEY) {
            try {
                activeProviders.add('openai');
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        for (const m of data.data) {
                            // Filter for standard GPT models
                            if (m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3')) {
                                foundModels[m.id] = this.classifyModel(m.id, 'openai');
                            }
                        }
                    }
                }
            } catch (e) {
                logger.error('[DynamicModelRegistry] OpenAI scan failed', { error: e.message });
            }
        }

        // 3. Groq Scan
        if (GROQ_API_KEY) {
            try {
                activeProviders.add('groq');
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        for (const m of data.data) {
                            foundModels[m.id] = this.classifyModel(m.id, 'groq');
                        }
                    }
                }
            } catch (e) {
                logger.error('[DynamicModelRegistry] Groq scan failed', { error: e.message });
            }
        }

        // 4. Anthropic Probe
        if (ANTHROPIC_API_KEY) {
            activeProviders.add('anthropic');
            for (const modelId of ANTHROPIC_PROBE_MODELS) {
                try {
                    // Send a lightweight probe check (max_tokens = 1)
                    const res = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'x-api-key': ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: modelId,
                            max_tokens: 1,
                            messages: [{ role: 'user', content: 'probe' }],
                        }),
                    });
                    if (res.status === 200 || res.status === 400) {
                        const data = await res.json().catch(() => ({}));
                        if (res.status === 200 || (data.error && data.error.type !== 'not_found_error')) {
                            foundModels[modelId] = this.classifyModel(modelId, 'anthropic');
                        }
                    }
                } catch (e) {
                    // Skip
                }
            }
        }

        // 5. LiteLLM Proxy Scan — opt-in, cloud address only. Skipped when unset
        // rather than probing a loopback port that cannot exist in a deployment.
        try {
            const proxyUrl = process.env.HEADY_LITELLM_PROXY_URL;
            const res = proxyUrl ? await fetch(`${proxyUrl}/v1/models`).catch(() => null) : null;
            if (res && res.ok) {
                const data = await res.json();
                if (data.data) {
                    for (const m of data.data) {
                        // Classify models on proxy
                        const provider = m.id.includes('gemini') ? 'google' : m.id.includes('claude') ? 'anthropic' : m.id.includes('groq') ? 'groq' : 'openai';
                        foundModels[m.id] = this.classifyModel(m.id, provider);
                    }
                }
            }
        } catch (e) {
            // Normal fallback
        }

        // 6. Merge with existing roster and adjust availability flags
        const updatedModels = {};
        for (const [id, m] of Object.entries(foundModels)) {
            updatedModels[id] = m;
        }

        // Handle existing roster models
        for (const [id, m] of Object.entries(this.roster.models)) {
            if (!foundModels[id]) {
                if (activeProviders.has(m.provider)) {
                    updatedModels[id] = { ...m, available: false };
                } else {
                    updatedModels[id] = m;
                }
            }
        }

        this.roster.models = updatedModels;
        this.roster.lastScan = new Date().toISOString();
        this.saveRoster();

        return Object.values(updatedModels);
    }

    getRoster() {
        return this.roster;
    }
}

module.exports = new DynamicModelRegistry();

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
// ║  FILE: orchestration/edge-adapter.js                              ║
// ║  LAYER: orchestration                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/* ═══════════════════════════════════════════════════════════════════════
   Cloudflare Workers Edge LLM Adapter
   
   High-performance, edge-routing adapter enabling Heady's swarm to route
   cognition to Cloudflare Workers AI and manage proxying and bus tasks.
   ═══════════════════════════════════════════════════════════════════════ */

const crypto = require("crypto");

class EdgeAdapter {
    constructor(config = {}) {
        this.apiToken = config.apiToken || process.env.CLOUDFLARE_API_TOKEN;
        this.accountId = config.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
        this.gatewayUrl = config.gatewayUrl || process.env.CLOUDFLARE_AI_GATEWAY || "https://gateway.ai.cloudflare.com/v1";
        this.defaultModel = config.defaultModel || "@cf/meta/llama-3-8b-instruct";
        this.cache = new Map(); // local high-speed cache
        this.cacheTTL = config.cacheTTL || 300000; // 5 minute default cache TTL
        this.busEndpoint = config.busEndpoint || process.env.HEADY_BUS_ENDPOINT;
    }

    /**
     * Helper to generate a MD5 hash for cache keys
     */
    _hashPayload(payload) {
        return crypto.createHash("md5").update(JSON.stringify(payload)).digest("hex");
    }

    /**
     * Validate adapter readiness
     */
    isConfigured() {
        return !!(this.apiToken && this.accountId);
    }

    /**
     * Smart Routing Mode
     * Routes low-latency and administrative tasks directly to Edge Workers AI
     */
    async routeToEdge(prompt, options = {}) {
        if (!this.isConfigured()) {
            console.warn("[EdgeAdapter] Warning: Cloudflare credentials not set. Falling back to local/default simulation.");
            return this._simulateEdgeResponse(prompt, options);
        }

        const model = options.model || this.defaultModel;
        const temperature = options.temperature ?? 0.6;
        const maxTokens = options.maxTokens || 1024;
        const systemPrompt = options.system || "You are an edge-native cognitive helper.";

        const cacheKey = this._hashPayload({ prompt, model, systemPrompt, temperature });
        if (options.useCache !== false && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log(`[EdgeAdapter] Cache HIT for key: ${cacheKey}`);
                return cached.data;
            }
        }

        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
        const headers = {
            "Authorization": `Bearer ${this.apiToken}`,
            "Content-Type": "application/json"
        };

        const body = {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature,
            max_tokens: maxTokens
        };

        try {
            console.log(`[EdgeAdapter] Executing Edge AI on model: ${model} (Routing Mode)`);
            const start = Date.now();
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                throw new Error(`Cloudflare Workers AI returned status ${res.status}: ${await res.text()}`);
            }

            const json = await res.json();
            const latency = Date.now() - start;

            if (!json.success) {
                throw new Error(`Cloudflare Workers AI request failed: ${JSON.stringify(json.errors)}`);
            }

            const result = {
                content: json.result.response || json.result.text || "",
                model,
                provider: "cloudflare-edge",
                latencyMs: latency,
                success: true
            };

            this.cache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;

        } catch (err) {
            console.error("[EdgeAdapter] Edge Routing Error:", err);
            if (options.fallbackToSim) {
                return this._simulateEdgeResponse(prompt, options);
            }
            throw err;
        }
    }

    /**
     * Proxy Mode
     * Intercepts, caches, and routes outbound requests securely through AI Gateway
     */
    async proxyRequest(provider, model, payload, options = {}) {
        console.log(`[EdgeAdapter] Proxying request to ${provider}/${model} via Cloudflare AI Gateway`);
        
        if (!this.accountId || !options.gatewayName) {
            console.warn("[EdgeAdapter] Gateway Name or Account ID missing, running non-gateway direct request.");
            return this._directProviderRequest(provider, model, payload);
        }

        // Structure URL using Cloudflare AI Gateway format
        // https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/GATEWAY_NAME/PROVIDER/endpoint
        const gatewayPath = `${this.gatewayUrl}/${this.accountId}/${options.gatewayName}/${provider}`;
        let endpoint = "";

        if (provider === "openai") {
            endpoint = `${gatewayPath}/chat/completions`;
        } else if (provider === "anthropic") {
            endpoint = `${gatewayPath}/v1/messages`;
        } else {
            endpoint = `${gatewayPath}/completions`;
        }

        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (this.apiToken) {
            headers["cf-shared-auth"] = this.apiToken; // Custom header if CF Worker needs it
        }

        try {
            const start = Date.now();
            const res = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`AI Gateway Proxy returned ${res.status}: ${await res.text()}`);
            }

            const data = await res.json();
            const latency = Date.now() - start;

            return {
                ok: true,
                data,
                latencyMs: latency,
                gatewayUsed: true
            };

        } catch (err) {
            console.error("[EdgeAdapter] Gateway Proxying Failed, falling back to direct endpoint.", err);
            return this._directProviderRequest(provider, model, payload, options.headers);
        }
    }

    /**
     * Bus Mode
     * Generates a standardized message payload for lightweight Edge-Native Swarms
     * listening on the Heady message bus.
     */
    generateBusPayload(stage, stageData, swarmId) {
        console.log(`[EdgeAdapter] Packing payload for Edge-Native Swarm Bus [${swarmId}] at stage [${stage}]`);
        return {
            id: `msg-${crypto.randomUUID()}`,
            timestamp: Date.now(),
            stage,
            swarmId,
            routingStrategy: "edge-native",
            payload: {
                prompt: stageData.prompt || "",
                context: stageData.context || {},
                schema: stageData.schema || null
            },
            signatures: {
                aggregator: "heady-edge-adapter-v1"
            }
        };
    }

    /**
     * Dispatch event over Heady's event-bus to Cloudflare Workers Edge Native swarms
     */
    async dispatchToBus(payload, endpoint = this.busEndpoint) {
        if (!endpoint) {
            console.log("[EdgeAdapter] Simulation Mode: Event bus endpoint not set. Event payload output:", JSON.stringify(payload, null, 2));
            return { ok: true, status: "simulated-dispatch" };
        }

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            return {
                ok: res.ok,
                status: res.statusText,
                code: res.status
            };
        } catch (err) {
            console.error("[EdgeAdapter] Event-Bus dispatch failed:", err);
            return { ok: false, error: String(err) };
        }
    }

    /**
     * Direct request fallback if gateway fails
     */
    async _directProviderRequest(provider, model, payload, customHeaders = {}) {
        let url = "";
        const headers = { "Content-Type": "application/json", ...customHeaders };

        if (provider === "openai") {
            url = "https://api.openai.com/v1/chat/completions";
        } else if (provider === "anthropic") {
            url = "https://api.anthropic.com/v1/messages";
        } else {
            throw new Error(`Direct provider requested for unsupported provider: ${provider}`);
        }

        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Direct endpoint fallback returned ${res.status}: ${await res.text()}`);
        }

        return {
            ok: true,
            data: await res.json(),
            directFallback: true
        };
    }

    /**
     * Simulations for non-credentialed local workflows
     */
    _simulateEdgeResponse(prompt, options) {
        const latency = 120 + Math.floor(Math.random() * 80);
        console.log(`[EdgeAdapter] Simulating high-speed Cloudflare Worker LLM completion (latency: ${latency}ms)`);
        
        const completions = {
            "analyze": `[Edge-Simulated Analysis] Context received: "${prompt.slice(0, 100)}...". Core semantic entities parsed. High-speed classification mapping is complete. Recommendation: ROUTE_TO_STAGE_6.`,
            "summarize": `[Edge-Simulated Summary] Summarized administrative inputs efficiently via edge-native model. Output is stored in memory. Status: OPERATIONAL.`,
            "default": `[Edge-Simulated Completion] Processing request of length ${prompt.length} at edge node successfully. Target model: ${options.model || this.defaultModel}.`
        };

        const type = prompt.toLowerCase().includes("analyze") ? "analyze" : 
                     (prompt.toLowerCase().includes("summarize") ? "summarize" : "default");

        return {
            content: completions[type],
            model: options.model || this.defaultModel,
            provider: "cloudflare-edge-simulated",
            latencyMs: latency,
            success: true
        };
    }
}

module.exports = EdgeAdapter;

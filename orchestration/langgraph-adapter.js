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
// ║  FILE: orchestration/langgraph-adapter.js                        ║
// ║  LAYER: orchestration                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/* ═══════════════════════════════════════════════════════════════════════
   LangGraph Adapter — State-Graph Orchestration Engine
   
   A dual-mode orchestration adapter that supports:
     1. Local Stateful Cyclic State-Graphs (pure JS nodes, edges, conditional routers).
     2. Remote Microservice routing mapping contexts to Python LangGraph API.
   ═══════════════════════════════════════════════════════════════════════ */

const crypto = require("crypto");

class LangGraphAdapter {
    constructor(config = {}) {
        this.remoteEndpoint = config.remoteEndpoint || process.env.LANGGRAPH_API_ENDPOINT;
        this.remoteAuthToken = config.authToken || process.env.LANGGRAPH_API_KEY;
        this.nodes = new Map();
        this.edges = new Map(); // maps: fromNode -> toNode
        this.conditionalEdges = new Map(); // maps: fromNode -> { routerFn, pathMap }
        this.entryPoint = null;
        this.compiled = false;
        this.maxIterations = config.maxIterations || 20;
    }

    /* ─── LOCAL STATE-GRAPH DEFINITION API ────────────────────────────── */

    /**
     * Add a node containing logic/agent
     * nodeFn should be an async function: (state) => Promise<PartialState>
     */
    addNode(name, nodeFn) {
        if (typeof nodeFn !== "function") {
            throw new Error(`Node [${name}] must be associated with an executable function`);
        }
        this.nodes.set(name, nodeFn);
        this.compiled = false;
        return this;
    }

    /**
     * Add a static directed edge from one node to another
     */
    addEdge(fromNode, toNode) {
        this.edges.set(fromNode, toNode);
        this.compiled = false;
        return this;
    }

    /**
     * Add a conditional edge
     * routerFn is a function: (state) => string (returning result key)
     * pathMap is a mapping of result key -> target node name
     */
    addConditionalEdge(fromNode, routerFn, pathMap = {}) {
        if (typeof routerFn !== "function") {
            throw new Error(`Conditional edge router function from [${fromNode}] must be a function`);
        }
        this.conditionalEdges.set(fromNode, { routerFn, pathMap });
        this.compiled = false;
        return this;
    }

    /**
     * Set entry node name
     */
    setEntryPoint(name) {
        this.entryPoint = name;
        this.compiled = false;
        return this;
    }

    /**
     * Compile and validate the state-graph
     */
    compile() {
        if (this.nodes.size === 0) {
            throw new Error("Cannot compile empty graph. Register nodes first.");
        }
        if (!this.entryPoint || !this.nodes.has(this.entryPoint)) {
            throw new Error(`Invalid entry point: ${this.entryPoint}`);
        }

        // Validate edges
        for (const [fromNode, toNode] of this.edges.entries()) {
            if (!this.nodes.has(fromNode)) throw new Error(`Edge source [${fromNode}] does not exist in graph.`);
            if (toNode !== "END" && !this.nodes.has(toNode)) throw new Error(`Edge target [${toNode}] does not exist in graph.`);
        }

        // Validate conditional edges
        for (const [fromNode, cond] of this.conditionalEdges.entries()) {
            if (!this.nodes.has(fromNode)) throw new Error(`Conditional Edge source [${fromNode}] does not exist.`);
            for (const [key, target] of Object.entries(cond.pathMap)) {
                if (target !== "END" && !this.nodes.has(target)) {
                    throw new Error(`Conditional path target [${target}] for router value [${key}] does not exist.`);
                }
            }
        }

        this.compiled = true;
        console.log(`[LangGraphAdapter] Compiled successfully. Registered nodes: [${Array.from(this.nodes.keys()).join(", ")}]`);
        return this;
    }

    /**
     * Run compiled graph locally
     */
    async runLocal(initialState = {}) {
        if (!this.compiled) this.compile();

        console.log("[LangGraphAdapter] Starting Local State-Graph Run loop");
        
        let state = { ...initialState, __metadata: { steps: [], runId: `lg-run-${crypto.randomUUID()}` } };
        let currentNode = this.entryPoint;
        let iteration = 0;

        while (currentNode && currentNode !== "END" && iteration < this.maxIterations) {
            iteration++;
            console.log(`\x1b[36m[LangGraph Trace] Step #${iteration}: Node \x1b[1m[${currentNode}]\x1b[0m`);
            
            const nodeFn = this.nodes.get(currentNode);
            const start = Date.now();
            
            // Execute node action and retrieve state modifications
            let update = {};
            try {
                update = await nodeFn(state);
            } catch (err) {
                console.error(`[LangGraphAdapter] Error executing node [${currentNode}]:`, err);
                state.__metadata.steps.push({ node: currentNode, success: false, error: String(err), timestamp: Date.now() });
                throw err;
            }

            const latency = Date.now() - start;

            // Merge update into state
            state = {
                ...state,
                ...update,
                __metadata: {
                    ...state.__metadata,
                    steps: [
                        ...state.__metadata.steps,
                        { node: currentNode, latencyMs: latency, success: true, timestamp: Date.now() }
                    ]
                }
            };

            // Calculate transition edge
            let nextNode = null;
            if (this.edges.has(currentNode)) {
                nextNode = this.edges.get(currentNode);
            } else if (this.conditionalEdges.has(currentNode)) {
                const cond = this.conditionalEdges.get(currentNode);
                const result = await cond.routerFn(state);
                nextNode = cond.pathMap[result] || null;
                console.log(`[LangGraph Trace] Conditional Route evaluated [${result}] -> target: [${nextNode}]`);
            }

            currentNode = nextNode;
        }

        if (iteration >= this.maxIterations) {
            console.warn(`[LangGraphAdapter] State-Graph terminated due to iteration limit (${this.maxIterations})`);
        }

        console.log(`[LangGraphAdapter] Execution finished in ${iteration} steps.`);
        return state;
    }

    /* ─── REMOTE STATE-GRAPH CLIENT API ───────────────────────────────── */

    /**
     * Run State-Graph remotely on LangServe/LangGraph deployment
     */
    async runRemote(state = {}, options = {}) {
        const endpoint = options.endpoint || this.remoteEndpoint;
        if (!endpoint) {
            console.warn("[LangGraphAdapter] No remote endpoint configured. Falling back to local state execution mock.");
            return this._simulateRemoteGraphRun(state, options);
        }

        console.log(`[LangGraphAdapter] Dispatching state computation to remote LangGraph at: ${endpoint}`);
        const headers = {
            "Content-Type": "application/json",
        };

        if (this.remoteAuthToken) {
            headers["Authorization"] = `Bearer ${this.remoteAuthToken}`;
        }

        try {
            const start = Date.now();
            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    input: state,
                    config: {
                        configurable: { thread_id: options.threadId || crypto.randomUUID() }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Remote LangGraph deployment returned HTTP ${response.status}: ${await response.text()}`);
            }

            const resJson = await response.json();
            const latency = Date.now() - start;

            console.log(`[LangGraphAdapter] Remote execution finished in ${latency}ms.`);
            return {
                ...resJson.output,
                __remoteMetadata: {
                    latencyMs: latency,
                    statusCode: response.status,
                    provider: "remote-langgraph"
                }
            };

        } catch (err) {
            console.error("[LangGraphAdapter] Remote LangGraph request failed:", err);
            if (options.fallbackToLocal) {
                console.log("[LangGraphAdapter] Falling back to local/simulated compilation.");
                return this._simulateRemoteGraphRun(state, options);
            }
            throw err;
        }
    }

    /**
     * Mocks remote Graph execution for non-credentialed local dry runs
     */
    _simulateRemoteGraphRun(state, options) {
        const latency = 450 + Math.floor(Math.random() * 200);
        console.log(`[LangGraphAdapter] Simulating remote cyclic graph calculation (latency: ${latency}ms)`);
        
        const outputs = {
            ...state,
            socraticOutput: `[Remote LangGraph Simulated Compilation] State successfully computed through 4 cyclic nodes. Analysis completed. Core optimization score matches Golden Ratio standard.`,
            isOptimal: true,
            cyclesCount: 3,
            __remoteMetadata: {
                latencyMs: latency,
                provider: "remote-langgraph-simulated"
            }
        };

        return outputs;
    }
}

module.exports = LangGraphAdapter;

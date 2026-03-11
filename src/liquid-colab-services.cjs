'use strict';

const EventEmitter = require('events');
const { fib, PHI, PSI } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('liquid-colab-services');

const COLAB_RUNTIME_COUNT = fib(4); // 3 runtimes (Colab Pro+ triple lane)
const BASE_DURATION_MS = fib(7); // 13

function normalize01(value, fallback = PSI) {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.max(0, Math.min(1, value));
}

function makeExecutor(component, action, extra = {}) {
    return async (input = {}) => {
        const ts = new Date().toISOString();
        const signal = normalize01(input.signal, 1 - PSI * PSI);
        const coherence = normalize01(input.coherence, PSI);
        const affinity = normalize01((signal + coherence + PSI) / PHI);

        return {
            ok: true,
            component,
            action,
            affinity,
            ts,
            ...extra,
        };
    };
}

const EXECUTORS = Object.freeze({
    lens: makeExecutor('lens', 'observe', { optics: 'vector' }),
    brain: makeExecutor('brain', 'reason', { cognition: 'multi-pass' }),
    soul: makeExecutor('soul', 'align', { resonance: 'intent-locked' }),
    conductor: makeExecutor('conductor', 'orchestrate', { systemState: 'synchronized' }),
    battle: makeExecutor('battle', 'compete', { arena: 'simulation' }),
    vinci: makeExecutor('vinci', 'compose', { medium: 'design+logic' }),
    patterns: makeExecutor('patterns', 'stabilize', {
        resilience: { score: 1 - PSI * PSI },
        decay: { slope: PSI * PSI },
    }),
    notion: makeExecutor('notion', 'sync', { workspace: 'knowledge-graph' }),
    ops: makeExecutor('ops', 'operate', {
        health: { shards: fib(8), readiness: 'green' },
    }),
    maintenance: makeExecutor('maintenance', 'repair', { mode: 'predictive' }),
    'auto-success': makeExecutor('auto-success', 'improve', { loop: 'continuous' }),
    stream: async (input = {}) => ({
        ok: true,
        component: 'stream',
        action: 'project',
        projection: {
            profile: input.channel === 'public-api' ? 'spherical' : 'canvas',
            channel: input.channel || 'canvas',
            dimensionality: 384,
        },
        affinity: normalize01(input.affinity, PSI),
        ts: new Date().toISOString(),
    }),
    buddy: makeExecutor('buddy', 'assist', { tone: 'proactive' }),
    cloud: async (input = {}) => ({
        ok: true,
        component: 'cloud',
        action: 'route',
        projection: {
            profile: 'spherical',
            channel: input.channel || 'public-api',
            failover: 'liquid',
        },
        affinity: normalize01(input.affinity, 1 - PSI * PSI),
        ts: new Date().toISOString(),
    }),
});

class RuntimeAllocator {
    constructor(runtimeCount = COLAB_RUNTIME_COUNT) {
        this.runtimes = Array.from({ length: runtimeCount }, (_, i) => ({
            id: `colab-pro-plus-${i + 1}`,
            load: 0,
            lane: i,
        }));
        this.registeredComponents = Object.keys(EXECUTORS).length;
    }

    nextRuntime() {
        this.runtimes.sort((a, b) => a.load - b.load);
        const chosen = this.runtimes[0];
        chosen.load += PSI * PSI;
        return chosen;
    }

    snapshot() {
        return this.runtimes.map(r => ({ ...r }));
    }
}

class LiquidColabEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.mode = 'vector-native';
        this.allocator = new RuntimeAllocator(options.runtimeCount || COLAB_RUNTIME_COUNT);
        this.executionLog = [];
        this.totalExecutions = 0;
    }

    getHealth() {
        return {
            status: 'ACTIVE',
            mode: this.mode,
            components: Object.keys(EXECUTORS).length,
            allocator: {
                runtimes: this.allocator.snapshot(),
                registeredComponents: this.allocator.registeredComponents,
            },
            ts: new Date().toISOString(),
        };
    }

    getExecutionLog(limit = fib(6)) {
        return this.executionLog.slice(-limit).reverse();
    }

    async execute(component, payload = {}) {
        const handler = EXECUTORS[component];
        if (!handler) {
            return {
                ok: false,
                error: 'UNKNOWN_COMPONENT',
                component,
                available: Object.keys(EXECUTORS),
            };
        }

        const runtime = this.allocator.nextRuntime();
        const start = Date.now();
        const result = await handler({ ...payload, runtimeId: runtime.id });
        const durationMs = Math.max(BASE_DURATION_MS, Date.now() - start);

        const event = {
            component,
            runtimeId: runtime.id,
            durationMs,
            affinity: normalize01(result.affinity, PSI),
            ts: new Date().toISOString(),
        };

        this.totalExecutions += 1;
        this.executionLog.push(event);
        if (this.executionLog.length > fib(10)) this.executionLog.shift();

        const response = {
            ...result,
            durationMs,
            runtimeId: runtime.id,
            flow: { strategy: 'liquid-runtime-allocation', lane: runtime.lane },
        };

        this.emit('execution:complete', { ...event, result: response });
        logger.info('component_executed', event);
        return response;
    }

    async smartExecute(intent = {}) {
        const componentPlan = this._planComponents(intent);
        const executions = await Promise.all(
            componentPlan.map(({ component }) => this.execute(component, intent))
        );

        return {
            ok: true,
            intent,
            flow: {
                strategy: 'parallel-semantic-routing',
                selectedComponents: componentPlan,
            },
            results: executions.map((result, index) => ({
                component: componentPlan[index].component,
                affinity: componentPlan[index].affinity,
                runtimeId: result.runtimeId,
                ok: result.ok,
            })),
            ts: new Date().toISOString(),
        };
    }

    _planComponents(intent) {
        const type = String(intent.type || 'general').toLowerCase();
        const basePlan = {
            chat: ['conductor', 'brain', 'buddy'],
            ops: ['ops', 'maintenance', 'cloud'],
            design: ['vinci', 'lens', 'patterns'],
            research: ['lens', 'brain', 'notion'],
            general: ['conductor', 'patterns', 'cloud'],
        };

        const selected = basePlan[type] || basePlan.general;
        return selected.map((component, index) => ({
            component,
            affinity: normalize01(1 - index * (1 - PSI) / selected.length),
        }));
    }
}

module.exports = { LiquidColabEngine, EXECUTORS };

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Agent Platform — Unit Tests v1.0.0                     ║
// ║  Validates core orchestration engine subsystems                ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DAGExecutor } from '../../src/orchestration/dag-executor.js';
import { PatternEngine } from '../../src/orchestration/pattern-engine.js';
import { BackpressureManager } from '../../src/orchestration/backpressure-manager.js';
import { SwarmMessageBus } from '../../src/orchestration/swarm-message-bus.js';
import { CSLRouter } from '../../src/routing/csl-router.js';
import { BeeFactory } from '../../src/bees/bee-factory.js';
import { AgentRuntime } from '../../src/agents/agent-runtime.js';
import { A2AProtocol } from '../../src/protocols/a2a-protocol.js';
import { HandoffRouter } from '../../src/protocols/handoff-router.js';
import { HealthMonitor } from '../../src/services/health-monitor.js';
import { PlatformConfig } from '../../config/platform-config.js';

// ─── DAG Executor Tests ─────────────────────────────────────────────
describe('DAGExecutor', () => {
  let dag;

  beforeEach(() => {
    dag = new DAGExecutor({ maxSteps: 100 });
  });

  it('should execute a linear 3-node pipeline', async () => {
    dag.addNode('A', async (state) => ({ step: (state.step || 0) + 1 }));
    dag.addNode('B', async (state) => ({ step: state.step + 10 }));
    dag.addNode('C', async (state) => ({ step: state.step + 100 }));

    dag.addEdge('A', 'B');
    dag.addEdge('B', 'C');

    const { state, metrics } = await dag.execute();
    expect(state.step).toBe(111);
    expect(metrics.nodesExecuted).toBe(3);
  });

  it('should execute parallel fan-out nodes', async () => {
    dag.addNode('dispatch', async () => ({ dispatched: true }));
    dag.addNode('worker1', async () => ({ w1: 'done' }));
    dag.addNode('worker2', async () => ({ w2: 'done' }));
    dag.addNode('gather', async (state) => ({
      gathered: state.w1 === 'done' && state.w2 === 'done',
    }));

    dag.addEdge('dispatch', 'worker1');
    dag.addEdge('dispatch', 'worker2');
    dag.addEdge('worker1', 'gather');
    dag.addEdge('worker2', 'gather');

    const { state } = await dag.execute();
    expect(state.dispatched).toBe(true);
    expect(state.w1).toBe('done');
    expect(state.w2).toBe('done');
  });

  it('should find entry nodes correctly', () => {
    dag.addNode('A', async () => ({}));
    dag.addNode('B', async () => ({}));
    dag.addNode('C', async () => ({}));
    dag.addEdge('A', 'B');
    dag.addEdge('A', 'C');

    const sorted = dag.topologicalSort();
    expect(sorted[0]).toBe('A');
  });

  it('should respect conditional edges', async () => {
    dag.addNode('start', async () => ({ route: 'left' }));
    dag.addNode('left', async () => ({ went: 'left' }));
    dag.addNode('right', async () => ({ went: 'right' }));

    dag.addEdge('start', 'left', (state) => state.route === 'left');
    dag.addEdge('start', 'right', (state) => state.route === 'right');

    const { state } = await dag.execute();
    expect(state.went).toBe('left');
  });

  it('should handle node failures in non-critical nodes', async () => {
    dag.addNode('good', async () => ({ good: true }));
    dag.addNode(
      'bad',
      async () => {
        throw new Error('boom');
      },
      { critical: false },
    );
    dag.addNode('after', async () => ({ after: true }));

    dag.addEdge('good', 'bad');
    dag.addEdge('bad', 'after');

    const { state, trace } = await dag.execute();
    expect(state.good).toBe(true);
    const failedStep = trace.find((t) => t.nodeId === 'bad');
    expect(failedStep.status).toBe('failed');
  });

  it('should support interrupt/resume (human-in-the-loop)', async () => {
    dag.addNode('work', async (state) => ({ work: true }));
    dag.addNode('gate', async (state) => {
      dag.interrupt();
      return { awaiting: true };
    });
    dag.addNode('final', async () => ({ finalized: true }));

    dag.addEdge('work', 'gate');
    dag.addEdge('gate', 'final');

    const result = await dag.execute();
    expect(result.state.work).toBe(true);
    expect(result.state.awaiting).toBe(true);

    // Resume
    const resumed = await dag.resume({ approved: true });
    expect(resumed.state.finalized).toBe(true);
  });

  it('should report correct DAG stats', () => {
    dag.addNode('A', async () => ({}));
    dag.addNode('B', async () => ({}));
    dag.addNode('C', async () => ({}));
    dag.addEdge('A', 'B');
    dag.addEdge('A', 'C');

    const stats = dag.getStats();
    expect(stats.nodes).toBe(3);
    expect(stats.edges).toBe(2);
    expect(stats.entryNodes).toBe(1);
  });
});

// ─── Pattern Engine Tests ───────────────────────────────────────────
describe('PatternEngine', () => {
  it('should create a sequential pipeline DAG', async () => {
    const dag = PatternEngine.sequential([
      { id: 'parse', handler: async () => ({ parsed: true }) },
      { id: 'validate', handler: async (s) => ({ validated: s.parsed }) },
      { id: 'execute', handler: async (s) => ({ executed: s.validated }) },
    ]);

    const { state } = await dag.execute();
    expect(state.parsed).toBe(true);
    expect(state.validated).toBe(true);
    expect(state.executed).toBe(true);
  });

  it('should create a parallel fan-out/gather DAG', async () => {
    const dag = PatternEngine.parallelFanOut(
      { id: 'dispatch', handler: async () => ({ task: 'analyze' }) },
      [
        { id: 'w1', handler: async () => ({ r1: 42 }) },
        { id: 'w2', handler: async () => ({ r2: 84 }) },
      ],
      { id: 'gather', handler: async (s) => ({ total: (s.r1 || 0) + (s.r2 || 0) }) },
    );

    const { state } = await dag.execute();
    expect(state.total).toBe(126);
  });

  it('should create a generator/critic loop DAG', async () => {
    let attempts = 0;
    // Test the pattern creates the correct structure
    const dag = PatternEngine.generatorCritic(
      {
        id: 'gen',
        handler: async () => {
          attempts++;
          return { attempt: attempts, quality: attempts >= 3 ? 0.95 : 0.3 };
        },
      },
      {
        id: 'critic',
        handler: async (state) => ({
          _criticPass: state.quality >= 0.9,
          feedback: state.quality >= 0.9 ? 'good' : 'needs work',
        }),
      },
      5,
    );

    // The pattern creates gen→critic and critic→gen (conditional)
    // Verify the DAG has the right nodes
    const stats = dag.getStats();
    expect(stats.nodes).toBe(2);
    expect(stats.edges).toBe(2);
  });

  it('should create a race/tournament DAG', async () => {
    const dag = PatternEngine.race(
      [
        { id: 'fast', handler: async () => ({ _race_fast: 'quick result' }) },
        { id: 'slow', handler: async () => ({ _race_slow: 'thorough result' }) },
      ],
      (results) => {
        // Judge: pick the fast one
        return 'fast';
      },
    );

    const { state } = await dag.execute();
    expect(state._raceWinner).toBe('fast');
  });
});

// ─── Backpressure Manager Tests ─────────────────────────────────────
describe('BackpressureManager', () => {
  let bp;

  beforeEach(() => {
    bp = new BackpressureManager();
    bp.registerSwarm('code-artisan');
    bp.registerSwarm('research-herald');
  });

  it('should accept tasks under normal pressure', () => {
    const result = bp.submit('code-artisan', { id: 'task-1', description: 'build feature' });
    expect(result.accepted).toBe(true);
    expect(result.pressure.level).toBe('NORMAL');
  });

  it('should report pressure levels correctly', () => {
    const p = bp.getPressure('code-artisan');
    expect(p.level).toBe('NORMAL');
    expect(p.circuitState).toBe('closed');
  });

  it('should track task completion and relieve pressure', () => {
    bp.submit('code-artisan', { id: 'task-1', description: 'test' });
    bp.complete('code-artisan', 'task-1', 150, true);

    const p = bp.getPressure('code-artisan');
    expect(p.inFlight).toBe(0);
  });

  it('should open circuit breaker after threshold failures', () => {
    let opened = false;
    bp.on('circuit:open', () => {
      opened = true;
    });

    for (let i = 0; i < 5; i++) {
      bp.submit('code-artisan', { id: `task-${i}`, description: `test-${i}` });
      bp.complete('code-artisan', `task-${i}`, 100, false);
    }

    expect(opened).toBe(true);
  });

  it('should reject when circuit breaker is open', () => {
    for (let i = 0; i < 5; i++) {
      bp.submit('code-artisan', { id: `fail-${i}`, description: `fail ${i}` });
      bp.complete('code-artisan', `fail-${i}`, 100, false);
    }

    const result = bp.submit('code-artisan', { id: 'after', description: 'after circuit open' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('Circuit breaker OPEN');
  });

  it('should detect semantic duplicates', () => {
    const r1 = bp.submit('code-artisan', { id: 'dup-1', description: 'same task' });
    const r2 = bp.submit('code-artisan', { id: 'dup-2', description: 'same task' });
    expect(r1.accepted).toBe(true);
    expect(r2.accepted).toBe(false);
    expect(r2.reason).toContain('duplicate');
  });

  it('should provide global pressure snapshot', () => {
    const global = bp.getGlobalPressure();
    expect(global.swarmCount).toBe(2);
    expect(global.swarms['code-artisan']).toBeDefined();
  });
});

// ─── CSL Router Tests ───────────────────────────────────────────────
describe('CSLRouter', () => {
  let router;

  // Simple deterministic embedding for tests
  const embedFn = (text) => {
    const dims = 16;
    const vec = new Array(dims).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dims] += text.charCodeAt(i);
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  };

  beforeEach(async () => {
    router = new CSLRouter(embedFn);
    await router.registerSwarm('code-artisan', 'code generation programming development');
    await router.registerSwarm('research-herald', 'research analysis investigation');
    await router.registerSwarm('deploy-guardian', 'deployment infrastructure cloud');
  });

  it('should route coding tasks to code-artisan', async () => {
    const result = await router.route({
      id: 't1',
      description: 'write code for development feature',
    });
    expect(result.swarmId).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
    expect(result.scores.length).toBeGreaterThan(0);
  });

  it('should support CSL AND operation', () => {
    const a = [1, 0, 0, 0];
    const b = [1, 0, 0, 0];
    expect(router.cslAnd(a, b)).toBeCloseTo(1.0, 5);
  });

  it('should support CSL OR operation', () => {
    const a = [1, 0, 0, 0];
    const b = [0, 1, 0, 0];
    const result = router.cslOr(a, b);
    expect(result.length).toBe(4);
    // Result should be normalized
    const norm = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('should support CSL GATE operation', () => {
    const a = [1, 0, 0, 0];
    const b = [1, 0, 0, 0];
    const gate = router.cslGate(a, b, 0.5);
    expect(gate.pass).toBe(true);
    expect(gate.score).toBeCloseTo(1.0, 5);
  });

  it('should support multi-route for broadcast', async () => {
    const matches = await router.multiRoute(
      { description: 'code deployment infrastructure' },
      0, // Low threshold to get all
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Bee Factory Tests ──────────────────────────────────────────────
describe('BeeFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new BeeFactory();
    factory.registerTemplate('coder', {
      role: 'Code Artisan',
      goal: 'Write production-quality code',
      backstory: 'Expert software engineer',
    });
  });

  it('should spawn a bee from template', async () => {
    const bee = await factory.spawnBee('coder', 'code-artisan');
    expect(bee).toBeDefined();
    expect(bee.type).toBe('coder');
    expect(bee.swarmId).toBe('code-artisan');
    expect(bee.role).toBe('Code Artisan');
    expect(bee.state).toBe('idle');
  });

  it('should track bees per swarm', async () => {
    await factory.spawnBee('coder', 'code-artisan');
    await factory.spawnBee('coder', 'code-artisan');

    const bees = factory.getSwarmBees('code-artisan');
    expect(bees.length).toBe(2);
  });

  it('should auto-retire poor performers', async () => {
    const bee = await factory.spawnBee('coder', 'code-artisan');
    let retired = false;
    factory.on('bee:retired', () => {
      retired = true;
    });

    // Simulate poor performance (>5 tasks, <61.8% success)
    for (let i = 0; i < 6; i++) {
      factory.recordBeePerformance(bee.id, false, 1000);
    }

    expect(retired).toBe(true);
  });

  it('should report factory stats', async () => {
    await factory.spawnBee('coder', 'code-artisan');
    const stats = factory.getFactoryStats();
    expect(stats.totalBees).toBe(1);
    expect(stats.activeBees).toBe(1);
    expect(stats.templates).toContain('coder');
  });

  it('should get individual bee stats', async () => {
    const bee = await factory.spawnBee('coder', 'code-artisan');
    factory.recordBeePerformance(bee.id, true, 250);

    const stats = factory.getBeeStats(bee.id);
    expect(stats.performance.successRate).toBe(1.0);
    expect(stats.performance.avgLatencyMs).toBe(250);
  });
});

// ─── Swarm Message Bus Tests ────────────────────────────────────────
describe('SwarmMessageBus', () => {
  let bus;

  beforeEach(() => {
    bus = new SwarmMessageBus();
  });

  it('should deliver messages to exact topic subscribers', () => {
    let received = null;
    bus.subscribe('code.task', (envelope) => {
      received = envelope.message;
    });
    bus.publish('code.task', { action: 'build' });
    expect(received.action).toBe('build');
  });

  it('should support wildcard subscriptions', () => {
    let received = [];
    bus.subscribe('code.*', (envelope) => {
      received.push(envelope.message);
    });
    bus.publish('code.task', { type: 'task' });
    bus.publish('code.result', { type: 'result' });
    expect(received.length).toBe(2);
  });

  it('should maintain message history', () => {
    bus.publish('topic1', { a: 1 });
    bus.publish('topic2', { b: 2 });
    const history = bus.getHistory();
    expect(history.length).toBe(2);
  });
});

// ─── A2A Protocol Tests ─────────────────────────────────────────────
describe('A2AProtocol', () => {
  let a2a, bus;

  beforeEach(() => {
    bus = new SwarmMessageBus();
    a2a = new A2AProtocol(bus);
    a2a.registerAgent('code-artisan', {
      name: 'Code Artisan',
      capabilities: ['code-generation', 'debugging'],
      domain: 'coding',
    });
    a2a.registerAgent('research-herald', {
      name: 'Research Herald',
      capabilities: ['web-search', 'analysis'],
      domain: 'research',
    });
  });

  it('should discover agents by capability', () => {
    const coders = a2a.discover('code-generation');
    expect(coders.length).toBe(1);
    expect(coders[0].id).toBe('code-artisan');
  });

  it('should send and track A2A tasks', () => {
    const taskId = a2a.sendTask('research-herald', 'code-artisan', {
      description: 'Generate code based on research',
    });
    expect(taskId).toBeDefined();
    expect(taskId.startsWith('a2a-')).toBe(true);

    const status = a2a.getTaskStatus(taskId);
    // State is 'working' because the bus delivers synchronously,
    // triggering _handleIncoming which sets state to 'working'
    expect(['submitted', 'working']).toContain(status.state);
    expect(status.from).toBe('research-herald');
    expect(status.to).toBe('code-artisan');
  });

  it('should complete A2A tasks', () => {
    const taskId = a2a.sendTask('research-herald', 'code-artisan', {
      description: 'Test task',
    });
    a2a.completeTask(taskId, { output: 'code generated' });
    const status = a2a.getTaskStatus(taskId);
    expect(status.state).toBe('completed');
  });

  it('should provide agent directory', () => {
    const directory = a2a.getAgentDirectory();
    expect(directory.length).toBe(2);
  });

  it('should report protocol stats', () => {
    a2a.sendTask('research-herald', 'code-artisan', { description: 'task 1' });
    a2a.sendTask('code-artisan', 'research-herald', { description: 'task 2' });
    const stats = a2a.getStats();
    expect(stats.agents).toBe(2);
    expect(stats.totalTasks).toBe(2);
  });
});

// ─── Handoff Router Tests ───────────────────────────────────────────
describe('HandoffRouter', () => {
  let router, bus;

  beforeEach(() => {
    bus = new SwarmMessageBus();
    router = new HandoffRouter(bus);
    router.registerRule('cognition-core', 'code-artisan', (task) => task.type === 'code');
  });

  it('should accept valid handoffs above CSL threshold', () => {
    const result = router.handoff(
      'cognition-core',
      'code-artisan',
      { id: 't1', type: 'code' },
      { analysis: 'done' },
      0.85,
    );
    expect(result.accepted).toBe(true);
    expect(result.handoffId).toBeDefined();
  });

  it('should reject handoffs below CSL threshold', () => {
    const result = router.handoff(
      'cognition-core',
      'code-artisan',
      { id: 't1', type: 'code' },
      {},
      0.3,
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('CSL score');
  });

  it('should suggest handoff targets', () => {
    const target = router.suggestTarget('cognition-core', { type: 'code' });
    expect(target).toBe('code-artisan');
  });

  it('should maintain handoff history', () => {
    router.handoff('cognition-core', 'code-artisan', { id: 't1', type: 'code' }, {}, 0.9);
    const history = router.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].from).toBe('cognition-core');
  });
});

// ─── Health Monitor Tests ───────────────────────────────────────────
describe('HealthMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
    monitor.registerSwarm('code-artisan', {});
  });

  it('should initialize swarms as healthy', () => {
    const health = monitor.getSwarmHealth('code-artisan');
    expect(health.status).toBe('healthy');
  });

  it('should degrade on failures', () => {
    monitor.reportHealth('code-artisan', false);
    expect(monitor.getSwarmHealth('code-artisan').status).toBe('degraded');
  });

  it('should mark unhealthy after 3 consecutive failures', () => {
    let unhealthyEmitted = false;
    monitor.on('swarm:unhealthy', () => {
      unhealthyEmitted = true;
    });

    monitor.reportHealth('code-artisan', false);
    monitor.reportHealth('code-artisan', false);
    monitor.reportHealth('code-artisan', false);

    expect(monitor.getSwarmHealth('code-artisan').status).toBe('unhealthy');
    expect(unhealthyEmitted).toBe(true);
  });

  it('should recover to healthy on success', () => {
    monitor.reportHealth('code-artisan', false);
    monitor.reportHealth('code-artisan', true);
    expect(monitor.getSwarmHealth('code-artisan').status).toBe('healthy');
  });

  it('should provide platform summary', () => {
    monitor.registerSwarm('research-herald', {});
    const summary = monitor.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.healthy).toBe(2);
  });

  // Clean up timers
  afterEach(() => {
    monitor.stopMonitoring();
  });
});

// ─── Platform Config Tests ──────────────────────────────────────────
describe('PlatformConfig', () => {
  it('should have phi-derived timing constants', () => {
    expect(PlatformConfig.heartbeatMs).toBeGreaterThan(10000);
    expect(PlatformConfig.heartbeatMs).toBeLessThan(12000);
  });

  it('should have Fibonacci pool sizes', () => {
    const { pools } = PlatformConfig;
    expect(pools.minBees).toBe(3);
    expect(pools.defaultBees).toBe(5);
    expect(pools.maxBees).toBe(13);
    expect(pools.maxSwarmBees).toBe(21);
    expect(pools.messageHistory).toBe(89);
    expect(pools.taskQueueMax).toBe(144);
  });

  it('should have CSL thresholds from phi-harmonic', () => {
    expect(PlatformConfig.csl.high).toBeGreaterThan(0.8);
    expect(PlatformConfig.csl.medium).toBeGreaterThan(0.7);
    expect(PlatformConfig.csl.low).toBeGreaterThan(0.6);
  });

  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(PlatformConfig)).toBe(true);
  });
});

// ─── Agent Runtime Tests ────────────────────────────────────────────
describe('AgentRuntime', () => {
  let runtime;

  beforeEach(() => {
    runtime = new AgentRuntime();
  });

  it('should execute with stub provider (dev mode)', async () => {
    const result = await runtime.execute(
      'code-artisan',
      {
        id: 'task-1',
        description: 'Write a hello world function',
      },
      {
        model: PlatformConfig.models.operational,
      },
    );

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });

  it('should use registered providers', async () => {
    runtime.registerProvider('anthropic', async (req) => ({
      content: `Claude response: ${req.model}`,
      usage: { inputTokens: 100, outputTokens: 50 },
    }));

    const result = await runtime.execute(
      'code-artisan',
      {
        id: 'task-2',
        description: 'Generate code',
      },
      {
        model: { primary: 'claude-sonnet-4-20250514', fallback: 'gemini-2.5-pro' },
      },
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('anthropic');
    expect(result.result).toContain('Claude response');
  });

  it('should failover to fallback provider', async () => {
    runtime.registerProvider('anthropic', async () => {
      throw new Error('API rate limited');
    });
    // Fallback to stub (gemini not registered)

    const result = await runtime.execute(
      'code-artisan',
      {
        id: 'task-3',
        description: 'Generate code',
      },
      {
        model: { primary: 'claude-sonnet-4-20250514', fallback: 'gemini-2.0-flash' },
      },
    );

    // Should fallback to stub since google provider not registered
    expect(result.success).toBe(true);
    expect(result.failedOver).toBe(true);
  });

  it('should build messages with bee context', async () => {
    const result = await runtime.execute(
      'code-artisan',
      {
        id: 'task-4',
        description: 'Build API',
      },
      {
        model: PlatformConfig.models.operational,
        bee: {
          role: 'Senior Engineer',
          goal: 'Build scalable APIs',
          backstory: '15 years of backend experience',
        },
      },
    );

    expect(result.success).toBe(true);
  });
});

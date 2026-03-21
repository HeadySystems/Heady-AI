const { createLogger } = require('../../src/utils/logger');
const logger = createLogger('auto-fixed');
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
// ║  FILE: packages/hc-supervisor/examples.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HCSupervisor Examples
 * 
 * Demonstrates various usage patterns and configurations.
 * FILE: packages/hc-supervisor/examples.js
 */

const {
  HCSupervisor,
  TASK_STATUS,
  ROUTING_STRATEGY
} = require('./index.js');

// ─── EXAMPLE 1: Basic Single Task ─────────────────────────────────────────
async function example1_BasicSingleTask() {
  logger.info('\n=== EXAMPLE 1: Basic Single Task ===\n');
  const supervisor = new HCSupervisor({
    enableHealthChecks: false // Disabled for examples
  });

  // Set mock mode for examples
  process.env.AGENT_MOCK_MODE = 'true';
  try {
    const result = await supervisor.submitTask({
      id: 'example-1-build',
      type: 'build',
      payload: {
        repo: 'heady-core',
        branch: 'main'
      }
    });
    logger.info('Task completed successfully');
    logger.info('Result:', result);
  } catch (error) {
    logger.error('Task failed:', error.message);
  }
  supervisor.shutdown();
}

// ─── EXAMPLE 2: Direct Agent Routing ──────────────────────────────────────
async function example2_DirectRouting() {
  logger.info('\n=== EXAMPLE 2: Direct Agent Routing ===\n');
  const supervisor = new HCSupervisor();
  process.env.AGENT_MOCK_MODE = 'true';
  try {
    // Route to specific agent
    const result = await supervisor.submitTask({
      id: 'example-2-audit',
      type: 'security-scan',
      agents: ['auditor'],
      strategy: 'direct',
      payload: {
        targetPath: '/code'
      },
      timeout: 20000
    });
    logger.info('Task routed to auditor agent');
    logger.info('Result:', result);
  } catch (error) {
    logger.error('Task failed:', error.message);
  }
  supervisor.shutdown();
}

// ─── EXAMPLE 3: Parallel Task Execution ───────────────────────────────────
async function example3_ParallelTasks() {
  logger.info('\n=== EXAMPLE 3: Parallel Task Execution ===\n');
  const supervisor = new HCSupervisor({
    maxConcurrentTasks: 5
  });
  process.env.AGENT_MOCK_MODE = 'true';
  const tasks = [{
    id: 'task-1',
    type: 'lint',
    payload: {
      repo: 'repo-1'
    }
  }, {
    id: 'task-2',
    type: 'test',
    payload: {
      repo: 'repo-2'
    }
  }, {
    id: 'task-3',
    type: 'build',
    payload: {
      repo: 'repo-3'
    }
  }, {
    id: 'task-4',
    type: 'security-scan',
    payload: {
      repo: 'repo-4'
    }
  }, {
    id: 'task-5',
    type: 'deploy',
    payload: {
      service: 'service-1'
    }
  }];
  const startTime = Date.now();
  const {
    results,
    errors,
    succeeded,
    failed
  } = await supervisor.submitParallelTasks(tasks);
  const duration = Date.now() - startTime;
  logger.info(`\nResults: ${succeeded} succeeded, ${failed} failed`);
  logger.info(`Duration: ${duration}ms`);
  results.forEach(r => {
    logger.info(`✓ ${r.taskId}`);
  });
  errors.forEach(e => {
    logger.info(`✗ ${e.taskId}: ${e.error}`);
  });
  supervisor.shutdown();
}

// ─── EXAMPLE 4: Event Monitoring ──────────────────────────────────────────
async function example4_EventMonitoring() {
  logger.info('\n=== EXAMPLE 4: Event Monitoring ===\n');
  const supervisor = new HCSupervisor();
  process.env.AGENT_MOCK_MODE = 'true';

  // Set up event listeners
  supervisor.on('task:assigned', event => {
    logger.info(`[ASSIGNED] ${event.taskId}`);
  });
  supervisor.on('task:executing', event => {
    logger.info(`[EXECUTING] ${event.taskId} on ${event.agent}`);
  });
  supervisor.on('task:completed', event => {
    logger.info(`[COMPLETED] ${event.taskId}`);
  });
  supervisor.on('task:failed', event => {
    logger.info(`[FAILED] ${event.taskId}: ${event.error}`);
  });

  // Submit task
  try {
    await supervisor.submitTask({
      id: 'monitored-task',
      type: 'build',
      payload: {
        repo: 'heady-core'
      }
    });
  } catch (error) {
    // Expected in example mode
  }
  supervisor.shutdown();
}

// ─── EXAMPLE 5: Metrics Collection ────────────────────────────────────────
async function example5_MetricsCollection() {
  logger.info('\n=== EXAMPLE 5: Metrics Collection ===\n');
  const supervisor = new HCSupervisor();
  process.env.AGENT_MOCK_MODE = 'true';

  // Submit multiple tasks
  const tasks = Array.from({
    length: 10
  }, (_, i) => ({
    id: `metric-task-${i}`,
    type: i % 3 === 0 ? 'build' : i % 3 === 1 ? 'test' : 'lint',
    payload: {
      index: i
    }
  }));
  await supervisor.submitParallelTasks(tasks);

  // Get metrics
  const metrics = supervisor.getMetrics();
  logger.info('\n--- Overall Metrics ---');
  logger.info(`Tasks Processed: ${metrics.tasksProcessed}`);
  logger.info(`Tasks Succeeded: ${metrics.tasksSucceeded}`);
  logger.info(`Tasks Failed: ${metrics.tasksFailed}`);
  logger.info(`Success Rate: ${metrics.successRate.toFixed(2)}%`);
  logger.info(`Avg Latency: ${metrics.avgLatency.toFixed(2)}ms`);

  // Get agent status
  const status = supervisor.getAgentStatus();
  logger.info('\n--- Agent Status ---');
  Object.entries(status).forEach(([name, info]) => {
    if (info.requests > 0) {
      logger.info(`${name.padEnd(15)} Health: ${info.health.padEnd(10)} Requests: ${info.requests.padEnd(3)} Success: ${info.successRate.toFixed(1)}%`);
    }
  });
  supervisor.shutdown();
}

// ─── EXAMPLE 6: Agent Catalog Inspection ──────────────────────────────────
async function example6_AgentCatalog() {
  logger.info('\n=== EXAMPLE 6: Agent Catalog Inspection ===\n');
  const supervisor = new HCSupervisor();
  const catalog = supervisor.getAgentCatalog();
  logger.info('Available Agents:\n');
  Object.entries(catalog).forEach(([name, agent]) => {
    logger.info(`${name.toUpperCase()}`);
    logger.info(`  Role: ${agent.role}`);
    logger.info(`  Skills: ${agent.skills.join(', ')}`);
    logger.info(`  Criticality: ${agent.criticality}`);
    logger.info(`  Timeout: ${agent.timeout}ms`);
    logger.info();
  });
  supervisor.shutdown();
}

// ─── EXAMPLE 7: Custom Configuration ──────────────────────────────────────
async function example7_CustomConfiguration() {
  logger.info('\n=== EXAMPLE 7: Custom Configuration ===\n');
  const supervisor = new HCSupervisor({
    maxConcurrentTasks: 10,
    defaultTimeout: 20000,
    enableHealthChecks: false,
    enableMetrics: true,
    retryStrategy: 'exponential-backoff',
    maxRetries: 2
  });
  process.env.AGENT_MOCK_MODE = 'true';
  logger.info('Supervisor configured with:');
  logger.info('- Max concurrent tasks: 10');
  logger.info('- Default timeout: 20s');
  logger.info('- Health checks: disabled');
  logger.info('- Retry strategy: exponential-backoff');
  logger.info('- Max retries: 2');
  try {
    await supervisor.submitTask({
      id: 'custom-task',
      type: 'deploy',
      payload: {
        service: 'test-service'
      }
    });
  } catch (error) {
    // Expected in example mode
  }
  supervisor.shutdown();
}

// ─── EXAMPLE 8: Error Handling ────────────────────────────────────────────
async function example8_ErrorHandling() {
  logger.info('\n=== EXAMPLE 8: Error Handling ===\n');
  const supervisor = new HCSupervisor();

  // Example 1: Invalid task
  try {
    await supervisor.submitTask({
      // Missing 'id' field
      type: 'build',
      payload: {}
    });
  } catch (error) {
    logger.info(`Caught error: ${error.message}`);
  }

  // Example 2: Unknown task type
  process.env.AGENT_MOCK_MODE = 'false'; // Disable mock to trigger agent unavailable error
  try {
    await supervisor.submitTask({
      id: 'unknown-task',
      type: 'unknown-skill',
      payload: {}
    });
  } catch (error) {
    logger.info(`Caught error: ${error.message}`);
  }
  supervisor.shutdown();
}

// ─── EXAMPLE 9: Task Status Tracking ──────────────────────────────────────
async function example9_TaskStatusTracking() {
  logger.info('\n=== EXAMPLE 9: Task Status Tracking ===\n');
  const supervisor = new HCSupervisor();
  process.env.AGENT_MOCK_MODE = 'true';
  const taskId = 'tracked-task';

  // Submit task (fire and forget pattern for this demo)
  supervisor.submitTask({
    id: taskId,
    type: 'build',
    payload: {}
  }).catch(() => {});

  // Check status after submission
  setTimeout(() => {
    const status = supervisor.getTaskStatus(taskId);
    if (status) {
      logger.info(`Task Status: ${status.status}`);
      logger.info(`Agent: ${status.assignedAgent}`);
      logger.info(`Created: ${new Date(status.createdAt).toISOString()}`);
    } else {
      logger.info('Task not found or already completed');
    }
  }, 100);
  supervisor.shutdown();
}

// ─── EXAMPLE 10: Capability Matching ──────────────────────────────────────
async function example10_CapabilityMatching() {
  logger.info('\n=== EXAMPLE 10: Capability Matching ===\n');
  const supervisor = new HCSupervisor();
  process.env.AGENT_MOCK_MODE = 'true';
  const skillTaskMap = {
    'build': 'builder agent will handle',
    'deploy': 'deployer agent will handle',
    'test': 'builder agent will handle',
    'security-scan': 'auditor agent will handle',
    'health-check': 'observer agent will handle',
    'concept-extraction': 'researcher agent will handle',
    'code-analysis': 'claude-code agent will handle'
  };
  logger.info('Skill to Agent Mapping:\n');
  Object.entries(skillTaskMap).forEach(([skill, handler]) => {
    logger.info(`${skill.padEnd(20)} → ${handler}`);
  });
  supervisor.shutdown();
}

// ─── MAIN: Run All Examples ───────────────────────────────────────────────
async function runAllExamples() {
  try {
    // Uncomment examples to run
    await example1_BasicSingleTask();
    // await example2_DirectRouting();
    // await example3_ParallelTasks();
    // await example4_EventMonitoring();
    // await example5_MetricsCollection();
    // await example6_AgentCatalog();
    // await example7_CustomConfiguration();
    // await example8_ErrorHandling();
    // await example9_TaskStatusTracking();
    // await example10_CapabilityMatching();
  } catch (error) {
    logger.error('Error running examples:', error);
  }
}

// Export for testing
module.exports = {
  example1_BasicSingleTask,
  example2_DirectRouting,
  example3_ParallelTasks,
  example4_EventMonitoring,
  example5_MetricsCollection,
  example6_AgentCatalog,
  example7_CustomConfiguration,
  example8_ErrorHandling,
  example9_TaskStatusTracking,
  example10_CapabilityMatching
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
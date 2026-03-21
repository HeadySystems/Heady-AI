'use strict';

const logger = console;
const {
  BeeAgent
} = require('./agent');

// Phi-scaled defaults
const PHI = 1.618033988749895;
const HEARTBEAT_MS = 29034; // phi^7
const DEFAULT_TIMEOUT_MS = Math.round(5000 * PHI); // 8090ms
const SWARM_SIZE = 13; // Fibonacci
const POOL_SIZE = 8; // Fibonacci

async function main() {
  const swarm = [];

  // Spawn Fibonacci-scaled swarm of bee agents
  for (let i = 0; i < SWARM_SIZE; i++) {
    const bee = new BeeAgent({
      name: `{{PROJECT_NAME}}-bee-${i}`,
      beeIndex: i,
      category: i % 3 === 0 ? 'worker' : i % 3 === 1 ? 'scout' : 'queen',
      domain: '{{PROJECT_NAME}}',
      timeout: DEFAULT_TIMEOUT_MS,
      poolSize: POOL_SIZE,
      heartbeatInterval: HEARTBEAT_MS
    });
    await bee.initialize();
    swarm.push(bee);
  }
  logger.info(`[{{PROJECT_NAME}}] Swarm initialized with ${swarm.length} bees`);
  logger.info(`  categories: ${JSON.stringify(getCategoryCounts(swarm))}`);

  // Swarm heartbeat
  const interval = setInterval(() => {
    const statuses = swarm.map(b => b.getStatus());
    const active = statuses.filter(s => s.state === 'ready').length;
    logger.info(`[{{PROJECT_NAME}}] swarm heartbeat — ${active}/${swarm.length} bees ready`);
  }, HEARTBEAT_MS);
  process.on('SIGINT', () => {
    clearInterval(interval);
    swarm.forEach(b => b.shutdown());
    process.exit(0);
  });

  // Fan-out initial task to all bees
  const results = await Promise.allSettled(swarm.map(bee => bee.execute({
    type: 'init',
    swarmSize: swarm.length
  })));
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  logger.info(`[{{PROJECT_NAME}}] Init complete: ${succeeded}/${swarm.length} bees succeeded`);
}
function getCategoryCounts(swarm) {
  return swarm.reduce((acc, bee) => {
    acc[bee.category] = (acc[bee.category] || 0) + 1;
    return acc;
  }, {});
}
main().catch(console.error);
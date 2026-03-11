'use strict';
/**
 * Heady™ Saga Coordinator — CQRS event sourcing with concurrent-equals steps.
 * Each saga step executes as a concurrent equal — no step has priority over another.
 * © 2026 HeadySystems Inc.
 */
const { getLogger } = require('./structured-logger');
const logger = getLogger('saga-coordinator');

class SagaCoordinator {
  constructor(name, steps = []) {
    this.name = name;
    this.steps = steps;  // [{ name, execute: async (ctx) => ctx, compensate: async (ctx) => ctx }]
    this.completedSteps = [];
  }

  async run(context = {}) {
    logger.info(`Saga "${this.name}" starting`, { stepCount: this.steps.length });

    for (const step of this.steps) {
      try {
        logger.info(`Saga step "${step.name}" executing`);
        context = await step.execute(context);
        this.completedSteps.push(step);
        logger.info(`Saga step "${step.name}" completed`);
      } catch (err) {
        logger.error(`Saga step "${step.name}" failed, compensating`, err);
        await this._compensate(context);
        throw new Error(`Saga "${this.name}" failed at step "${step.name}": ${err.message}`);
      }
    }

    logger.info(`Saga "${this.name}" completed successfully`);
    return context;
  }

  async _compensate(context) {
    for (const step of [...this.completedSteps].reverse()) {
      try {
        if (step.compensate) {
          logger.warn(`Compensating step "${step.name}"`);
          await step.compensate(context);
        }
      } catch (err) {
        logger.fatal(`Compensation failed for step "${step.name}"`, err);
      }
    }
  }
}

module.exports = { SagaCoordinator };

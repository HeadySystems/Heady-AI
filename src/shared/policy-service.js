/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * PolicyService — Centralized provider for Policy and Budget Engines.
 */

let PolicyEngine = null; try { PolicyEngine = require("./policy-engine"); } catch(e) {
  const logger = require('../utils/logger');
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}
let BudgetService = null; try { BudgetService = require("./services/budget-service"); } catch(e) {
  const logger = require('../utils/logger');
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}

// Initialize singletons
const budgetService = new BudgetService();
const policyEngine = new PolicyEngine({ budgetService });

module.exports = {
    policyEngine,
    budgetService
};

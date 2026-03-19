'use strict';

const { recipeRegistry } = require('./recipe-registry');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('recipe-router', 'distiller');

const PSI = 0.6180339887;
const PSI_SQ = 0.3819660113;

/**
 * Recipe routing for AutoContext Pass 2.5.
 * Searches recipe registry by intent embedding and returns routing decision.
 */
async function routeRecipe(intentVector, taskClass, minTier = 1) {
  const recipes = await recipeRegistry.search(intentVector, taskClass, minTier);

  if (!recipes.length) {
    return { action: 'PROCEED_NORMAL' };
  }

  const best = recipes[0];

  // Tier 3: exact replay — requires strong match (≥ ψ)
  if (best.tier === 3 && best.score >= PSI) {
    log.info('fast-path match', { recipe_id: best.id, score: best.score, task_class: taskClass });
    return {
      action: 'FAST_PATH',
      recipe: best,
      skip_to: 'EXECUTE',
      confidence: best.score,
      fast_path_eligible: true,
    };
  }

  // Tier 2: pipeline config — moderate match (≥ ψ²)
  if (best.tier === 2 && best.score >= PSI_SQ) {
    log.info('config optimization match', { recipe_id: best.id, score: best.score });
    return {
      action: 'OPTIMIZE_CONFIG',
      config: best.config,
      tips: best.tips,
      recipe_id: best.id,
    };
  }

  // Tier 1: prompt enhancement
  if (best.tier === 1) {
    return {
      action: 'INJECT_PROMPT',
      prompt_override: best.prompt,
      recipe_id: best.id,
    };
  }

  return { action: 'PROCEED_NORMAL' };
}

module.exports = { routeRecipe };

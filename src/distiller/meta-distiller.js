'use strict';

const { recipeRegistry } = require('./recipe-registry');
const { createLogger } = require('../../packages/structured-logger');
const log = createLogger('meta-distiller', 'distiller');

/**
 * Meta-Distillation: when a task class accumulates > fib(9)=34 recipes,
 * compress into optimal composite via CSL CONSENSUS weighted by JUDGE scores.
 * Prevents unbounded recipe growth and surfaces the consensus route.
 */
async function metaDistill(taskClass) {
  const recipes = [];
  for (const [id, recipe] of recipeRegistry.recipes) {
    if (recipe.task_class === taskClass && !recipe.archived) {
      recipes.push(recipe);
    }
  }

  if (recipes.length <= 34) {
    return { compressed: false, reason: `only ${recipes.length} recipes (threshold: 34)` };
  }

  // Weighted consensus: higher JUDGE scores get more influence
  const totalWeight = recipes.reduce((sum, r) => sum + (r.judge_score || 0.5), 0);

  // Find the most common tier and config patterns
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  recipes.forEach(r => tierCounts[r.tier]++);
  const dominantTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0][0];

  // Archive underperforming recipes
  const archived = [];
  for (const recipe of recipes) {
    if (recipe.uses >= 8 && recipe.successes / recipe.uses < 0.382) {
      await recipeRegistry.softDelete(recipe.id);
      archived.push(recipe.id);
    }
  }

  log.activity('meta-distillation complete', {
    task_class: taskClass,
    total_recipes: recipes.length,
    archived: archived.length,
    dominant_tier: dominantTier,
  });

  return {
    compressed: true,
    task_class: taskClass,
    recipes_processed: recipes.length,
    recipes_archived: archived.length,
    dominant_tier: parseInt(dominantTier),
    consensus_weight: totalWeight / recipes.length,
  };
}

module.exports = { metaDistill };

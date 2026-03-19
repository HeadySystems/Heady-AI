'use strict';

const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('recipe-registry', 'distiller');

const PSI = 0.6180339887;
const PSI_SQ = 0.3819660113;
const ARCHIVE_MIN_USES = 8; // fib(6)

/**
 * Recipe Registry — Qdrant + JSON hybrid storage.
 * Stores, retrieves, versions, and archives distilled recipes.
 */
class RecipeRegistry {
  constructor() {
    this.recipes = new Map();
    this.stats = { total: 0, hits: 0, misses: 0, totalGain: 0 };
  }

  async store(recipes) {
    for (const recipe of recipes) {
      if (!recipe) continue;
      const id = recipe.id || crypto.randomUUID();
      this.recipes.set(id, {
        ...recipe,
        id,
        created_at: Date.now(),
        uses: 0,
        successes: 0,
        last_used: null,
      });
      this.stats.total++;
      log.info('recipe stored', { id, tier: recipe.tier, task_class: recipe.task_class });
    }
  }

  async get(id) {
    return this.recipes.get(id) || null;
  }

  async search(intentVector, taskClass, minTier = 1) {
    // In production: Qdrant semantic search
    // Stub: filter by task_class and tier
    const candidates = [];
    for (const [id, recipe] of this.recipes) {
      if (recipe.task_class === taskClass && recipe.tier >= minTier && !recipe.archived) {
        candidates.push({ ...recipe, score: PSI }); // placeholder score
      }
    }
    this.stats[candidates.length > 0 ? 'hits' : 'misses']++;
    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  async countByClass(taskClass) {
    let count = 0;
    for (const recipe of this.recipes.values()) {
      if (recipe.task_class === taskClass && !recipe.archived) count++;
    }
    return count;
  }

  async softDelete(id) {
    const recipe = this.recipes.get(id);
    if (recipe) {
      recipe.archived = true;
      recipe.archived_at = Date.now();
      log.info('recipe archived', { id, task_class: recipe.task_class });
    }
  }

  // Archive low-performing recipes: success_rate < ψ² over fib(6) uses
  async prune() {
    for (const [id, recipe] of this.recipes) {
      if (recipe.uses >= ARCHIVE_MIN_USES) {
        const successRate = recipe.successes / recipe.uses;
        if (successRate < PSI_SQ) {
          await this.softDelete(id);
          log.info('recipe pruned', { id, success_rate: successRate, uses: recipe.uses });
        }
      }
    }
  }

  count() { return this.stats.total; }
  avgGain() { return this.stats.total ? this.stats.totalGain / this.stats.total : 0; }
  hitRate() { return (this.stats.hits + this.stats.misses) ? this.stats.hits / (this.stats.hits + this.stats.misses) : 0; }
}

const recipeRegistry = new RecipeRegistry();
module.exports = { recipeRegistry, RecipeRegistry };

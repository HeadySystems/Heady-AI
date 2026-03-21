'use strict';

const {
  PHI,
  BASE,
  phiScale
} = require('./principles');
class TemplateEngine {
  constructor(options = {}) {
    this.weights = options.weights || {
      skills: 0.20,
      workflows: 0.20,
      nodes: 0.10,
      headyswarmTasks: 0.25,
      bees: 0.15,
      situations: 0.10
    };
    this.limits = options.limits || {
      skills: 10,
      workflows: 8,
      nodes: 5,
      headyswarmTasks: 8,
      bees: 6,
      situations: 6
    };
    this.templates = [];
  }
  loadTemplates(input) {
    if (Array.isArray(input)) {
      this.templates = input;
    } else if (input && input.templates) {
      this.templates = input.templates;
    }
    return this;
  }
  score(template) {
    const dims = ['skills', 'workflows', 'nodes', 'headyswarmTasks', 'bees', 'situations'];
    let total = 0;
    for (const dim of dims) {
      const count = (template[dim] || []).length;
      const limit = this.limits[dim] || 1;
      const weight = this.weights[dim] || 0;
      total += count / limit * weight;
    }
    return Number(total.toFixed(6));
  }
  select(situation, limit = 3) {
    return this.templates.filter(t => (t.situations || []).includes(situation)).map(t => ({
      ...t,
      optimizationScore: this.score(t)
    })).sort((a, b) => b.optimizationScore - a.optimizationScore).slice(0, limit);
  }
  coverageReport(situations = []) {
    const report = {};
    for (const s of situations) {
      const matching = this.templates.filter(t => (t.situations || []).includes(s));
      report[s] = {
        count: matching.length,
        templates: matching.map(t => t.id)
      };
    }
    return report;
  }
  rankAll() {
    return this.templates.map(t => ({
      id: t.id,
      name: t.name,
      score: this.score(t)
    })).sort((a, b) => b.score - a.score);
  }
}
module.exports = {
  TemplateEngine
};
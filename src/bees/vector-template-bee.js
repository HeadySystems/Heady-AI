const domain = 'vector-templates';
const description = '3D vector storage → template instantiation → bee swarming engine';
const priority = 0.95; // concurrent-equal weight — this IS the swarm engine

function getWork(ctx = {}) {
  return [async () => {
    try {
      const vte = require('../memory/vector-template-engine');
      const stats = vte.getStats();
      return {
        bee: domain,
        action: 'status',
        templates: stats.templates,
        templateNames: stats.templateNames,
        zoneMapping: stats.zoneMapping,
        status: 'active'
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'status',
        error: err.message
      };
    }
  }, async () => {
    try {
      const vte = require('../memory/vector-template-engine');
      return {
        bee: domain,
        action: 'list-templates',
        templates: vte.listTemplates()
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'list-templates',
        error: err.message
      };
    }
  }, async () => {
    try {
      const vte = require('../memory/vector-template-engine');
      const templates = vte.listTemplates();
      const ready = templates.filter(t => t.priority >= 0.8);
      return {
        bee: domain,
        action: 'swarm-readiness',
        totalTemplates: templates.length,
        highPriority: ready.length,
        readyToSwarm: ready.map(t => t.name),
        status: 'ready'
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'swarm-readiness',
        error: err.message
      };
    }
  }];
}
module.exports = {
  domain,
  description,
  priority,
  getWork
};
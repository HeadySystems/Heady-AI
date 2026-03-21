const { createLogger } = require('./utils/logger');
const logger = createLogger('hc_improvement_scheduler');

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
// ║  FILE: src/hc_improvement_scheduler.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

class ImprovementScheduler extends EventEmitter {
  constructor({
    interval = 900000, // 15 minutes
    pipeline,
    patternEngine,
    selfCritiqueEngine,
    mcPlanScheduler
  }) {
    super();
    this.interval = interval;
    this.pipeline = pipeline;
    this.patternEngine = patternEngine;
    this.selfCritiqueEngine = selfCritiqueEngine;
    this.mcPlanScheduler = mcPlanScheduler;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    
    // Initial run
    this.runCycle();
    
    // Set up interval
    this.timer = setInterval(() => {
      this.runCycle();
    }, this.interval);
    
    this.emit('started');
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.running = false;
    this.emit('stopped');
  }

  async runCycle() {
    if (!this.pipeline || !this.patternEngine || !this.selfCritiqueEngine) {
      logger.warn('[ImprovementScheduler] Dependencies not available, skipping cycle');
      return;
    }
    
    try {
      this.emit('cycle_start');
      
      // 1. Check for improvement candidates from pattern engine
      const improvements = await this.getImprovementCandidates();
      
      // 2. Prioritize using Monte Carlo if available
      let prioritized = improvements;
      if (this.mcPlanScheduler && typeof this.mcPlanScheduler.prioritizeImprovements === 'function') {
        prioritized = this.mcPlanScheduler.prioritizeImprovements(improvements);
      } else {
        prioritized = improvements.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      }
      
      // 3. Execute top improvements via pipeline
      for (const improvement of prioritized.slice(0, 3)) {
        await this.executeImprovement(improvement);
      }
      
      this.emit('cycle_complete', { improvements: prioritized.length });
    } catch (error) {
      logger.warn(`[ImprovementScheduler] Cycle error: ${error.message}`);
      this.emit('cycle_error', error);
    }
  }

  async getImprovementCandidates() {
    // Get patterns needing improvement (guard against undefined returns)
    const stagnantPatterns = this.patternEngine.getPatternsByState('stagnant') || [];
    const degradingPatterns = this.patternEngine.getPatternsByState('degrading') || [];
    
    // Get self-critique findings (guard against undefined returns)
    const critiques = this.selfCritiqueEngine.getRecentCritiques() || [];
    
    // Combine into improvement candidates
    return [
      ...stagnantPatterns.map(p => ({
        type: 'pattern_stagnation',
        target: p.id,
        priority: p.severity === 'critical' ? 1 : 2,
        details: p
      })),
      ...degradingPatterns.map(p => ({
        type: 'pattern_degradation',
        target: p.id,
        priority: 1, // Always high priority
        details: p
      })),
      ...critiques.map(c => ({
        type: 'self_critique',
        target: c.context,
        priority: c.severity === 'high' ? 1 : 2,
        details: c
      }))
    ];
  }

  async executeImprovement(improvement) {
    // Execute via pipeline if available
    if (this.pipeline) {
      return this.pipeline.run({
        type: 'improvement_task',
        improvement,
        lane: 'improvement'
      });
    }
    
    // Fallback direct execution
    switch (improvement.type) {
      case 'pattern_stagnation':
      case 'pattern_degradation':
        return this.handlePatternImprovement(improvement);
      case 'self_critique':
        return this.handleCritiqueImprovement(improvement);
      default:
        throw new Error(`Unknown improvement type: ${improvement.type}`);
    }
  }

  async handlePatternImprovement(improvement) {
    this.emit('improvement_start', improvement);
    const { details } = improvement;

    // Reset the pattern state in the engine so it re-enters the healthy lifecycle
    if (this.patternEngine && typeof this.patternEngine.resetPattern === 'function') {
      this.patternEngine.resetPattern(details.id);
    }

    // Log the remediation action for audit trail
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: improvement.type,
      target: improvement.target,
      action: improvement.type === 'pattern_degradation' ? 'reset_and_retrain' : 'refresh_baseline',
      severity: details.severity || 'medium',
    };

    const logPath = path.join(__dirname, '../.checkpoints', 'improvement-log.json');
    try {
      const existing = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
      existing.push(logEntry);
      fs.writeFileSync(logPath, JSON.stringify(existing.slice(-200), null, 2));
    } catch (_) { /* log dir may not exist */  }

    this.emit('improvement_complete', { ...improvement, logEntry });
    return { success: true, action: logEntry.action };
  }

  async handleCritiqueImprovement(improvement) {
    this.emit('improvement_start', improvement);
    const { details } = improvement;

    // Apply the critique's suggested fix if the self-critique engine exposes one
    let applied = false;
    if (this.selfCritiqueEngine && typeof this.selfCritiqueEngine.applySuggestion === 'function') {
      applied = await this.selfCritiqueEngine.applySuggestion(details);
    }

    // Log
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: improvement.type,
      target: improvement.target,
      action: applied ? 'suggestion_applied' : 'flagged_for_review',
      severity: details.severity || 'medium',
    };

    const logPath = path.join(__dirname, '../.checkpoints', 'improvement-log.json');
    try {
      const existing = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
      existing.push(logEntry);
      fs.writeFileSync(logPath, JSON.stringify(existing.slice(-200), null, 2));
    } catch (_) { /* log dir may not exist */  }

    this.emit('improvement_complete', { ...improvement, logEntry });
    return { success: true, applied, action: logEntry.action };
  }
}

function registerImprovementRoutes(app, scheduler) {
  app.get('/api/improvement/status', (req, res) => {
    res.json({
      running: scheduler.running,
      interval: scheduler.interval,
      lastCycle: scheduler.lastCycleTs,
      ts: new Date().toISOString()
    });
  });
  
  app.post('/api/improvement/start', (req, res) => {
    scheduler.start();
    res.json({ success: true, running: scheduler.running });
  });
  
  app.post('/api/improvement/stop', (req, res) => {
    scheduler.stop();
    res.json({ success: true, running: scheduler.running });
  });
  
  app.post('/api/improvement/run-cycle', async (req, res) => {
    try {
      await scheduler.runCycle();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  ImprovementScheduler,
  registerImprovementRoutes
};

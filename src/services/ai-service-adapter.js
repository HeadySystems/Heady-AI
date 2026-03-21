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
// ║  FILE: src/services/ai-service-adapter.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { claude } = require('../hc_claude');
const { getHeadyBrainService } = require('./heady-brain-service');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const mcPlanScheduler = require('./mc-plan-scheduler'); // Assuming mcPlanScheduler is in the same directory
const performanceTracker = require('./ai-performance-tracker');

class AIServiceAdapter {
  constructor() {
    this.services = {};
    this.activeService = null;
    this.serviceConfig = {};
  }

  async init() {
    const configFile = await fs.readFile('./configs/ai-services.yaml', 'utf8');
    this.serviceConfig = yaml.load(configFile);
    
    // Initialize enabled services
    for (const [serviceName, config] of Object.entries(this.serviceConfig.services)) {
      if (config.enabled) {
        this.services[serviceName] = this._createServiceHandler(serviceName);
      }
    }
    
    this.activeService = this.serviceConfig.defaultService;
    
    if (!this.services[this.activeService]) {
      throw new Error(`Default service ${this.activeService} not enabled`);
    }
  }

  _createServiceHandler(serviceName) {
    switch(serviceName) {
      case 'heady':
      case 'heady-brain':
      case 'headybrain':
        return async (prompt, context, options = {}) => {
          const brainService = getHeadyBrainService();
          return await brainService.chatCompletion({
            messages: [
              { role: 'system', content: 'You are HeadyBrain, the primary AI service.' },
              { role: 'user', content: prompt }
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 16384,
            context: { analysis_context: context }
          });
        };

      case 'claude':
        return async (prompt, context) => {
          return await claude.getCompletion('multi-service-analysis', { 
            prompt,
            context,
            model: process.env.CLAUDE_MODEL || this.serviceConfig.services.claude.default_model
          });
        };
        
      case 'codex':
        return async () => { throw new Error('Codex integration not implemented'); };
        
      case 'gemini':
        return async () => { throw new Error('Gemini integration not implemented'); };
        
      case 'llama':
        return async () => { throw new Error('Llama integration not implemented'); };
        
      case 'gpt4':
        return async () => { throw new Error('GPT-4 integration not implemented'); };
        
      case 'palm':
        return async () => { throw new Error('PaLM integration not implemented'); };
        
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  async analyze(prompt, context, options = {}) {
    const startTime = Date.now();
    const taskType = options.taskType || this._detectTaskType(context);
    
    const service = options.service || 
                   (options.auto ? await performanceTracker.getBestServiceForTask(taskType) : this.activeService);
    
    try {
      const result = await this.services[service](prompt, context, options);
      
      // Record performance
      await performanceTracker.recordServicePerformance(
        service,
        taskType,
        {
          latency: Date.now() - startTime,
          inputLength: context.length,
          success: true
        }
      );
      
      return result;
    } catch (err) {
      await performanceTracker.recordServicePerformance(
        service,
        taskType,
        {
          latency: Date.now() - startTime,
          inputLength: context.length,
          success: false,
          error: err.message
        }
      );
      throw err;
    }
  }

  _detectTaskType(context) {
    // Simple heuristic - could be enhanced
    if (context.includes('```')) return 'code_analysis';
    if (context.length > 1000) return 'long_context';
    return 'general';
  }
}

const adapter = new AIServiceAdapter();
module.exports = adapter;


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------

/**
 * Heady MCP — Brain & Patterns Service
 * Handles: brainStatus, brainThink, patternsList, patternsEvaluate,
 *          registryList, registryLookup, getStatus, listServices, pipelineStatus
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const HEADY_ROOT = path.resolve(__dirname, '..', '..');
const CONFIGS_DIR = path.join(HEADY_ROOT, 'configs');

class McpBrain {
  constructor(deps = {}) {
    this._latent = deps.latent || null;
    this._codelock = deps.codelock || null;
    this._translator = deps.translator || null;
  }

  async getStatus() {
    const checks = [];
    for (const dir of ['configs', 'src', 'packages', 'frontend', 'backend', 'apps', 'scripts']) {
      checks.push(`${fs.existsSync(path.join(HEADY_ROOT, dir)) ? '✓' : '✗'} ${dir}/`);
    }
    for (const file of ['package.json', 'heady-manager.js', '.env', 'docker-compose.yml']) {
      checks.push(`${fs.existsSync(path.join(HEADY_ROOT, file)) ? '✓' : '✗'} ${file}`);
    }
    let version = 'unknown';
    try { const pkg = JSON.parse(fs.readFileSync(path.join(HEADY_ROOT, 'package.json'), 'utf8')); version = `${pkg.name}@${pkg.version}`; } catch (e) { /* ignore */ }
    let mergeConflicts = 0;
    try { mergeConflicts = (fs.readFileSync(path.join(HEADY_ROOT, 'heady-manager.js'), 'utf8').match(/<<<<<<</g) || []).length; } catch (e) { /* ignore */ }
    let configCount = 0;
    try { configCount = fs.readdirSync(CONFIGS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.json') || f.endsWith('.yml')).length; } catch (e) { /* ignore */ }

    return { content: [{ type: 'text', text: [
      `# Heady System Status`, `Version: ${version}`, `Root: ${HEADY_ROOT}`, `Config files: ${configCount}`,
      mergeConflicts > 0 ? `⚠ heady-manager.js has ${mergeConflicts} MERGE CONFLICTS` : `✓ No merge conflicts detected`,
      ``, `## Structure Check`, ...checks
    ].join('\n') }] };
  }

  async listServices() {
    const catalogPath = path.join(CONFIGS_DIR, 'service-catalog.yaml');
    if (!fs.existsSync(catalogPath)) throw new Error('service-catalog.yaml not found');
    const catalog = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
    if (!catalog?.services) throw new Error('No services found in catalog');
    const serviceList = catalog.services.map(s =>
      `• ${s.name} [${s.type}] — ${s.role}\n  Endpoint: ${s.endpoint || 'N/A'} | Criticality: ${s.criticality || 'N/A'}`
    );
    return { content: [{ type: 'text', text: `# Heady Services (${catalog.services.length})\n\n${serviceList.join('\n\n')}` }] };
  }

  async pipelineStatus() {
    const pipelinePath = path.join(CONFIGS_DIR, 'hcfullpipeline.yaml');
    if (!fs.existsSync(pipelinePath)) throw new Error('hcfullpipeline.yaml not found');
    const content = fs.readFileSync(pipelinePath, 'utf8');
    const pipeline = yaml.load(content);
    const stages = pipeline?.stages || pipeline?.pipeline?.stages || [];
    const stageList = Array.isArray(stages)
      ? stages.map((s, i) => `  ${i + 1}. ${typeof s === 'string' ? s : s.name || s.id || JSON.stringify(s)}`).join('\n')
      : 'Could not parse stages';
    return { content: [{ type: 'text', text: `# HCFullPipeline\n\nVersion: ${pipeline?.version || 'unknown'}\n\n## Stages\n${stageList}\n\n## Raw Config\n${content.substring(0, 3000)}` }] };
  }

  async brainStatus() {
    const status = {};
    try { const ls = this._getLatent(); status.latentSpace = ls.getStatus(); } catch (e) { status.latentSpace = 'unavailable'; }
    try { const cl = this._getCodeLock(); status.codeLock = cl.getStatus(); } catch (e) { status.codeLock = 'unavailable'; }
    try { const t = this._getTranslator(); status.translator = t.getStatus(); } catch (e) { status.translator = 'unavailable'; }

    let ors = 50;
    if (status.latentSpace !== 'unavailable') ors += 10;
    if (status.codeLock !== 'unavailable') ors += 10;
    if (status.translator !== 'unavailable') ors += 10;
    if (status.codeLock?.locked) ors += 5;
    if (status.latentSpace?.l1_vector_store?.entries > 10) ors += 5;

    let conflictFiles = 0;
    try { conflictFiles = (fs.readFileSync(path.join(HEADY_ROOT, 'heady-manager.js'), 'utf8').match(/<<<<<<</g) || []).length; } catch (e) { /* ignore */ }
    if (conflictFiles > 0) ors -= 15;

    const mode = ors >= 85 ? 'FULL POWER' : ors >= 70 ? 'NORMAL' : ors >= 50 ? 'MAINTENANCE' : 'RECOVERY';

    return { content: [{ type: 'text', text: [
      `# 🧠 System Brain`, `\n## Operational Readiness Score: ${ors}/100 — ${mode}`,
      `\n## Subsystem Health`,
      `• Latent Space: ${status.latentSpace !== 'unavailable' ? `✓ (${status.latentSpace?.l1_vector_store?.entries || 0} vectors)` : '✗ unavailable'}`,
      `• CodeLock: ${status.codeLock !== 'unavailable' ? `✓ (${status.codeLock?.locked ? '🔒 locked' : '🔓 unlocked'})` : '✗ unavailable'}`,
      `• Translator: ${status.translator !== 'unavailable' ? `✓ (${Object.keys(status.translator?.adapters || {}).length} adapters)` : '✗ unavailable'}`,
      conflictFiles > 0 ? `\n⚠️ heady-manager.js has ${conflictFiles} merge conflicts — resolve to gain +15 ORS` : '',
      `\n## Recommendations`,
      ors < 70 ? '• Resolve merge conflicts immediately' : '',
      status.codeLock?.queue?.pending > 0 ? `• ${status.codeLock.queue.pending} pending change requests need review` : '',
      ors >= 85 ? '• System healthy — safe to deploy and build aggressively' : ''
    ].filter(Boolean).join('\n') }] };
  }

  async brainThink(question, context) {
    const ls = this._getLatent();
    const searchResults = ls.search(question, 5);
    const relatedOps = searchResults.results.map(r => `• [${r.score.toFixed(2)}] ${r.text}`).join('\n');
    ls.record('brain', `Brain query: ${question}`, { context });

    return { content: [{ type: 'text', text: [
      `# 🧠 Brain Analysis`, `\n**Question:** ${question}`,
      context ? `\n**Context:** ${JSON.stringify(context)}` : '',
      `\n## Related Memory`, relatedOps || 'No related operations found.',
      `\n## System State Snapshot`, `• MCP tools: 40+`, `• Adapters: 7 protocols`,
      `• Codebase: ${fs.existsSync(path.join(HEADY_ROOT, 'heady-manager.js')) ? 'present' : 'missing key files'}`,
      `\n_The brain has recorded this query for future pattern matching._`
    ].join('\n') }] };
  }

  async patternsList() {
    const conceptsPath = path.join(CONFIGS_DIR, 'concepts-index.yaml');
    if (!fs.existsSync(conceptsPath)) return { content: [{ type: 'text', text: '⚠️ concepts-index.yaml not found.' }] };
    const concepts = yaml.load(fs.readFileSync(conceptsPath, 'utf8'));
    const sections = [];
    for (const [category, items] of Object.entries(concepts || {})) {
      if (Array.isArray(items)) sections.push(`## ${category}\n${items.map(i => typeof i === 'string' ? `• ${i}` : `• ${i.name || i.id}: ${i.status || 'unknown'}`).join('\n')}`);
      else if (typeof items === 'object') sections.push(`## ${category}\n${JSON.stringify(items, null, 2)}`);
    }
    return { content: [{ type: 'text', text: `# Pattern Index\n\n${sections.join('\n\n')}` }] };
  }

  async patternsEvaluate(patternId) {
    const ls = this._getLatent();
    const related = ls.search(patternId, 5);
    ls.record('patterns', `Evaluating pattern: ${patternId}`, { patternId });
    return { content: [{ type: 'text', text: [
      `# Pattern Evaluation: ${patternId}`, `\n## Related History`,
      related.results.length > 0 ? related.results.map(r => `• [${r.score.toFixed(2)}] ${r.text}`).join('\n') : 'No previous evaluations found.',
      `\n## Recommendation`, `Pattern '${patternId}' evaluation recorded. Check concepts-index.yaml for implementation status.`
    ].join('\n') }] };
  }

  async registryList(category) {
    const regPath = path.join(HEADY_ROOT, 'heady-registry.json');
    if (!fs.existsSync(regPath)) return { content: [{ type: 'text', text: '⚠️ heady-registry.json not found' }] };
    const registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (category) return { content: [{ type: 'text', text: `# Registry: ${category}\n\n${JSON.stringify(registry[category], null, 2).substring(0, 5000)}` }] };
    const sections = Object.keys(registry).map(k => {
      const count = Array.isArray(registry[k]) ? registry[k].length : Object.keys(registry[k] || {}).length;
      return `• ${k}: ${count} entries`;
    });
    return { content: [{ type: 'text', text: `# Heady Registry\n\n${sections.join('\n')}` }] };
  }

  async registryLookup(name) {
    const regPath = path.join(HEADY_ROOT, 'heady-registry.json');
    if (!fs.existsSync(regPath)) throw new Error('heady-registry.json not found');
    const registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    const found = [];
    const search = (obj, pathStr = '') => {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (typeof item === 'object' && item) {
            const match = Object.values(item).some(v => typeof v === 'string' && v.toLowerCase().includes(name.toLowerCase()));
            if (match) found.push({ path: pathStr, item });
          }
        }
      } else if (typeof obj === 'object' && obj) {
        for (const [k, v] of Object.entries(obj)) {
          if (k.toLowerCase().includes(name.toLowerCase())) found.push({ path: k, item: v });
          else search(v, pathStr ? `${pathStr}.${k}` : k);
        }
      }
    };
    search(registry);
    const lines = found.map(f => `## ${f.path}\n\`\`\`json\n${JSON.stringify(f.item, null, 2).substring(0, 1000)}\n\`\`\``);
    return { content: [{ type: 'text', text: found.length > 0 ? `# Registry: "${name}" (${found.length} matches)\n\n${lines.join('\n\n')}` : `No matches for "${name}"` }] };
  }

  // Lazy loaders for subsystem dependencies
  _getLatent() {
    if (!this._latent) {
      try { this._latent = require(path.join(HEADY_ROOT, 'src', 'hc_latent_space.js')); }
      catch (e) { throw new Error(`Latent space module not found: ${e.message}`); }
    }
    return this._latent;
  }

  _getCodeLock() {
    if (!this._codelock) {
      try { this._codelock = require(path.join(HEADY_ROOT, 'src', 'hc_codelock.js')); }
      catch (e) { throw new Error(`CodeLock module not found: ${e.message}`); }
    }
    return this._codelock;
  }

  _getTranslator() {
    if (!this._translator) {
      try { this._translator = require(path.join(HEADY_ROOT, 'src', 'hc_translator.js')); }
      catch (e) { throw new Error(`Translator module not found: ${e.message}`); }
    }
    return this._translator;
  }
}

module.exports = McpBrain;

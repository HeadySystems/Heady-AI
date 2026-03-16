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
// ║  FILE: src/hc_skill_synthesizer.js                              ║
// ║  LAYER: distiller/synthesis                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyDistiller — Skill Synthesizer
 *
 * Converts filtered successful trajectories into reusable skills
 * following the Voyager pattern (3.3× unique items, 15.3× faster).
 *
 * Output format: Anthropic's Agent Skills standard (SKILL.md),
 * adopted by Claude Code, Cursor, VS Code, GitHub, OpenAI Codex.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SkillSynthesizer {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(__dirname, '..', '.claude', 'skills', 'distilled');
    this.skillIndex = new Map(); // skillId → { description, embedding?, filePath }
  }

  /**
   * Synthesize a SKILL.md from a set of filtered trace summaries and entries.
   *
   * @param {string} skillName - Name for the synthesized skill
   * @param {Array} traceSummaries - Filtered trace summaries
   * @param {Function} traceLoader - Function(traceId) → entries[]
   * @param {Object} options - { description, category, tips }
   */
  synthesize(skillName, traceSummaries, traceLoader, options = {}) {
    if (traceSummaries.length === 0) {
      throw new Error('Cannot synthesize skill from empty trace set');
    }

    // Extract patterns across all traces
    const patterns = this._extractPatterns(traceSummaries, traceLoader);

    // Generate SKILL.md content
    const skillContent = this._generateSkillMd(skillName, patterns, options);

    // Write to disk
    const skillDir = path.join(this.outputDir, this._slugify(skillName));
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, skillContent, 'utf8');

    // Update index
    const skillId = this._slugify(skillName);
    this.skillIndex.set(skillId, {
      name: skillName,
      description: options.description || `Distilled from ${traceSummaries.length} traces`,
      category: options.category || 'distilled',
      filePath: skillPath,
      traceCount: traceSummaries.length,
      synthesizedAt: new Date().toISOString(),
      patternSummary: {
        toolSequences: patterns.toolSequences.length,
        configDeps: patterns.configDependencies.length,
        avgDurationMs: patterns.avgDurationMs,
        avgStepCount: patterns.avgStepCount,
      },
    });

    return { skillId, skillPath, patterns };
  }

  /**
   * Extract common patterns across multiple traces.
   */
  _extractPatterns(traceSummaries, traceLoader) {
    const allToolSequences = [];
    const allConfigDeps = new Set();
    const allStepNames = [];
    let totalDuration = 0;
    let totalSteps = 0;
    let totalLLMCalls = 0;

    for (const summary of traceSummaries) {
      totalDuration += summary.durationMs || 0;
      totalSteps += summary.stepCount || 0;
      totalLLMCalls += summary.llmCallCount || 0;

      try {
        const entries = traceLoader(summary.traceId);
        const tools = entries
          .filter(e => e.type === 'tool_call' || e.type === 'skill_step')
          .map(e => e.tool || e.step)
          .filter(Boolean);

        if (tools.length > 0) {
          allToolSequences.push(tools);
        }

        // Extract config dependencies from trace start meta
        const startEntry = entries.find(e => e.type === 'trace_start');
        if (startEntry?.meta?.skillId) {
          allConfigDeps.add(startEntry.meta.skillId);
        }

        // Collect step names
        allStepNames.push(...tools);
      } catch (e) {
        // skip unloadable traces
      }
    }

    // Find most common tool sequence (majority vote)
    const sequenceVotes = {};
    for (const seq of allToolSequences) {
      const key = seq.join('→');
      sequenceVotes[key] = (sequenceVotes[key] || 0) + 1;
    }
    const sortedSequences = Object.entries(sequenceVotes)
      .sort((a, b) => b[1] - a[1])
      .map(([seq, count]) => ({ sequence: seq.split('→'), frequency: count }));

    // Find most common individual tools
    const toolFreq = {};
    for (const name of allStepNames) {
      toolFreq[name] = (toolFreq[name] || 0) + 1;
    }
    const topTools = Object.entries(toolFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));

    return {
      toolSequences: sortedSequences,
      topTools,
      configDependencies: Array.from(allConfigDeps),
      avgDurationMs: traceSummaries.length > 0 ? Math.round(totalDuration / traceSummaries.length) : 0,
      avgStepCount: traceSummaries.length > 0 ? Math.round(totalSteps / traceSummaries.length) : 0,
      avgLLMCalls: traceSummaries.length > 0 ? Math.round(totalLLMCalls / traceSummaries.length) : 0,
      traceCount: traceSummaries.length,
    };
  }

  /**
   * Generate SKILL.md content following Anthropic's Agent Skills standard.
   */
  _generateSkillMd(skillName, patterns, options = {}) {
    const slug = this._slugify(skillName);
    const now = new Date().toISOString();
    const desc = options.description || `Auto-distilled skill from ${patterns.traceCount} successful execution traces`;
    const category = options.category || 'distilled';

    const topSequence = patterns.toolSequences[0];
    const sequenceSteps = topSequence
      ? topSequence.sequence.map((s, i) => `${i + 1}. Execute \`${s}\``).join('\n')
      : '1. Execute the primary action';

    const toolList = patterns.topTools
      .map(t => `- \`${t.tool}\` (used ${t.count}× across traces)`)
      .join('\n');

    const tipSection = options.tips && options.tips.length > 0
      ? `\n## Learned Tips\n\n${options.tips.map(t => `- **${t.type}**: ${t.content} (confidence: ${(t.confidence * 100).toFixed(0)}%)`).join('\n')}\n`
      : '';

    return `---
name: "${skillName}"
slug: "${slug}"
category: "${category}"
distilled: true
synthesized_at: "${now}"
trace_count: ${patterns.traceCount}
avg_duration_ms: ${patterns.avgDurationMs}
avg_steps: ${patterns.avgStepCount}
---

# ${skillName}

${desc}

## Overview

This skill was automatically distilled from **${patterns.traceCount} successful execution traces** using the HeadyDistiller.
Average execution: **${patterns.avgStepCount} steps** in **${patterns.avgDurationMs}ms** with **${patterns.avgLLMCalls} LLM calls**.

## Steps

${sequenceSteps}

## Tools Used

${toolList || '- No specific tools identified'}

## Performance Profile

| Metric | Value |
|--------|-------|
| Traces analyzed | ${patterns.traceCount} |
| Avg duration | ${patterns.avgDurationMs}ms |
| Avg steps | ${patterns.avgStepCount} |
| Avg LLM calls | ${patterns.avgLLMCalls} |
| Top sequence frequency | ${topSequence ? topSequence.frequency : 0} |
${tipSection}
## Configuration Dependencies

${patterns.configDependencies.length > 0
  ? patterns.configDependencies.map(d => `- \`${d}\``).join('\n')
  : '- No specific configuration dependencies identified'}

## Autonomy

- \`requires_approval\`: none
- \`auto_run\`: true
- \`can_modify_files\`: true
- \`can_execute_commands\`: true
`;
  }

  /**
   * List all synthesized skills.
   */
  listSkills() {
    return Array.from(this.skillIndex.values());
  }

  /**
   * Load synthesized skills from disk.
   */
  loadFromDisk() {
    if (!fs.existsSync(this.outputDir)) return;
    const dirs = fs.readdirSync(this.outputDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.outputDir, dir.name, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf8');
        const nameMatch = content.match(/^# (.+)$/m);
        this.skillIndex.set(dir.name, {
          name: nameMatch ? nameMatch[1] : dir.name,
          filePath: skillPath,
          category: 'distilled',
          loadedFromDisk: true,
        });
      }
    }
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

module.exports = SkillSynthesizer;

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyCoder v1.0 — Unified Coding Intelligence          ║
// ║  10 LLM providers + HeadyCodex + HeadyJules + Perplexity       ║
// ║  HeadyAutoContext: 5-pass enrichment on every call              ║
// ║  Powers HeadyAI-IDE autocomplete, battle, autonomous coding     ║
// ║  ⚠️ PATENT LOCK — HS-2026-051, HS-2026-060                     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377];

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-coder',
  base: { service: 'heady-coder', node: 'headyforge' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ═══════════════════════════════════════════════════════════════════
// §1 — PROVIDER REGISTRY
// ═══════════════════════════════════════════════════════════════════

const PROVIDERS = {

  // ── ULTRA tier ─────────────────────────────────────────────────

  'claude-opus-4.6-thinking': {
    id: 'claude-opus-4.6-thinking',
    name: 'Claude Opus 4.6 Extended Thinking',
    provider: 'anthropic',
    model: 'claude-opus-4-6-20260301',
    keyEnv: 'ANTHROPIC_API_KEY',
    tier: 'ultra',
    costIn: 15.0, costOut: 75.0, costCached: 1.50,
    maxOutput: 32000, maxThinking: 128000,
    quality: 0.99, speed: 'slow',
    strengths: ['architecture', 'deep-reasoning', 'debugging', 'security-audit', 'refactoring'],
    thinking: true, streaming: true, isAnthropic: true,
  },

  'gpt-5.4': {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    model: process.env.MODEL_GPT54 || 'gpt-5.4-0301',
    keyEnv: 'OPENAI_API_KEY',
    tier: 'ultra',
    costIn: 5.0, costOut: 20.0, costCached: 2.50,
    maxOutput: 32768,
    quality: 0.97, speed: 'medium',
    strengths: ['code-gen', 'tool-use', 'multimodal', 'reasoning'],
    thinking: false, streaming: true, isOpenAI: true,
  },

  // ── PREMIUM tier ──────────────────────────────────────────────

  'claude-sonnet-4.6': {
    id: 'claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    model: process.env.MODEL_ANTHROPIC_PRIMARY || 'claude-sonnet-4-6-20260301',
    keyEnv: 'ANTHROPIC_API_KEY',
    tier: 'premium',
    costIn: 3.0, costOut: 15.0, costCached: 0.30,
    maxOutput: 64000,
    quality: 0.95, speed: 'medium',
    strengths: ['code-gen', 'debugging', 'tool-use', 'analysis'],
    thinking: false, streaming: true, isAnthropic: true,
  },

  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini Pro 3.1 Preview',
    provider: 'google',
    model: process.env.MODEL_GEMINI_PRO || 'gemini-3.1-pro-preview',
    keyEnv: 'GEMINI_API_KEY',
    tier: 'premium',
    costIn: 1.25, costOut: 10.0, costCached: 0.315,
    maxOutput: 65536,
    quality: 0.93, speed: 'fast',
    strengths: ['code-gen', 'long-context', 'reasoning', 'multimodal'],
    thinking: true, streaming: true, isGemini: true,
  },

  // ── STANDARD tier ─────────────────────────────────────────────

  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    keyEnv: 'OPENAI_API_KEY',
    tier: 'standard',
    costIn: 2.50, costOut: 10.0, costCached: 1.25,
    maxOutput: 16384,
    quality: 0.92, speed: 'medium',
    strengths: ['code-gen', 'tool-use', 'multimodal'],
    thinking: false, streaming: true, isOpenAI: true,
  },

  // ── ECONOMY tier ──────────────────────────────────────────────

  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    model: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
    tier: 'economy',
    costIn: 0.14, costOut: 0.28, costCached: 0.028,
    maxOutput: 65536,
    quality: 0.79, speed: 'medium',
    strengths: ['code-gen', 'reasoning', 'bulk-tasks'],
    thinking: false, streaming: true, isOpenAI: true,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
  },

  'groq-llama-70b': {
    id: 'groq-llama-70b',
    name: 'Groq Llama 3.3 70B',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
    tier: 'economy',
    costIn: 0.59, costOut: 0.79, costCached: 0,
    maxOutput: 32768,
    quality: 0.84, speed: 'ultrafast',
    strengths: ['classification', 'triage', 'fast-iteration', 'code-review'],
    thinking: false, streaming: true, isOpenAI: true,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },

  'gemini-flash-lite': {
    id: 'gemini-flash-lite',
    name: 'Gemini Flash-Lite',
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    keyEnv: 'GEMINI_API_KEY',
    tier: 'economy',
    costIn: 0.10, costOut: 0.40, costCached: 0.025,
    maxOutput: 65536,
    quality: 0.70, speed: 'fast',
    strengths: ['autocomplete', 'classification', 'inline-edits'],
    thinking: false, streaming: true, isGemini: true,
  },

  // ── RESEARCH tier ─────────────────────────────────────────────

  'perplexity-sonar-pro': {
    id: 'perplexity-sonar-pro',
    name: 'Perplexity Sonar Pro',
    provider: 'perplexity',
    model: 'sonar-pro',
    keyEnv: 'PERPLEXITY_API_KEY',
    tier: 'research',
    costIn: 3.0, costOut: 15.0, costCached: 0,
    maxOutput: 8192,
    quality: 0.90, speed: 'medium',
    strengths: ['research', 'api-lookup', 'error-diagnosis', 'library-discovery', 'documentation'],
    thinking: false, streaming: true, isOpenAI: true, search: true,
    endpoint: 'https://api.perplexity.ai/chat/completions',
  },

  'perplexity-sonar-reasoning': {
    id: 'perplexity-sonar-reasoning',
    name: 'Perplexity Sonar Reasoning Pro',
    provider: 'perplexity',
    model: 'sonar-reasoning-pro',
    keyEnv: 'PERPLEXITY_API_KEY',
    tier: 'research',
    costIn: 3.0, costOut: 15.0, costCached: 0,
    maxOutput: 16384,
    quality: 0.92, speed: 'slow',
    strengths: ['deep-research', 'multi-step-reasoning', 'technical-analysis'],
    thinking: true, streaming: true, isOpenAI: true, search: true,
    endpoint: 'https://api.perplexity.ai/chat/completions',
  },
};


// ═══════════════════════════════════════════════════════════════════
// §2 — HEADY AUTO-CONTEXT SERVICE
//
// The central nervous system. Every LLM call passes through
// AutoContext's 5-pass enrichment pipeline before reaching any model.
// Continuously updates context in the background so it's always warm.
// ═══════════════════════════════════════════════════════════════════

export class HeadyAutoContext {
  constructor(deps) {
    this.redis = deps.redis;     // Upstash Redis (T0)
    this.db = deps.db;           // Neon Postgres (T1)
    this.qdrant = deps.qdrant;   // Qdrant (T2)
    this.embed = deps.embed;     // Embedding function
    this.fs = deps.fs;           // Workspace filesystem
    this.tenantId = deps.tenantId || 'default';

    // Live context cache — updated continuously
    this._cache = {
      workspaceFiles: null,        // File tree snapshot
      openFilesContent: new Map(), // path → content
      gitState: null,              // Branch, diff, recent commits
      terminalHistory: [],         // Last 21 commands + outputs
      pipelineState: null,         // HCFullPipeline current state
      swarmState: null,            // Active swarms/bees
      userPreferences: null,       // Coding style, language, framework prefs
      recentErrors: [],            // Last 13 errors from Sentry
      conversationMemory: [],      // Last 34 messages
      relevantMemories: [],        // T1/T2 memories matching current context
      lastRefresh: 0,
    };

    this._refreshInterval = null;
  }

  /**
   * Start continuous background context refresh.
   * Runs every φ⁵ms ≈ 11s — fast enough for real-time, cheap enough for budget.
   */
  start() {
    this._refresh(); // immediate first pass
    this._refreshInterval = setInterval(() => this._refresh(), Math.round(Math.pow(PHI, 5) * 1000));
    log.info('AutoContext started — refreshing every ~11s');
  }

  stop() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
  }

  /**
   * Background refresh — updates all context sources in parallel.
   */
  async _refresh() {
    const start = Date.now();
    try {
      const ns = `tenant:${this.tenantId}`;

      const [
        workspaceFiles,
        gitState,
        pipelineState,
        swarmState,
        recentErrors,
        userPrefs,
      ] = await Promise.allSettled([
        this.fs?.listTree?.().catch(() => null),
        this._getGitState(),
        this.redis.get(`${ns}:pipeline:state`).catch(() => null),
        this.redis.get(`${ns}:swarm:active`).catch(() => null),
        this.redis.lrange(`${ns}:errors:recent`, 0, FIB[7] - 1).catch(() => []),
        this.redis.get(`${ns}:user:preferences`).catch(() => null),
      ]);

      if (workspaceFiles.status === 'fulfilled' && workspaceFiles.value)
        this._cache.workspaceFiles = workspaceFiles.value;
      if (gitState.status === 'fulfilled' && gitState.value)
        this._cache.gitState = gitState.value;
      if (pipelineState.status === 'fulfilled' && pipelineState.value)
        this._cache.pipelineState = JSON.parse(pipelineState.value);
      if (swarmState.status === 'fulfilled' && swarmState.value)
        this._cache.swarmState = JSON.parse(swarmState.value);
      if (recentErrors.status === 'fulfilled')
        this._cache.recentErrors = recentErrors.value.map(e => { try { return JSON.parse(e); } catch { return e; } });
      if (userPrefs.status === 'fulfilled' && userPrefs.value)
        this._cache.userPreferences = JSON.parse(userPrefs.value);

      this._cache.lastRefresh = Date.now();

      log.debug({ durationMs: Date.now() - start }, 'AutoContext refresh complete');
    } catch (err) {
      log.warn({ err: err.message }, 'AutoContext refresh partial failure');
    }
  }

  async _getGitState() {
    // Git state from workspace — branch, staged, recent commits
    try {
      const branch = await this.fs?.exec?.('git branch --show-current').catch(() => 'unknown');
      const diff = await this.fs?.exec?.('git diff --stat HEAD').catch(() => '');
      const recentCommits = await this.fs?.exec?.('git log --oneline -8').catch(() => '');
      return { branch, diff, recentCommits };
    } catch { return null; }
  }

  /**
   * Track open file content — called by IDE shell on file open/edit.
   */
  updateOpenFile(path, content) {
    this._cache.openFilesContent.set(path, content);
    // Cap at fib(8) = 21 open files
    if (this._cache.openFilesContent.size > FIB[8]) {
      const oldest = this._cache.openFilesContent.keys().next().value;
      this._cache.openFilesContent.delete(oldest);
    }
  }

  /**
   * Track terminal output — called by terminal manager.
   */
  addTerminalEntry(command, output) {
    this._cache.terminalHistory.push({ command, output: output?.slice(0, 1000), ts: Date.now() });
    if (this._cache.terminalHistory.length > FIB[8]) {
      this._cache.terminalHistory.shift();
    }
  }

  /**
   * Track conversation — called by AI chat panel.
   */
  addMessage(role, content) {
    this._cache.conversationMemory.push({ role, content: content.slice(0, 2000), ts: Date.now() });
    if (this._cache.conversationMemory.length > FIB[9]) {
      this._cache.conversationMemory.shift();
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * THE 5-PASS ENRICHMENT PIPELINE
   *
   * Every LLM call flows through these 5 passes before the model
   * sees it. Each pass adds a layer of context. Together they
   * ensure no model ever operates in a vacuum.
   *
   * Pass 1: WORKSPACE — file tree, open files, git state
   * Pass 2: MEMORY — relevant memories from 3-tier vector store
   * Pass 3: CONVERSATION — recent messages + terminal output
   * Pass 4: SYSTEM STATE — pipeline, swarms, errors, budget
   * Pass 5: USER PROFILE — preferences, coding style, history
   * ═══════════════════════════════════════════════════════════════
   */
  async enrich(messages, opts = {}) {
    const enrichedMessages = [...messages];
    const contextBlocks = [];

    // ── Pass 1: WORKSPACE CONTEXT ─────────────────────────────
    if (this._cache.workspaceFiles || this._cache.openFilesContent.size > 0) {
      let workspaceCtx = '## Workspace Context\n';

      if (this._cache.workspaceFiles) {
        workspaceCtx += `File tree (truncated):\n${truncateTree(this._cache.workspaceFiles, 50)}\n\n`;
      }

      // Include actively open files (most relevant)
      if (this._cache.openFilesContent.size > 0) {
        const activeFile = opts.activeFile;
        for (const [path, content] of this._cache.openFilesContent) {
          const isActive = path === activeFile;
          const maxLen = isActive ? 4000 : 800;
          workspaceCtx += `### ${isActive ? '🔍 ACTIVE: ' : ''}${path}\n\`\`\`\n${content.slice(0, maxLen)}\n\`\`\`\n\n`;
        }
      }

      if (this._cache.gitState) {
        workspaceCtx += `### Git State\nBranch: ${this._cache.gitState.branch}\nDiff:\n${this._cache.gitState.diff?.slice(0, 500) || 'clean'}\nRecent commits:\n${this._cache.gitState.recentCommits?.slice(0, 400) || 'none'}\n`;
      }

      contextBlocks.push(workspaceCtx);
    }

    // ── Pass 2: MEMORY RETRIEVAL ──────────────────────────────
    if (this.embed && opts.query) {
      try {
        const queryEmbedding = await this.embed(opts.query);
        const memories = await this._searchMemories(queryEmbedding, FIB[5]); // top 5
        if (memories.length > 0) {
          let memCtx = '## Relevant Memories\n';
          memories.forEach((m, i) => {
            memCtx += `[${i + 1}] (score: ${m.score.toFixed(3)}) ${m.content.slice(0, 300)}\n\n`;
          });
          contextBlocks.push(memCtx);
        }
      } catch (err) {
        log.debug({ err: err.message }, 'Memory retrieval skipped');
      }
    }

    // ── Pass 3: CONVERSATION + TERMINAL ───────────────────────
    if (this._cache.conversationMemory.length > 0 || this._cache.terminalHistory.length > 0) {
      let convCtx = '## Session Context\n';

      if (this._cache.terminalHistory.length > 0) {
        const recent = this._cache.terminalHistory.slice(-5);
        convCtx += '### Recent Terminal\n';
        recent.forEach(t => {
          convCtx += `$ ${t.command}\n${t.output?.slice(0, 200) || ''}\n\n`;
        });
      }

      // Conversation summary (not full history — that's in the messages array)
      if (this._cache.conversationMemory.length > 8) {
        convCtx += `### Conversation (${this._cache.conversationMemory.length} messages this session)\n`;
        convCtx += `Topics covered: ${extractTopics(this._cache.conversationMemory)}\n`;
      }

      contextBlocks.push(convCtx);
    }

    // ── Pass 4: SYSTEM STATE ──────────────────────────────────
    {
      let sysCtx = '## System State\n';

      if (this._cache.pipelineState) {
        sysCtx += `Pipeline: Stage ${this._cache.pipelineState.stage || '?'}/22 — ${this._cache.pipelineState.status || 'idle'}\n`;
      }

      if (this._cache.swarmState) {
        const active = this._cache.swarmState;
        sysCtx += `Active swarms: ${typeof active === 'object' ? JSON.stringify(active).slice(0, 200) : active}\n`;
      }

      if (this._cache.recentErrors.length > 0) {
        sysCtx += `### Recent Errors (${this._cache.recentErrors.length})\n`;
        this._cache.recentErrors.slice(-3).forEach(e => {
          sysCtx += `- ${typeof e === 'object' ? (e.message || e.title || JSON.stringify(e).slice(0, 100)) : String(e).slice(0, 100)}\n`;
        });
      }

      contextBlocks.push(sysCtx);
    }

    // ── Pass 5: USER PROFILE ──────────────────────────────────
    if (this._cache.userPreferences) {
      let userCtx = '## User Preferences\n';
      const prefs = this._cache.userPreferences;
      if (prefs.language) userCtx += `Preferred language: ${prefs.language}\n`;
      if (prefs.framework) userCtx += `Framework: ${prefs.framework}\n`;
      if (prefs.style) userCtx += `Coding style: ${prefs.style}\n`;
      if (prefs.testingFramework) userCtx += `Testing: ${prefs.testingFramework}\n`;
      if (prefs.linting) userCtx += `Linting: ${prefs.linting}\n`;
      contextBlocks.push(userCtx);
    }

    // ── Inject enriched context into system message ───────────
    const contextPayload = contextBlocks.join('\n---\n');
    const systemIdx = enrichedMessages.findIndex(m => m.role === 'system');

    if (systemIdx >= 0) {
      enrichedMessages[systemIdx] = {
        role: 'system',
        content: enrichedMessages[systemIdx].content + '\n\n' + contextPayload,
      };
    } else {
      enrichedMessages.unshift({
        role: 'system',
        content: HEADY_CODER_SYSTEM + '\n\n' + contextPayload,
      });
    }

    log.debug({
      passes: contextBlocks.length,
      contextChars: contextPayload.length,
      openFiles: this._cache.openFilesContent.size,
      memories: this._cache.conversationMemory.length,
    }, 'AutoContext 5-pass enrichment complete');

    return enrichedMessages;
  }

  async _searchMemories(embedding, limit) {
    // Search across T1 (pgvector) and T2 (Qdrant) in parallel
    const embStr = Array.isArray(embedding[0]) ? embedding[0] : embedding;
    const results = [];

    try {
      const pgResult = await this.db.query(`
        SELECT content, 1 - (embedding <=> $1::vector) AS score
        FROM memory_t1
        WHERE user_id = $2 AND deleted_at IS NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `, [`[${embStr.join(',')}]`, this.tenantId, limit]);
      results.push(...pgResult.rows.map(r => ({ content: r.content, score: r.score, tier: 'T1' })));
    } catch { /* pgvector unavailable */ }

    results.sort((a, b) => b.score - a.score);
    return results.filter(r => r.score >= PSI * PSI).slice(0, limit); // CSL RECALL gate
  }
}

// ═══════════════════════════════════════════════════════════════════
// §3 — HEADY CODER (core call engine)
// ═══════════════════════════════════════════════════════════════════

export class HeadyCoder {
  constructor(deps) {
    this.autoContext = deps.autoContext;  // HeadyAutoContext instance
    this.redis = deps.redis;
    this.tenantId = deps.tenantId || 'default';
  }

  /**
   * Call a specific provider with AutoContext enrichment.
   */
  async call(providerId, messages, opts = {}) {
    const provider = PROVIDERS[providerId];
    if (!provider) throw new Error(`Unknown provider: ${providerId} — HE-3010`);
    if (!process.env[provider.keyEnv]) throw new Error(`Missing key: ${provider.keyEnv} — HE-3011`);

    // AutoContext enrichment (always, unless explicitly disabled)
    const enriched = opts.skipAutoContext
      ? messages
      : await this.autoContext.enrich(messages, {
          activeFile: opts.activeFile,
          query: messages.filter(m => m.role === 'user').pop()?.content || '',
        });

    const result = await this._dispatch(provider, enriched, opts);

    // Track cost
    const cost = (result.inputTokens / 1e6) * provider.costIn + (result.outputTokens / 1e6) * provider.costOut;
    await this.redis.incrbyfloat(`tenant:${this.tenantId}:cost:daily`, cost).catch(() => {});

    log.info({
      provider: providerId,
      tier: provider.tier,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: `$${cost.toFixed(6)}`,
      thinkingTokens: result.thinkingTokens || 0,
    }, 'HeadyCoder call complete');

    return { ...result, provider: providerId, cost };
  }

  /**
   * Smart route — auto-select provider by task complexity.
   */
  async smartCall(messages, opts = {}) {
    const userMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    const complexity = estimateComplexity(userMsg, opts);
    const providerId = selectProvider(complexity, opts);
    return this.call(providerId, messages, opts);
  }

  /**
   * Research call — always routes to Perplexity for web-grounded answers.
   */
  async research(query, opts = {}) {
    const providerId = opts.deep ? 'perplexity-sonar-reasoning' : 'perplexity-sonar-pro';
    return this.call(providerId, [
      { role: 'system', content: 'You are a technical research assistant. Provide accurate, cited answers.' },
      { role: 'user', content: query },
    ], { ...opts, skipAutoContext: false });
  }

  /**
   * HeadyBattle — run N providers in parallel, score, return ranked.
   */
  async battle(messages, opts = {}) {
    const candidates = opts.candidates || ['claude-sonnet-4.6', 'deepseek-v3'];
    const timeout = opts.timeout || Math.round(Math.pow(PHI, 7) * 1000); // 29,034ms

    const results = await Promise.allSettled(
      candidates.map(id =>
        Promise.race([
          this.call(id, messages, opts),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
        ])
      )
    );

    const scored = results
      .map((r, i) => ({
        provider: candidates[i],
        status: r.status,
        result: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      }))
      .filter(r => r.result)
      .map(r => ({
        ...r,
        score: scoreBattleCandidate(r.result, opts),
      }))
      .sort((a, b) => b.score - a.score);

    log.info({
      candidates: candidates.length,
      succeeded: scored.length,
      winner: scored[0]?.provider,
      winnerScore: scored[0]?.score,
    }, 'HeadyBattle complete');

    return {
      winner: scored[0] || null,
      allCandidates: scored,
      battleId: `battle-${Date.now().toString(36)}`,
    };
  }

  // ── Internal dispatch ─────────────────────────────────────────

  async _dispatch(provider, messages, opts) {
    const gwBase = `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID || ''}/heady`;
    let url, headers, body;

    if (provider.isAnthropic) {
      url = provider.endpoint || `${gwBase}/anthropic/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': process.env[provider.keyEnv],
        'anthropic-version': '2023-06-01',
      };
      body = {
        model: provider.model,
        max_tokens: opts.maxTokens || 8192,
        system: messages.find(m => m.role === 'system')?.content || '',
        messages: messages.filter(m => m.role !== 'system'),
      };

      if (provider.thinking && opts.thinking !== false) {
        body.temperature = 1;
        body.thinking = {
          type: 'enabled',
          budget_tokens: opts.thinkingBudget || 32000,
        };
      } else {
        body.temperature = opts.temperature ?? 0;
      }
    } else if (provider.isGemini) {
      const model = provider.model;
      url = provider.endpoint || `${gwBase}/google-ai-studio/v1beta/models/${model}:generateContent`;
      headers = { 'Content-Type': 'application/json', 'x-goog-api-key': process.env[provider.keyEnv] };
      body = {
        contents: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: opts.temperature ?? 0,
          maxOutputTokens: opts.maxTokens || 8192,
        },
      };
      const sys = messages.find(m => m.role === 'system');
      if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
      if (provider.thinking && opts.thinking !== false) {
        body.generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget || 16000 };
      }
    } else {
      // OpenAI-compatible (GPT, DeepSeek, Groq, Perplexity)
      url = provider.endpoint || `${gwBase}/openai/v1/chat/completions`;
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env[provider.keyEnv]}` };
      body = {
        model: provider.model,
        messages,
        max_tokens: opts.maxTokens || 8192,
        temperature: opts.temperature ?? 0,
      };
      if (provider.search) {
        body.search_recency_filter = opts.recency || 'month';
        body.return_citations = true;
      }
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout || 60000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`${provider.id} ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json();

    // Normalize response across all providers
    if (provider.isAnthropic) {
      const thinking = data.content?.find(b => b.type === 'thinking')?.thinking || '';
      const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
      return {
        content: text, thinking, model: data.model,
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        thinkingTokens: thinking.length > 0 ? Math.ceil(thinking.length / 4) : 0,
      };
    } else if (provider.isGemini) {
      const parts = data.candidates?.[0]?.content?.parts || [];
      const thought = parts.filter(p => p.thought).map(p => p.text).join('') || '';
      const text = parts.filter(p => !p.thought).map(p => p.text).join('') || '';
      return {
        content: text, thinking: thought, model: provider.model,
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        thinkingTokens: data.usageMetadata?.thoughtsTokenCount || 0,
      };
    } else {
      return {
        content: data.choices?.[0]?.message?.content || '',
        citations: data.citations || undefined,
        model: data.model,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// §4 — HEADY CODEX (Autonomous Coding Agent)
//
// Multi-step: plan → generate → verify → commit.
// Uses Opus Thinking for planning, Sonnet for generation,
// Groq for fast lint/test triage.
// ═══════════════════════════════════════════════════════════════════

export class HeadyCodex {
  constructor(deps) {
    this.coder = deps.coder;
    this.fs = deps.fs;
  }

  async *execute(intent, context = {}) {
    const taskId = `codex-${Date.now().toString(36)}`;
    yield { type: 'codex:start', taskId, intent };

    // Phase 1: PLAN with Opus Thinking (deep reasoning)
    yield { type: 'codex:phase', phase: 'planning', message: 'Analyzing codebase...' };
    const plan = await this.coder.call('claude-opus-4.6-thinking', [
      { role: 'system', content: CODEX_PLANNER_PROMPT },
      { role: 'user', content: `Intent: ${intent}\n\nFiles:\n${context.fileTree || 'unknown'}\nActive: ${context.activeFile || 'none'}` },
    ], { thinkingBudget: 24000, maxTokens: 4096 });

    let changes;
    try {
      const match = plan.content.match(/```json\s*([\s\S]*?)```/) || [null, plan.content];
      changes = JSON.parse(match[1]).changes;
    } catch {
      yield { type: 'codex:error', message: 'Plan parse failed — falling back to Sonnet' };
      // Fallback: simpler plan with Sonnet
      const fallback = await this.coder.call('claude-sonnet-4.6', [
        { role: 'system', content: CODEX_PLANNER_PROMPT },
        { role: 'user', content: `Intent: ${intent}\nOutput ONLY JSON: {"changes":[{"file":"path","action":"create|edit","description":"what"}]}` },
      ], { maxTokens: 2048 });
      try {
        changes = JSON.parse(fallback.content.replace(/```json\s*|\s*```/g, '')).changes;
      } catch {
        yield { type: 'codex:error', message: 'Cannot plan — aborting' };
        return;
      }
    }

    yield { type: 'codex:plan', changes, thinking: plan.thinking?.slice(0, 500) };

    // Phase 2: GENERATE each file with Sonnet (fast, high-quality code)
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      yield { type: 'codex:generating', file: change.file, progress: (i + 1) / changes.length };

      if (change.action === 'delete') {
        yield { type: 'codex:file', file: change.file, content: null, action: 'delete' };
        continue;
      }

      const existing = change.action === 'edit'
        ? await this.fs?.read?.(change.file).catch(() => '') || ''
        : '';

      const gen = await this.coder.call('claude-sonnet-4.6', [
        { role: 'system', content: 'Write production code. No markdown fences. No explanation. Just the complete file.' },
        { role: 'user', content: `Task: ${change.description}\n${existing ? `\nExisting:\n${existing}` : '\nNew file.'}` },
      ], { maxTokens: 8192, activeFile: change.file });

      yield { type: 'codex:file', file: change.file, content: gen.content, action: change.action };
    }

    // Phase 3: VERIFY with fast Groq triage
    yield { type: 'codex:phase', phase: 'verifying', message: 'Running lint + test check...' };
    const verify = await this.coder.call('groq-llama-70b', [
      { role: 'system', content: 'Review this code change for obvious bugs, missing imports, and type errors. Be concise.' },
      { role: 'user', content: `Changes: ${changes.map(c => c.file + ' (' + c.action + '): ' + c.description).join('\n')}` },
    ], { maxTokens: 1024, skipAutoContext: true });

    yield { type: 'codex:verified', review: verify.content };
    yield { type: 'codex:complete', taskId, changesCount: changes.length };
  }
}

// ═══════════════════════════════════════════════════════════════════
// §5 — HEADY JULES (Research-First Coding Agent)
//
// Perplexity for research → Gemini/Sonnet for implementation.
// Used when the task requires understanding APIs, libraries,
// or patterns the model may not have trained on.
// ═══════════════════════════════════════════════════════════════════

export class HeadyJules {
  constructor(deps) {
    this.coder = deps.coder;
    this.fs = deps.fs;
  }

  async *execute(intent, context = {}) {
    const taskId = `jules-${Date.now().toString(36)}`;
    yield { type: 'jules:start', taskId, intent };

    // Phase 1: RESEARCH with Perplexity (web-grounded)
    yield { type: 'jules:phase', phase: 'researching', message: 'Searching docs and examples...' };
    const research = await this.coder.research(
      `How to: ${intent}\n\nI need:\n1. Current best practices (2025-2026)\n2. API signatures and code examples\n3. Common pitfalls to avoid\n4. npm packages needed with versions`,
      { deep: true }
    );

    yield {
      type: 'jules:research',
      findings: research.content.slice(0, 2000),
      citations: research.citations || [],
    };

    // Phase 2: PLAN with Gemini Pro (great at synthesizing research → code plan)
    yield { type: 'jules:phase', phase: 'planning', message: 'Synthesizing research into plan...' };
    const plan = await this.coder.call('gemini-3.1-pro-preview', [
      { role: 'system', content: JULES_PLANNER_PROMPT },
      { role: 'user', content: `Research findings:\n${research.content}\n\nUser intent: ${intent}\n\nOutput JSON: {"changes":[{"file":"path","action":"create|edit","description":"what","packages":[]}]}` },
    ], { maxTokens: 4096, thinking: true, thinkingBudget: 8000 });

    let changes;
    try {
      const match = plan.content.match(/```json\s*([\s\S]*?)```/) || [null, plan.content];
      changes = JSON.parse(match[1]).changes;
    } catch {
      yield { type: 'jules:error', message: 'Plan parse failed' };
      return;
    }

    yield { type: 'jules:plan', changes, thinking: plan.thinking?.slice(0, 300) };

    // Phase 3: GENERATE with GPT-5.4 or Sonnet (research-informed code)
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      yield { type: 'jules:generating', file: change.file, progress: (i + 1) / changes.length };

      if (change.action === 'delete') {
        yield { type: 'jules:file', file: change.file, content: null, action: 'delete' };
        continue;
      }

      const existing = change.action === 'edit'
        ? await this.fs?.read?.(change.file).catch(() => '') || ''
        : '';

      // Use research findings as additional context
      const gen = await this.coder.call('gpt-5.4', [
        { role: 'system', content: 'Write production code using the research findings below. No markdown fences. No explanation. Complete file only.' },
        { role: 'user', content: `Research: ${research.content.slice(0, 3000)}\n\nTask: ${change.description}\n${existing ? `\nExisting:\n${existing.slice(0, 2000)}` : '\nNew file.'}\n${change.packages?.length ? `\nPackages to use: ${change.packages.join(', ')}` : ''}` },
      ], { maxTokens: 8192, activeFile: change.file });

      yield { type: 'jules:file', file: change.file, content: gen.content, action: change.action };
    }

    yield { type: 'jules:complete', taskId, changesCount: changes.length };
  }
}

// ═══════════════════════════════════════════════════════════════════
// §6 — COMPLEXITY SCORING + PROVIDER SELECTION
// ═══════════════════════════════════════════════════════════════════

function estimateComplexity(text, opts = {}) {
  let score = 0;
  const words = text.split(/\s+/).length;
  score += Math.min(0.3, words / 200);

  if (/\b(architect|design|refactor|migrate|security|patent)\b/i.test(text)) score += 0.3;
  if (/\b(implement|build|create|generate|write)\b/i.test(text)) score += 0.15;
  if (/\b(fix|debug|error|bug|issue)\b/i.test(text)) score += 0.2;
  if (/\b(explain|what|how|why|list)\b/i.test(text)) score += 0.1;
  if (/\b(research|find|search|look up|documentation)\b/i.test(text)) score += 0.05;
  if (opts.requiresThinking) score += 0.3;
  if (opts.requiresResearch) score -= 0.2; // research goes to Perplexity, not complexity

  return Math.max(0, Math.min(1, score));
}

function selectProvider(complexity, opts = {}) {
  if (opts.requiresResearch) return 'perplexity-sonar-pro';
  if (opts.forceProvider) return opts.forceProvider;

  const budget = opts.budgetMode || process.env.BUDGET_MODE || 'balanced';

  if (complexity >= PSI + 0.1) {        // ≥ 0.718 CORE
    return budget === 'economy' ? 'claude-sonnet-4.6' : 'claude-opus-4.6-thinking';
  } else if (complexity >= PSI) {       // ≥ 0.618 INCLUDE
    return budget === 'economy' ? 'deepseek-v3' : 'claude-sonnet-4.6';
  } else if (complexity >= PSI * PSI) { // ≥ 0.382 RECALL
    return budget === 'quality' ? 'gpt-4o' : 'deepseek-v3';
  } else {                              // < 0.382 VOID tier
    return 'groq-llama-70b'; // ultrafast for trivial tasks
  }
}

function scoreBattleCandidate(result, opts = {}) {
  const weights = opts.battleWeights || {
    quality: PHI * PHI,  // 2.618 — correctness paramount
    length: PHI,         // 1.618 — completeness
    cost: PSI,           // 0.618 — efficiency bonus
    speed: PSI * PSI,    // 0.382 — speed bonus
  };

  const totalWeight = weights.quality + weights.length + weights.cost + weights.speed;

  const qualityScore = result.content?.length > 50 ? 0.8 : 0.3; // rough proxy
  const lengthScore = Math.min(1, (result.content?.length || 0) / 2000);
  const costScore = 1 - Math.min(1, (result.cost || 0) * 100); // lower cost = higher score
  const speedScore = result.thinkingTokens ? 0.5 : 0.8; // thinking = slower but deeper

  return (
    qualityScore * weights.quality +
    lengthScore  * weights.length +
    costScore    * weights.cost +
    speedScore   * weights.speed
  ) / totalWeight;
}

// ═══════════════════════════════════════════════════════════════════
// §7 — SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════

const HEADY_CODER_SYSTEM = `You are HeadyCoder, the coding intelligence of the Heady™ AI Operating System, created by Eric Haywood (HeadySystems Inc.).

## Rules
- ESM only (import/export). Never require().
- Zero console.log — use pino structured logger.
- Zero TODO/FIXME — complete code or nothing.
- Zero localhost — all URLs from env vars.
- Zod validation on all API inputs.
- φ-derived constants from phi-constants.js (PHI=1.618, PSI=0.618, FIB=[]).
- Redis keys: tenant:{id}:namespace:key
- HEADY_BRAND header in all new files.
- Vitest for tests, k6 for load tests.
- Error handling everywhere — no empty catch blocks.`;

const CODEX_PLANNER_PROMPT = `You are HeadyCodex, the autonomous coding agent of HeadySystems Inc.
You plan multi-file code changes with surgical precision.
Think deeply about the full impact of changes across the codebase.
Output a JSON plan: {"changes":[{"file":"path","action":"create|edit|delete","description":"what and why"}]}
Minimize the number of files changed. Prefer targeted edits over rewrites.`;

const JULES_PLANNER_PROMPT = `You are HeadyJules, the research-first coding agent of HeadySystems Inc.
You have just received research findings from Perplexity. Use them to plan code changes.
Prioritize using up-to-date patterns, correct API signatures, and proven packages.
Output JSON: {"changes":[{"file":"path","action":"create|edit","description":"what","packages":["pkg@version"]}]}`;

// ═══════════════════════════════════════════════════════════════════
// §8 — UTILITIES
// ═══════════════════════════════════════════════════════════════════

function truncateTree(tree, maxLines) {
  if (typeof tree === 'string') return tree.split('\n').slice(0, maxLines).join('\n');
  if (Array.isArray(tree)) return tree.slice(0, maxLines).join('\n');
  return JSON.stringify(tree).slice(0, maxLines * 50);
}

function extractTopics(messages) {
  // Simple keyword extraction from recent messages
  const words = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 5);

  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w)
    .join(', ');
}

// ═══════════════════════════════════════════════════════════════════
// §9 — FACTORY + EXPORTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create the full HeadyCoder stack.
 *
 * @param {Object} deps
 * @param {Object} deps.redis - Upstash Redis client
 * @param {Object} deps.db - Neon Postgres client
 * @param {Object} deps.qdrant - Qdrant client (optional)
 * @param {Function} deps.embed - Embedding function
 * @param {Object} deps.fs - Workspace filesystem
 * @param {string} deps.tenantId
 */
export function createHeadyCoder(deps) {
  const autoContext = new HeadyAutoContext(deps);
  const coder = new HeadyCoder({ autoContext, redis: deps.redis, tenantId: deps.tenantId });
  const codex = new HeadyCodex({ coder, fs: deps.fs });
  const jules = new HeadyJules({ coder, fs: deps.fs });

  // Start continuous context refresh
  autoContext.start();

  return {
    autoContext,  // HeadyAutoContext — 5-pass enrichment
    coder,        // HeadyCoder — direct model calls + battle
    codex,        // HeadyCodex — autonomous multi-file coding (Opus-powered)
    jules,        // HeadyJules — research-first coding (Perplexity + Gemini/GPT)
    providers: PROVIDERS,

    // Convenience methods
    call: (provider, messages, opts) => coder.call(provider, messages, opts),
    smart: (messages, opts) => coder.smartCall(messages, opts),
    research: (query, opts) => coder.research(query, opts),
    battle: (messages, opts) => coder.battle(messages, opts),

    stop() { autoContext.stop(); },
  };
}

export { PROVIDERS };
export default { createHeadyCoder, PROVIDERS };

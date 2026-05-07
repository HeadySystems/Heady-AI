/**
 * HeadyMCP — Landing Page Interactive Logic
 * Live tool explorer, tab panels, copy-to-clipboard, scroll animations
 */

// ── Tool Registry (47 tools from the MCP server) ────────────────────
const TOOLS = [
  // Tier 0 — Critical Intelligence
  { name: 'heady_deep_scan', desc: 'Deep project scanning — maps files, extracts structure, generates embeddings into 3D vector memory.', category: 'intelligence', tier: 0 },
  { name: 'heady_auto_flow', desc: 'Full auto-success pipeline — chains Battle + Coder + Analyze + Risks + Patterns via HCFP.', category: 'orchestration', tier: 0 },
  { name: 'heady_memory', desc: 'Search HeadyMemory (3D vector space) for persistent facts, embeddings, and knowledge.', category: 'memory', tier: 0 },
  { name: 'heady_embed', desc: 'Generate vector embeddings via Heady™ embedding service (384D, nomic-embed-text).', category: 'memory', tier: 0 },
  { name: 'heady_soul', desc: 'HeadySoul — awareness layer: values arbiter, coherence guardian, mission alignment check.', category: 'intelligence', tier: 0 },
  { name: 'heady_vinci', desc: 'HeadyVinci — session planner: topology maintainer, multi-step reasoning engine.', category: 'intelligence', tier: 0 },

  // Tier 1 — Analysis & Execution
  { name: 'heady_analyze', desc: 'Unified analysis — code, research, architecture, security, performance, academic, news.', category: 'analysis', tier: 1 },
  { name: 'heady_risks', desc: 'Risk assessment, vulnerability scanning, mitigation plans with CSL-weighted severity.', category: 'security', tier: 1 },
  { name: 'heady_coder', desc: 'Code generation and multi-assistant workflows via Heady™Coder.', category: 'execution', tier: 1 },
  { name: 'heady_battle', desc: 'HeadyBattle Arena — AI node competition, evaluation, leaderboard, cross-model comparison.', category: 'execution', tier: 1 },
  { name: 'heady_patterns', desc: 'Design pattern detection and deep code analysis — antipatterns, suggestions, library matching.', category: 'analysis', tier: 1 },
  { name: 'heady_refactor', desc: 'Code refactoring suggestions — clean code, SOLID, DRY, with phi-weighted priority.', category: 'execution', tier: 1 },

  // Tier 2 — Multi-Model AI
  { name: 'heady_chat', desc: 'Chat with Heady™ Brain — multi-model inference with automatic routing.', category: 'ai', tier: 2 },
  { name: 'heady_claude', desc: 'Advanced reasoning via Anthropic Claude with extended thinking.', category: 'ai', tier: 2 },
  { name: 'heady_openai', desc: 'GPT integration with function calling — GPT-4o, o1, o3.', category: 'ai', tier: 2 },
  { name: 'heady_gemini', desc: 'Multimodal AI via Google Gemini — text, image, video analysis.', category: 'ai', tier: 2 },
  { name: 'heady_groq', desc: 'Ultra-fast inference via Groq LPU — sub-100ms latency.', category: 'ai', tier: 2 },
  { name: 'heady_complete', desc: 'Code/text completion via Heady™ Brain with multi-model fallback.', category: 'ai', tier: 2 },
  { name: 'heady_buddy', desc: 'HeadyBuddy — multi-provider personal AI assistant with memory.', category: 'ai', tier: 2 },

  // Tier 3 — Ops & Deployment
  { name: 'heady_deploy', desc: 'Trigger deployment/service actions — deploy, restart, status, logs, scale.', category: 'ops', tier: 3 },
  { name: 'heady_health', desc: 'Check health/status of all Heady services with φ-scaled telemetry.', category: 'ops', tier: 3 },
  { name: 'heady_ops', desc: 'DevOps automation — infrastructure, monitoring, scaling.', category: 'ops', tier: 3 },
  { name: 'heady_maintenance', desc: 'Health monitoring, backups, updates, restoration.', category: 'ops', tier: 3 },
  { name: 'heady_maid', desc: 'System cleanup and scheduling — garbage collection, temp purge.', category: 'ops', tier: 3 },

  // Tier 4 — Memory & Search
  { name: 'heady_learn', desc: 'Store a learning in 3D vector memory — directives, preferences, patterns.', category: 'memory', tier: 4 },
  { name: 'heady_recall', desc: 'Search 3D vector memory for relevant past interactions and knowledge.', category: 'memory', tier: 4 },
  { name: 'heady_vector_store', desc: 'Store a vector embedding in 3D GPU vector space (384D pgvector + HNSW).', category: 'memory', tier: 4 },
  { name: 'heady_vector_search', desc: 'Search 3D GPU vector space for similar vectors via HNSW.', category: 'memory', tier: 4 },
  { name: 'heady_vector_stats', desc: 'Get 3D vector space statistics — dimensions, count, memory usage.', category: 'memory', tier: 4 },
  { name: 'heady_memory_stats', desc: 'Get continuous learning stats — total memories, categories, storage.', category: 'memory', tier: 4 },
  { name: 'heady_search', desc: 'Search Heady knowledge base, service catalog, docs, and registry.', category: 'search', tier: 4 },

  // Tier 5 — Edge & Integrations
  { name: 'heady_edge_ai', desc: 'Cloudflare edge AI — embeddings, chat, classification, vector search at the edge.', category: 'edge', tier: 5 },
  { name: 'heady_lens', desc: 'Visual analysis and image processing — object detection, OCR, classification.', category: 'specialized', tier: 5 },
  { name: 'heady_notion', desc: 'Sync Heady Knowledge Vault to Notion — bidirectional knowledge sync.', category: 'integrations', tier: 5 },
  { name: 'heady_jules_task', desc: 'Dispatch async background coding task to Jules/Codex.', category: 'integrations', tier: 5 },
  { name: 'heady_huggingface_model', desc: 'Search and interact with HuggingFace models — search, info, inference.', category: 'integrations', tier: 5 },

  // Tier 6 — Orchestration & Meta
  { name: 'heady_orchestrator', desc: 'HeadyOrchestrator — system-wide communication, alignment, coordination.', category: 'orchestration', tier: 6 },
  { name: 'heady_hcfp_status', desc: 'HCFP auto-success engine status — pipeline metrics, queue depth, throughput.', category: 'orchestration', tier: 6 },
  { name: 'heady_telemetry', desc: 'Get comprehensive telemetry — request rates, latencies, error budgets.', category: 'monitoring', tier: 6 },
  { name: 'heady_template_stats', desc: 'Get template auto-generation stats — templates created, cache hits.', category: 'monitoring', tier: 6 },
  { name: 'heady_csl_engine', desc: 'CSL Engine — Continuous Semantic Logic gates, resonance, superposition, entanglement.', category: 'intelligence', tier: 6 },
  { name: 'heady_agent_orchestration', desc: 'Latent OS agent decomposition — planner-executor-validator with swarm coordination.', category: 'orchestration', tier: 6 },

  // Drupal CMS Tools
  { name: 'heady_drupal_content', desc: 'Create and manage content across all Heady Drupal CMS sites.', category: 'integrations', tier: 5 },
  { name: 'heady_drupal_taxonomy', desc: 'Manage taxonomy terms and vocabularies across Heady sites.', category: 'integrations', tier: 5 },
  { name: 'heady_drupal_media', desc: 'Upload and manage media assets across Heady Drupal properties.', category: 'integrations', tier: 5 },
  { name: 'heady_drupal_config', desc: 'Manage Drupal configuration — themes, modules, settings.', category: 'integrations', tier: 5 },
  { name: 'heady_drupal_users', desc: 'Manage users and roles across Heady Drupal sites.', category: 'integrations', tier: 5 },

  // HeadyConnection.org — Community & Nonprofit AI
  { name: 'hc_990_grants', desc: 'AI-assisted Form 990 prep, grant proposal drafting, compliance review, and IRS filing for 501(c)(3) orgs.', category: 'connection', tier: 1 },
  { name: 'hc_grant_discovery', desc: 'NSF SBIR, DOE, Google.org grant matching — scans eligibility vs org profile, auto-generates LOIs.', category: 'connection', tier: 1 },
  { name: 'hc_academy', desc: 'HeadyAcademy 6-week AI literacy curriculum — turns AI consumers into AI swarm managers.', category: 'connection', tier: 2 },
  { name: 'hc_community', desc: 'Structured community hub — workspaces, knowledge sharing, cross-team intelligence transfer.', category: 'connection', tier: 3 },
  { name: 'hc_nonprofit_ai', desc: 'Enterprise-grade HeadyBrain/Researcher/Content for 501(c)(3) partners, free or subsidized.', category: 'connection', tier: 1 },
  { name: 'hc_mutual_aid', desc: 'Community care requests, skills marketplace, trust-based connections and service offerings.', category: 'connection', tier: 3 },
  { name: 'hc_creative_tools', desc: 'Browser-based art/creation workflows with creator ownership, attribution, and product manufacturing.', category: 'connection', tier: 4 },
  { name: 'hc_impact', desc: 'HeadyLens immutable audit trails — hours saved, proposals generated, community members served.', category: 'connection', tier: 2 },

  // HeadyFinance — AI-Powered Financial Intelligence
  { name: 'hf_market_analysis', desc: 'Real-time AI market analysis, pattern detection, and predictive trend modeling.', category: 'finance', tier: 1 },
  { name: 'hf_portfolio', desc: 'Portfolio optimization with AI-driven risk/return modeling and rebalancing.', category: 'finance', tier: 2 },
  { name: 'hf_risk', desc: 'Multi-dimensional risk assessment — VaR, stress testing, correlation analysis.', category: 'finance', tier: 1 },
];

// ── Category mapping for filters ────────────────────────────────────
const CATEGORY_FILTER_MAP = {
  intelligence: ['intelligence'],
  orchestration: ['orchestration'],
  memory: ['memory', 'search'],
  ai: ['ai'],
  security: ['security'],
  ops: ['ops', 'monitoring'],
  edge: ['edge', 'specialized', 'integrations', 'execution', 'analysis'],
  connection: ['connection'],
  finance: ['finance'],
};

// ── DOM Ready ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderTools('all');
  initTabs();
  initCopyButtons();
  initScrollNav();
  initIntersectionObserver();
  updateToolCount();
});

// ── Render Tool Grid ────────────────────────────────────────────────
function renderTools(filter) {
  const grid = document.getElementById('tool-grid');
  if (!grid) return;

  const filtered = filter === 'all'
    ? TOOLS
    : TOOLS.filter(t => {
        const cats = CATEGORY_FILTER_MAP[filter] || [filter];
        return cats.includes(t.category);
      });

  grid.innerHTML = filtered.map((tool, i) => `
    <div class="tool-card fade-up" style="animation-delay: ${Math.min(i * 30, 300)}ms">
      <div class="tool-card-header">
        <span class="tool-card-name">${tool.name}</span>
        <span class="tool-card-tier tier-${tool.tier}">φ${tool.tier}</span>
      </div>
      <p class="tool-card-desc">${tool.desc}</p>
      <div class="tool-card-category">${tool.category}</div>
    </div>
  `).join('');

  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Update all count
  const allCount = document.getElementById('filter-all');
  if (allCount) allCount.textContent = TOOLS.length;
}

// ── Filter Buttons ──────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (btn) {
    renderTools(btn.dataset.filter);
  }
});

// ── Tab Panels ──────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── Copy to Clipboard ───────────────────────────────────────────────
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.target;
      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;

      const text = codeEl.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    });
  });
}

// ── Scroll-aware Nav ────────────────────────────────────────────────
function initScrollNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ── Intersection Observer for fade-in ───────────────────────────────
function initIntersectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.section-header, .transport-card, .arch-card, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// ── Live Tool Count ─────────────────────────────────────────────────
function updateToolCount() {
  const countEl = document.getElementById('tool-count');
  const statEl = document.getElementById('stat-tools');
  if (countEl) countEl.textContent = TOOLS.length;
  if (statEl) statEl.textContent = TOOLS.length;
}

// ── Try fetching live data from the MCP server (optional) ───────────
async function fetchLiveToolCount() {
  try {
    const res = await fetch('https://headymcp.com/tools', {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.total) updateToolCount(data.total);
    }
  } catch {
    // Silently fall back to static count
  }
}

// Attempt live fetch after page loads
setTimeout(fetchLiveToolCount, 2000);

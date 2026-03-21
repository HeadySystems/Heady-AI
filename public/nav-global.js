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
// ║  FILE: public/nav-global.js                                                    ║
// ║  LAYER: ui/public                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyOS Global Navigation — Injected into every page
 * Sacred Geometry v4.0 — φ-scaled spacing, glass morphism
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
(function() {
  const SITE_URL = 'https://www.heady.systems';
  const PAGES = [
    { href: '/', label: 'Home', icon: '⌂', group: 'core' },
    { href: '/about.html', label: 'About', icon: '∞', group: 'core' },
    { href: '/pricing.html', label: 'Pricing', icon: '◈', group: 'core' },
    { href: '/documentation.html', label: 'Docs', icon: '📖', group: 'core' },
    { href: '/api-docs.html', label: 'API', icon: '⚡', group: 'developers' },
    { href: '/developer-guide.html', label: 'Dev Guide', icon: '🛠', group: 'developers' },
    { href: '/integrations.html', label: 'Integrations', icon: '🔗', group: 'developers' },
    { href: '/headyos-desktop.html', label: 'Desktop', icon: '🖥', group: 'products' },
    { href: '/headyos-mobile.html', label: 'Mobile', icon: '📱', group: 'products' },
    { href: '/headybuddy-integrated.html', label: 'HeadyBuddy', icon: '🤖', group: 'products' },
    { href: '/onboarding.html', label: 'Onboarding', icon: '🚀', group: 'products' },
    { href: '/pipeline.html', label: 'Pipeline', icon: '⟐', group: 'system' },
    { href: '/forge.html', label: 'Forge', icon: '⬡', group: 'system' },
    { href: '/brain.html', label: 'Brain', icon: '🧠', group: 'system' },
    { href: '/briefing.html', label: 'Briefing', icon: '☀', group: 'system' },
    { href: '/swarm.html', label: 'Swarm', icon: '🐝', group: 'system' },
    { href: '/arena.html', label: 'Arena', icon: '⚔', group: 'system' },
    { href: '/liquid-nodes.html', label: 'Liquid Nodes', icon: '💧', group: 'system' },
    { href: '/translator.html', label: 'Translator', icon: '🌐', group: 'system' },
    { href: '/latent-space.html', label: 'Latent Space', icon: '◉', group: 'system' },
    { href: '/dreams.html', label: 'Dreams', icon: '💜', group: 'system' },
    { href: '/memory-palace.html', label: 'Memory Palace', icon: '⬡', group: 'system' },
    { href: '/colab.html', label: 'Colab Ops', icon: '☁', group: 'system' },
    { href: '/mcp-dashboard.html', label: 'MCP', icon: '⬡', group: 'system' },
    { href: '/gateway.html', label: 'Gateway', icon: '⛩', group: 'system' },
    { href: '/timeline.html', label: 'Timeline', icon: '⟳', group: 'system' },
    { href: '/docker-orchestrator.html', label: 'Docker', icon: '🐳', group: 'system' },
    { href: '/identity.html', label: 'Identity', icon: '◎', group: 'system' },
    { href: '/ecosystem.html', label: 'Ecosystem', icon: '∞', group: 'core' },
    { href: '/huggingface.html', label: 'HuggingFace', icon: '🤗', group: 'products' },
    { href: '/discord.html', label: 'Discord', icon: '🎮', group: 'products' },
    { href: '/vault.html', label: 'Vault', icon: '🔐', group: 'products' },
    { href: '/sacred-geometry.html', label: 'Design System', icon: 'φ', group: 'resources' },
    { href: '/security.html', label: 'Security', icon: '🛡', group: 'resources' },
    { href: '/patents.html', label: 'Patents', icon: '📜', group: 'resources' },
    { href: '/changelog.html', label: 'Changelog', icon: '📋', group: 'resources' },
    { href: '/blog.html', label: 'Blog', icon: '✍', group: 'resources' },
    { href: '/team.html', label: 'Team', icon: '👥', group: 'resources' },
    { href: '/status.html', label: 'Status', icon: '●', group: 'resources' },
    { href: '/contact.html', label: 'Contact', icon: '✉', group: 'resources' },
    { href: '/auth.html', label: 'Sign In', icon: '→', group: 'auth' },
  ];

  const GROUPS = {
    core: 'Heady',
    products: 'Products',
    system: 'System',
    developers: 'Developers',
    resources: 'Resources',
    auth: ''
  };

  const currentPath = window.location.pathname;
  const currentPage = PAGES.find((p) => p.href === currentPath) || PAGES.find((p) => p.href === '/');
  const pageTitle = document.title || (currentPage ? `${currentPage.label} | Heady Systems` : 'Heady Systems');
  const pageDescriptionByPath = {
    '/': 'Heady Systems is an intelligent orchestration platform for product teams building cloud-native workflows, secure automation, and reliable AI operations.',
    '/index.html': 'Heady Systems is an intelligent orchestration platform for product teams building cloud-native workflows, secure automation, and reliable AI operations.',
    '/auth.html': 'Sign in to Heady Systems to manage environments, run orchestrations, review status, and onboard your team with secure access controls.',
    '/status.html': 'Monitor uptime, response times, and service health across Heady Systems with live status checks and operational diagnostics.',
    '/headyos-desktop.html': 'Explore HeadyOS Desktop for real-time orchestration, workspace controls, and agent-driven operations in one command center.',
    '/headyos-mobile.html': 'Use HeadyOS Mobile to monitor services, run workflows, and coordinate team operations from anywhere with secure access.',
    '/headybuddy-integrated.html': 'HeadyBuddy integrates conversational support with operational context so teams can act on system data faster.',
    '/docker-orchestrator.html': 'Run repeatable container workflows with Heady Docker Orchestrator, from deployment plans to runtime diagnostics.',
    '/mcp-dashboard.html': 'Track MCP tools, node health, and protocol operations in the Heady MCP Dashboard for production coordination.',
    '/onboarding.html': 'Start quickly with Heady onboarding guides, architecture checkpoints, and setup paths for developers and operators.',
    '/integrations.html': 'Connect cloud tools, messaging platforms, storage systems, and custom APIs with Heady Integrations.'
  };
  const defaultDescription = 'Heady Systems helps teams orchestrate services, automate workflows, and ship reliable AI-powered operations with strong security and observability.';
  const pageDescription = pageDescriptionByPath[currentPath] || pageDescriptionByPath['/index.html'] || defaultDescription;
  const h1ByPath = {
    '/status.html': 'Heady Systems Status and Reliability Center',
    '/headyos-desktop.html': 'HeadyOS Desktop Operations Workspace',
    '/headyos-mobile.html': 'HeadyOS Mobile Operations Console',
    '/mcp-dashboard.html': 'MCP Dashboard for Service and Tool Health'
  };
  const enrichmentTextByPath = {
    '/': [
      'Heady Systems is designed for teams that need one place to plan, execute, and monitor complex operations without losing visibility. The platform brings orchestration, observability, and secure collaboration into a single workflow so engineering, operations, and product teams can move together instead of operating in separate dashboards.',
      'At the platform layer, Heady combines health monitoring, workflow execution, and integration routing. Teams can validate environment readiness, trigger automated runs, and watch key service metrics in real time. This removes handoffs that usually slow delivery, especially when incidents, release windows, and compliance checks happen at the same time.',
      'Heady also supports a practical onboarding path. New contributors can understand architecture, map dependencies, and find the next operational action quickly. Built-in navigation between documentation, API references, status views, and onboarding pages helps people stay oriented as they move from learning mode into production work.',
      'From a reliability perspective, the system emphasizes clear signals and repeatable operations. Health endpoints, workflow stages, and service-specific checks are surfaced in a consistent way so teams can detect regressions early and remediate faster. The goal is not just to run tasks, but to make every run measurable and explainable.',
      'For organizations scaling AI and automation, Heady provides a durable control plane: structured access, operational context, and pathways to expand integrations without breaking core delivery workflows. If you are evaluating Heady for your team, begin with onboarding, review the status and security pages, and connect your first integration to validate value quickly.'
    ],
    '/auth.html': [
      'Authentication in Heady is built for production operations, not just account access. Teams depend on sign-in flows to protect service controls, deployment actions, and environment-level data, so this page supports secure access without adding unnecessary friction. Whether a user logs in with credentials or API key workflows, the goal is a predictable and auditable entry point.',
      'The sign-in experience is tied to role-aware onboarding. After authentication, users are directed to guided flows that explain workspace context, operational permissions, and system navigation. This reduces the chance of accidental misconfiguration and helps new team members become productive faster while staying aligned with platform safeguards.',
      'For operators and engineering leads, authentication quality directly affects incident response. During urgent events, users need to enter quickly, verify status, and take action with confidence. Heady therefore treats auth as part of reliability: clear error states, understandable validation, and stable redirect logic that routes users to the right next step.',
      'Security controls are reinforced by token management and environment-aware APIs. Sessions support access to orchestration endpoints, diagnostics, and service controls while maintaining the boundaries expected in modern cloud operations. Authentication is one layer in a broader trust model that includes monitoring, policy, and endpoint verification.',
      'If you are setting up access for a team, start by creating operational accounts, validate onboarding redirects, and review security documentation for key handling and role practices. From here, continue to onboarding and status views so authenticated users can immediately verify system health and contribute safely.'
    ],
    '/status.html': [
      'The status center gives teams a shared operational truth. Instead of collecting health information from scattered tools, this page brings core service checks, response times, and uptime signals into one place so everyone sees the same state before decisions are made. This is especially valuable during releases and active incident windows.',
      'A good status workflow is not only about red or green indicators. Teams need context: when a check last ran, which endpoint failed, and whether degradation affects user-facing services or internal tooling. Heady status reporting is structured to support triage, escalation, and communication without forcing engineers to manually stitch evidence together.',
      'Operational reliability also improves when status pages are part of daily habits. Product and engineering teams can review trends before planning work, verify environment readiness before deployments, and confirm recovery after mitigations. This creates a feedback loop where status data actively influences delivery quality.',
      'Heady pairs status visibility with actionable navigation. From this page, teams can move directly to documentation, security policies, and contact paths when they need support or coordination. These links reduce dead ends and accelerate the move from detection to response.',
      'For best results, treat status review as a recurring practice: check key services before major launches, monitor response-time drift, and document any recurring degradations so they can be addressed in roadmap planning. A consistent status routine is one of the fastest ways to improve platform confidence across the organization.'
    ],
    '/headyos-desktop.html': [
      'HeadyOS Desktop is designed as an operations workspace where teams can coordinate workflows, observe system behavior, and execute actions from a single interface. It brings together pipeline context, runtime visibility, and agent-assisted commands so routine work and urgent responses can happen with less context switching.',
      'For engineering teams, desktop workflows provide faster iteration because state is visible while actions are executed. You can inspect system status, review telemetry, and launch orchestrations without jumping between disconnected tools. This helps reduce human error and keeps execution aligned with the current environment conditions.',
      'The desktop model is particularly useful for incident handling. Operators can maintain a stable command view, coordinate notes, and validate post-change behavior in real time. Because status and execution are connected, teams can move from detection to remediation with better confidence and clear operational breadcrumbs.',
      'Beyond incident workflows, HeadyOS Desktop supports day-to-day delivery: integration checks, pipeline diagnostics, and developer handoffs. New contributors can use the same interface to understand service relationships and verify that planned changes are safe to roll out.',
      'If your team is introducing desktop operations, start with one critical workflow, define expected success signals, and then expand to broader orchestration tasks. This phased adoption keeps risk low while proving measurable value through faster execution and clearer decision-making.'
    ],
    '/integrations.html': [
      'Integrations determine how quickly a platform becomes useful. Heady focuses on practical, production-ready connections that let teams combine communication tools, cloud providers, storage systems, and custom APIs into one orchestrated workflow. The objective is to reduce manual glue code while preserving control and visibility.',
      'Each integration should support operational goals, not just connectivity. Teams need to know if a connector is active, what data it exchanges, and how failures are surfaced. Heady integration cards and status states provide this context so teams can assess readiness before relying on an integration in a critical path.',
      'A strong integration strategy also includes change management. As teams add endpoints and services, they need a consistent process for validation, rollout, and rollback. Heady complements connector setup with documentation links, onboarding pathways, and service status references so implementation and operations stay aligned.',
      'For organizations building custom connections, Heady supports an extensible model with protocol flexibility and clear implementation patterns. This makes it easier to add domain-specific systems without reinventing orchestration logic or sacrificing observability.',
      'To get started, choose one high-impact integration, validate its behavior in your normal workflow, and define measurable success criteria such as reduced handoff time or faster incident coordination. Then expand deliberately to keep the integration layer stable as your ecosystem grows.'
    ]
  };
  const defaultEnrichmentText = [
    'Heady Systems is built to help teams run complex operations with confidence. The platform centralizes service status, workflow orchestration, and operational context so teams can make decisions based on live data instead of fragmented signals.',
    'When systems grow, coordination becomes the limiting factor. Heady addresses this by connecting planning, execution, and verification in one experience. Teams can move from idea to implementation while keeping security, observability, and reliability in focus.',
    'Production workflows require repeatability. Heady supports repeatable operating patterns by exposing health checks, integration state, and guided pathways between documentation and execution pages. This reduces guesswork and helps contributors understand what to do next.',
    'The platform is also designed for onboarding and scale. New members can navigate critical pages quickly, while experienced operators can run deeper diagnostics and orchestrations without losing context.',
    'Use this page as a launch point: review the linked docs, validate status, and continue to onboarding or contact channels to align next steps for your team.'
  ];
  const enrichmentCtaByPath = {
    '/auth.html': { href: '/onboarding.html', label: 'Continue to Guided Onboarding' },
    '/status.html': { href: '/contact.html', label: 'Report an Incident or Ask for Help' },
    '/integrations.html': { href: '/documentation.html', label: 'Review Integration Docs' },
    '/headyos-desktop.html': { href: '/contact.html', label: 'Request a Desktop Operations Walkthrough' },
    '/headyos-mobile.html': { href: '/onboarding.html', label: 'Set Up Mobile Operations Access' }
  };

  function isActive(href) {
    if (href === '/') return currentPath === '/' || currentPath === '/index.html';
    return currentPath === href;
  }

  function ensureMetaTag(attrName, attrValue, content) {
    let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function ensureCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  function ensureSeoAndSchema() {
    const canonical = `${SITE_URL}${currentPath === '/' ? '/' : currentPath}`;
    ensureMetaTag('name', 'description', pageDescription);
    ensureMetaTag('property', 'og:title', pageTitle);
    ensureMetaTag('property', 'og:description', pageDescription);
    ensureMetaTag('property', 'og:type', 'website');
    ensureMetaTag('property', 'og:url', canonical);
    ensureMetaTag('property', 'og:image', `${SITE_URL}/assets/heady-og.svg`);
    ensureMetaTag('name', 'twitter:card', 'summary_large_image');
    ensureMetaTag('name', 'twitter:title', pageTitle);
    ensureMetaTag('name', 'twitter:description', pageDescription);
    ensureMetaTag('name', 'twitter:image', `${SITE_URL}/assets/heady-og.svg`);
    ensureCanonical(canonical);

    if (!document.head.querySelector('script[data-heady-schema="organization"]')) {
      const orgSchema = document.createElement('script');
      orgSchema.type = 'application/ld+json';
      orgSchema.dataset.headySchema = 'organization';
      orgSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Heady Systems',
        url: SITE_URL,
        logo: `${SITE_URL}/assets/heady-og.svg`,
        sameAs: ['https://github.com/HeadySystems'],
        contactPoint: [{
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@heady.systems'
        }]
      });
      document.head.appendChild(orgSchema);
    }

    if (!document.head.querySelector('script[data-heady-schema="webpage"]')) {
      const pageSchema = document.createElement('script');
      pageSchema.type = 'application/ld+json';
      pageSchema.dataset.headySchema = 'webpage';
      pageSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: pageTitle,
        description: pageDescription,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Heady Systems',
          url: SITE_URL
        }
      });
      document.head.appendChild(pageSchema);
    }
  }

  function estimateBodyWordCount() {
    const text = (document.body.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.split(' ').length : 0;
  }

  function ensureAccessibleHeading() {
    if (document.querySelector('h1')) return;
    const heading = document.createElement('h1');
    heading.className = 'heady-sr-only';
    heading.textContent = h1ByPath[currentPath] || `${currentPage ? currentPage.label : 'Heady'} | Heady Systems`;
    document.body.insertBefore(heading, document.body.firstChild);
  }

  function ensureEnrichmentSection() {
    if (estimateBodyWordCount() >= 500) return;
    if (document.getElementById('heady-content-enrichment')) return;
    const content = enrichmentTextByPath[currentPath] || defaultEnrichmentText;
    const cta = enrichmentCtaByPath[currentPath] || { href: '/onboarding.html', label: 'Start With Heady Onboarding' };
    const section = document.createElement('section');
    section.id = 'heady-content-enrichment';
    section.className = 'heady-content-enrichment';
    section.innerHTML = `
      <div class="heady-content-enrichment-inner">
        <h2>Operational Guide for This Page</h2>
        ${content.map((paragraph) => `<p>${paragraph}</p>`).join('')}
        <p>For additional implementation standards, we recommend reviewing the <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide" target="_blank" rel="noopener noreferrer">Google Search Essentials guidance</a> and applying it alongside your internal release checklists.</p>
        <div class="heady-content-links">
          <a href="/documentation.html">Read Documentation</a>
          <a href="/api-docs.html">Explore API Endpoints</a>
          <a href="/security.html">Review Security Practices</a>
        </div>
        <a class="heady-content-cta" href="${cta.href}">${cta.label}</a>
      </div>
    `;
    const footer = document.getElementById('heady-global-footer');
    if (footer) {
      document.body.insertBefore(section, footer);
    } else {
      document.body.appendChild(section);
    }
  }

  function wireDeadEndButtons() {
    const labelRouteRules = [
      { pattern: /docs?/i, href: '/documentation.html' },
      { pattern: /api/i, href: '/api-docs.html' },
      { pattern: /configure|enable|connect/i, href: '/integrations.html' },
      { pattern: /build|start/i, href: '/onboarding.html' },
      { pattern: /contact|help|support/i, href: '/contact.html' },
      { pattern: /sign in|login/i, href: '/auth.html' }
    ];

    document.querySelectorAll('button').forEach((button) => {
      if (button.dataset.headyAutowire === 'true') return;
      if (button.hasAttribute('onclick') || button.hasAttribute('form') || button.hasAttribute('aria-controls') || button.hasAttribute('data-action')) return;
      if (button.getAttribute('type') === 'submit') return;
      if (!button.getAttribute('type')) button.setAttribute('type', 'button');

      const label = (button.textContent || '').trim();
      if (!label) return;
      const rule = labelRouteRules.find((entry) => entry.pattern.test(label));
      if (!rule) return;
      button.dataset.headyAutowire = 'true';
      button.addEventListener('click', () => {
        window.location.href = rule.href;
      });
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    #heady-global-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: rgba(10, 14, 39, 0.92);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(0, 255, 200, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.3s cubic-bezier(0.618, 0, 0.382, 1);
    }
    #heady-global-nav.nav-hidden { transform: translateY(-100%); }
    .heady-nav-inner {
      max-width: 1400px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; height: 55px;
    }
    .heady-nav-brand {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: #fff; font-weight: 700; font-size: 18px;
    }
    .heady-nav-brand-logo {
      width: 34px; height: 34px; border-radius: 50%;
      background: conic-gradient(from 0deg, #00ffc8, #ff00c8, #d4af37, #00ffc8);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 800; color: #0a0e27;
      box-shadow: 0 0 15px rgba(0,255,200,0.4);
    }
    .heady-nav-links {
      display: flex; align-items: center; gap: 4px; flex-wrap: nowrap;
    }
    .heady-nav-group {
      position: relative;
    }
    .heady-nav-group-btn {
      background: none; border: none; color: rgba(255,255,255,0.7);
      font-size: 13px; padding: 8px 12px; cursor: pointer;
      border-radius: 8px; transition: all 0.2s;
      font-family: inherit; display: flex; align-items: center; gap: 4px;
    }
    .heady-nav-group-btn:hover, .heady-nav-group-btn.active {
      background: rgba(0,255,200,0.1); color: #00ffc8;
    }
    .heady-nav-group-btn .arrow { font-size: 8px; transition: transform 0.2s; }
    .heady-nav-group:hover .arrow { transform: rotate(180deg); }
    .heady-nav-dropdown {
      display: none; position: absolute; top: 100%; left: 0;
      background: rgba(10, 14, 39, 0.96); backdrop-filter: blur(20px);
      border: 1px solid rgba(0,255,200,0.2); border-radius: 12px;
      padding: 8px; min-width: 200px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .heady-nav-group:hover .heady-nav-dropdown { display: block; }
    .heady-nav-dropdown a {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; color: rgba(255,255,255,0.8);
      text-decoration: none; border-radius: 8px; font-size: 13px;
      transition: all 0.15s;
    }
    .heady-nav-dropdown a:hover {
      background: rgba(0,255,200,0.1); color: #00ffc8;
    }
    .heady-nav-dropdown a.nav-active {
      background: rgba(0,255,200,0.15); color: #00ffc8;
      border-left: 2px solid #00ffc8;
    }
    .heady-nav-dropdown .nav-icon { font-size: 16px; width: 24px; text-align: center; }
    .heady-nav-signin {
      background: linear-gradient(135deg, #00ffc8, #00c8ff);
      color: #0a0e27 !important; font-weight: 600; border-radius: 20px !important;
      padding: 7px 18px !important; font-size: 12px !important;
      text-decoration: none; transition: all 0.2s;
    }
    .heady-nav-signin:hover { box-shadow: 0 0 20px rgba(0,255,200,0.5); transform: scale(1.05); }
    .heady-nav-mobile-toggle {
      display: none; background: none; border: none; color: #fff;
      font-size: 24px; cursor: pointer; padding: 8px;
    }
    @media (max-width: 900px) {
      .heady-nav-links { display: none; }
      .heady-nav-links.open {
        display: flex; flex-direction: column; position: absolute;
        top: 55px; left: 0; right: 0; background: rgba(10,14,39,0.98);
        padding: 20px; gap: 4px; border-bottom: 1px solid rgba(0,255,200,0.2);
      }
      .heady-nav-mobile-toggle { display: block; }
      .heady-nav-group:hover .heady-nav-dropdown { position: static; box-shadow: none; border: none; }
    }
    body { padding-top: 55px !important; }
    .heady-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
      white-space: nowrap;
    }
    .heady-content-enrichment {
      position: relative;
      z-index: 1;
      margin: 30px auto 0;
      padding: 20px;
      max-width: 1100px;
    }
    .heady-content-enrichment-inner {
      border: 1px solid rgba(0,255,200,0.2);
      background: rgba(10,14,39,0.82);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(8px);
    }
    .heady-content-enrichment h2 {
      font-size: 1.35rem;
      margin-bottom: 16px;
      color: #00ffc8;
    }
    .heady-content-enrichment p {
      color: rgba(255,255,255,0.82);
      margin-bottom: 12px;
      line-height: 1.75;
      font-size: 0.98rem;
    }
    .heady-content-enrichment a {
      color: #00ffc8;
    }
    .heady-content-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin: 14px 0 20px;
    }
    .heady-content-links a {
      display: inline-block;
      text-decoration: none;
      font-size: 0.88rem;
      border: 1px solid rgba(0,255,200,0.25);
      border-radius: 999px;
      padding: 8px 14px;
      background: rgba(0,255,200,0.08);
    }
    .heady-content-cta {
      display: inline-block;
      text-decoration: none;
      border-radius: 999px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #00ffc8, #00c8ff);
      color: #06111f !important;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    /* Footer */
    #heady-global-footer {
      background: rgba(10, 14, 39, 0.95); border-top: 1px solid rgba(0,255,200,0.1);
      padding: 60px 20px 30px; margin-top: 80px; position: relative; z-index: 1;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .footer-inner { max-width: 1400px; margin: 0 auto; }
    .footer-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 40px; margin-bottom: 40px;
    }
    .footer-col h4 { color: #00ffc8; font-size: 14px; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase; }
    .footer-col a {
      display: block; color: rgba(255,255,255,0.6); text-decoration: none;
      font-size: 13px; padding: 4px 0; transition: color 0.2s;
    }
    .footer-col a:hover { color: #00ffc8; }
    .footer-bottom {
      border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 10px;
    }
    .footer-copyright { color: rgba(255,255,255,0.4); font-size: 12px; }
    .footer-badges { display: flex; gap: 8px; }
    .footer-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 10px;
      background: rgba(0,255,200,0.1); color: #00ffc8; border: 1px solid rgba(0,255,200,0.2);
    }
  `;
  document.head.appendChild(style);

  // Build nav
  const nav = document.createElement('nav');
  nav.id = 'heady-global-nav';
  const grouped = {};
  PAGES.forEach(p => {
    if (!grouped[p.group]) grouped[p.group] = [];
    grouped[p.group].push(p);
  });

  let linksHtml = '';
  Object.entries(GROUPS).forEach(([key, label]) => {
    if (key === 'auth') {
      const authPage = grouped.auth?.[0];
      if (authPage) linksHtml += `<a href="${authPage.href}" class="heady-nav-signin">${authPage.label}</a>`;
      return;
    }
    const items = grouped[key] || [];
    if (!items.length) return;
    const hasActive = items.some(p => isActive(p.href));
    linksHtml += `<div class="heady-nav-group">
      <button class="heady-nav-group-btn ${hasActive ? 'active' : ''}">${label} <span class="arrow">▾</span></button>
      <div class="heady-nav-dropdown">${items.map(p =>
        `<a href="${p.href}" class="${isActive(p.href) ? 'nav-active' : ''}"><span class="nav-icon">${p.icon}</span>${p.label}</a>`
      ).join('')}</div>
    </div>`;
  });

  nav.innerHTML = `<div class="heady-nav-inner">
    <a href="/" class="heady-nav-brand"><div class="heady-nav-brand-logo">H</div>HeadyOS</a>
    <div class="heady-nav-links" id="navLinks">${linksHtml}</div>
    <button class="heady-nav-mobile-toggle" onclick="document.getElementById('navLinks').classList.toggle('open')">☰</button>
  </div>`;

  document.body.prepend(nav);

  // Auto-hide on scroll
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const curr = window.scrollY;
    nav.classList.toggle('nav-hidden', curr > lastScroll && curr > 100);
    lastScroll = curr;
  });

  // Build footer
  const footer = document.createElement('footer');
  footer.id = 'heady-global-footer';
  footer.innerHTML = `<div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-col"><h4>Platform</h4>
        <a href="/headyos-desktop.html">HeadyOS Desktop</a><a href="/headyos-mobile.html">HeadyOS Mobile</a>
        <a href="/headybuddy-integrated.html">HeadyBuddy AI</a><a href="/pricing.html">Pricing</a>
        <a href="/ecosystem.html">Ecosystem</a>
      </div>
      <div class="footer-col"><h4>System</h4>
        <a href="/pipeline.html">HCFullPipeline</a><a href="/brain.html">System Brain</a>
        <a href="/swarm.html">HeadyBee Swarm</a><a href="/liquid-nodes.html">Liquid Nodes</a>
        <a href="/translator.html">Protocol Translator</a><a href="/latent-space.html">Latent Space</a>
      </div>
      <div class="footer-col"><h4>Developers</h4>
        <a href="/documentation.html">Documentation</a><a href="/api-docs.html">API Reference</a>
        <a href="/developer-guide.html">Developer Guide</a><a href="/integrations.html">Integrations</a>
        <a href="/mcp-dashboard.html">MCP Dashboard</a><a href="/sacred-geometry.html">Design System</a>
      </div>
      <div class="footer-col"><h4>Community</h4>
        <a href="/huggingface.html">HuggingFace</a><a href="/discord.html">Discord</a>
        <a href="/about.html">About</a><a href="/team.html">Team</a>
        <a href="/blog.html">Blog</a><a href="/patents.html">Patents (51)</a>
        <a href="/security.html">Security</a><a href="/contact.html">Contact</a>
        <a href="/changelog.html">Changelog</a><a href="/status.html">Status</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copyright">© 2026 HeadySystems Inc. — Eric Haywood, Founder — Sacred Geometry v4.0</span>
      <div class="footer-badges">
        <span class="footer-badge">φ 1.618</span>
        <span class="footer-badge">51 Patents</span>
        <span class="footer-badge">Post-Quantum</span>
      </div>
    </div>
  </div>`;
  document.body.appendChild(footer);
  ensureSeoAndSchema();
  ensureAccessibleHeading();
  ensureEnrichmentSection();
  wireDeadEndButtons();
})();

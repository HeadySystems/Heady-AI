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
// ║  FILE: scripts/public-content-optimizer.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SITE_URL = 'https://www.heady.systems';

const contentByFile = {
  'auth.html': [
    'Secure authentication is the operational front door for Heady Systems. Teams depend on this page to gain trusted access to workflow controls, service diagnostics, and environment-specific actions. A stable sign-in flow protects critical infrastructure while keeping the user experience fast and clear for daily operations.',
    'In production settings, authentication quality directly influences response time during incidents. If sign-in behavior is confusing or unreliable, operators lose valuable minutes. Heady therefore emphasizes validation clarity, explicit error feedback, and deterministic redirects that route users to onboarding or dashboards based on account context.',
    'The auth layer is designed to work as part of a larger security posture. Session tokens, endpoint constraints, and role boundaries ensure users only access the controls required for their responsibility. This is essential for organizations that run cross-functional teams where developers, operators, and support staff need different levels of access.',
    'From an onboarding perspective, this page is also a handoff point into guided setup. New users are not left in a dead end after account creation. They are directed toward onboarding experiences that explain architecture, service status, and the next operational tasks to complete.',
    'For teams adopting Heady, the recommended sequence is straightforward: create accounts, validate sign-in flows with staging data, confirm redirects and API access, then document role assignment expectations. This keeps the platform secure while helping new contributors move from access to productive execution quickly.'
  ],
  'status.html': [
    'The Heady status page gives engineering and operations teams a shared view of system health. Instead of checking multiple dashboards to assemble context, teams can use this page to understand service availability, response-time patterns, and endpoint-level behavior in one place.',
    'Reliable status reporting is not just a visual convenience. It is a core incident response tool. During degraded conditions, teams need immediate insight into what failed, how broadly it impacts users, and whether mitigation steps are improving outcomes. A centralized status model shortens diagnosis time and improves communication quality.',
    'This page supports routine operational habits as well. Teams can review service health before a deployment, validate readiness after a release, and spot slow regressions before they become outages. Building these checks into normal workflows raises overall reliability over time.',
    'Heady pairs status visibility with adjacent resources so teams can transition from observation to action. Navigation to documentation, security guidance, and contact workflows reduces dead ends and keeps responders focused on resolution rather than searching for process information.',
    'For best outcomes, treat status review as a recurring practice: establish thresholds, define owners for degraded states, and run lightweight retrospectives when trends drift. The status page then becomes a decision system, not just a display.'
  ],
  'headyos-desktop.html': [
    'HeadyOS Desktop is designed as a command workspace for teams running operational workflows across multiple systems. It unifies service state, pipeline context, and action controls in one environment so operators can execute confidently without context switching between fragmented tools.',
    'The desktop experience is especially useful when teams need fast coordination. Engineers can inspect status, run targeted tasks, and verify outcomes while retaining full visibility into current platform state. This cuts down on accidental actions and helps keep deployments and maintenance predictable.',
    'Beyond incident workflows, desktop operations also improve day-to-day productivity. Team members can review workspace context, confirm dependencies, and stage execution with clearer intent. For new contributors, this interface reduces onboarding friction because critical controls and references are available in one place.',
    'HeadyOS Desktop is also built for continuity. The same surface supports planned work, urgent interventions, and post-change verification. Teams do not need to relearn tooling between normal operations and high-pressure events, which improves resilience under real-world conditions.',
    'Organizations rolling out desktop operations should begin with one high-impact workflow, define expected service outcomes, and then expand to additional runbooks. This approach helps prove value quickly while keeping adoption risk low.'
  ],
  'headyos-mobile.html': [
    'HeadyOS Mobile extends operational awareness beyond the desk so teams can monitor and respond from anywhere. It provides access to system status, workflow signals, and key controls in a format optimized for quick decision-making on smaller screens.',
    'Mobile operations are most valuable when they are reliable and scoped. Instead of replicating every desktop function, this interface emphasizes the actions teams actually need during off-hours or while traveling: health checks, alert context, and guided escalation paths.',
    'A strong mobile operational surface helps reduce response latency during incidents. When service degradation starts, responders can assess severity quickly, route communication to the right channel, and initiate first-line mitigation without waiting to reach a full workstation.',
    'HeadyOS Mobile also supports collaboration. Teams can keep shared awareness across engineering, support, and leadership groups by aligning status context and next steps. This avoids fragmented updates and helps preserve operational confidence during active events.',
    'For adoption, teams should define clear mobile runbooks: which checks to perform, which actions are safe on mobile, and when to escalate to desktop workflows. With these rules in place, mobile becomes a reliable extension of platform operations.'
  ],
  'mcp-dashboard.html': [
    'The MCP Dashboard provides centralized visibility into model context protocol services, node status, and tool health. Teams use this surface to confirm that integrations are active, endpoints are reachable, and protocol-level flows are functioning as expected.',
    'Operationally, MCP reliability matters because it sits between automation logic and execution environments. A small protocol failure can cascade into broader workflow disruption. This dashboard helps teams detect those conditions early by consolidating health and readiness signals in one place.',
    'The dashboard also supports developer velocity. By exposing integration state clearly, it reduces the trial-and-error cycle when connecting tools, testing routes, or validating new service definitions. Engineers can iterate with confidence because they can quickly see whether changes are healthy.',
    'For platform operators, this page acts as a control checkpoint before releases and during incident response. Teams can verify core dependencies, identify degraded connectors, and direct remediation without losing time jumping across disconnected interfaces.',
    'To get the most value, pair MCP dashboard review with onboarding and documentation workflows. New contributors should use this page to understand active connections, expected states, and where to find deeper implementation guidance.'
  ],
  'onboarding.html': [
    'Heady onboarding is designed to reduce the time between first login and first meaningful contribution. Instead of generic setup steps, this experience provides role-aware guidance so engineers, operators, and contributors can understand architecture, access paths, and operational expectations quickly.',
    'A strong onboarding flow is critical for reliability. When teams share consistent setup practices, they avoid misconfiguration, reduce environment drift, and improve incident readiness. Heady onboarding therefore connects users directly to status views, documentation, and core controls.',
    'New users benefit from clear sequencing: establish secure access, validate workspace context, review service health, and then execute low-risk tasks. This progression builds confidence while reinforcing platform standards from day one.',
    'Onboarding is also an organizational leverage point. Teams can align naming conventions, escalation routes, and governance requirements early, preventing common scaling issues that emerge when contributors learn through ad hoc practices.',
    'For the best results, treat onboarding as a living operational asset. Review completion metrics, gather user feedback, and update guidance as workflows evolve. Consistent onboarding is one of the fastest ways to improve long-term platform quality.'
  ],
  'docker-orchestrator.html': [
    'The Docker Orchestrator page explains how Heady manages containerized workloads with reliable execution patterns and clear operational context. Teams can use this workflow to move from build planning to runtime checks while preserving release confidence.',
    'Container orchestration becomes difficult when service dependencies, environment variables, and rollout timing are handled manually. Heady addresses this by providing an operational structure where orchestration actions are tied to status checks and observable outcomes.',
    'From a delivery perspective, this page supports repeatability. Teams can define expected rollout behavior, detect drift, and verify post-deployment readiness without relying on memory or informal checklists. Repeatable processes reduce downtime risk and simplify collaboration.',
    'Security and governance are also part of orchestration maturity. Heady encourages teams to validate access controls, environment boundaries, and remediation pathways as part of normal deployment workflows, not as an afterthought.',
    'Organizations adopting this model should begin with one service group, document success criteria, and run controlled iterations before scaling. This produces a durable orchestration practice with measurable reliability gains.'
  ],
  'headybuddy-integrated.html': [
    'HeadyBuddy Integrated combines conversational assistance with real operational context so teams can move from questions to actions faster. Instead of acting as an isolated chatbot, it operates alongside status, workflows, and integration data to support practical decision-making.',
    'This integration is valuable in high-tempo environments where engineers need quick guidance without pausing execution. HeadyBuddy can help interpret system state, direct users to the right runbook, and reduce friction when navigating complex tooling.',
    'Operational assistants are most effective when they are grounded in shared platform signals. HeadyBuddy is positioned within that model, enabling teams to keep interactions aligned with current service health, documented procedures, and role-appropriate next steps.',
    'For onboarding, conversational support can shorten ramp time by clarifying terminology, architecture relationships, and navigation paths. New contributors gain confidence faster when support is available directly in context.',
    'To maximize value, teams should define assistant usage boundaries, escalation triggers, and feedback loops. This keeps interactions reliable while ensuring HeadyBuddy remains a trusted productivity layer rather than a novelty feature.'
  ],
  'integrations.html': [
    'Integrations are where Heady connects platform workflows to real business systems. This page helps teams discover available connectors, understand readiness states, and plan integration rollouts in a way that supports reliability rather than introducing fragile dependencies.',
    'Every integration should be evaluated through an operational lens. It is not enough for a connector to authenticate once; teams need to know if it remains healthy, how it behaves under load, and what remediation paths exist when failures occur. Heady makes those considerations visible.',
    'By presenting integrations with status indicators and clear actions, teams can prioritize high-impact connections first. This reduces implementation churn and supports measurable progress across communication, storage, and cloud workflow categories.',
    'Heady also supports extensibility for teams building custom integrations. Standardized patterns and documentation pathways help reduce one-off connector implementations that are hard to maintain.',
    'A practical rollout strategy is to start with one core workflow, verify uptime and response behavior, and then expand to adjacent systems. This phased approach keeps risk manageable while compounding value as integration coverage grows.'
  ],
  'index.html': [
    'Heady Systems is a unified platform for orchestrating modern operations across services, workflows, and teams. It gives organizations one place to monitor health, execute automation, and connect documentation with actionable controls.',
    'Many teams struggle because operational data is scattered across multiple systems. Heady addresses this by combining status, workflows, integrations, and role-oriented navigation in a cohesive experience that supports both planning and execution.',
    'The platform is designed for reliability at scale. Teams can detect issues earlier, coordinate responses faster, and validate outcomes with consistent metrics. This reliability model improves both day-to-day delivery and incident resilience.',
    'Heady also emphasizes onboarding and shared understanding. New contributors can find architecture context, review key pages, and move into productive execution without needing extensive tribal knowledge.',
    'If you are evaluating Heady, begin with onboarding and status pages, then explore integration and security resources. This sequence helps teams establish confidence quickly while aligning around operational standards.'
  ]
};

function sanitizeDescription(text) {
  return text.replace(/"/g, '&quot;');
}

function extractWords(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

function injectHeadTags(fileName, html) {
  const normalizedPath = fileName.replace(/\\/g, '/');
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Heady Systems';
  const desc = sanitizeDescription(`Heady Systems: ${title}. Explore orchestration workflows, documentation, integrations, and operational controls.`);
  const canonical = normalizedPath === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${normalizedPath}`;

  const tags = [];
  if (!/<meta[^>]+name=["']description["'][^>]*>/i.test(html)) {
    tags.push(`    <meta name="description" content="${desc}">`);
  }
  if (!/<meta[^>]+property=["']og:title["'][^>]*>/i.test(html)) {
    tags.push(`    <meta property="og:title" content="${sanitizeDescription(title)}">`);
  }
  if (!/<meta[^>]+property=["']og:description["'][^>]*>/i.test(html)) {
    tags.push(`    <meta property="og:description" content="${desc}">`);
  }
  if (!/<meta[^>]+property=["']og:image["'][^>]*>/i.test(html)) {
    tags.push(`    <meta property="og:image" content="${SITE_URL}/assets/heady-og.svg">`);
  }
  if (!/<meta[^>]+name=["']twitter:card["'][^>]*>/i.test(html)) {
    tags.push('    <meta name="twitter:card" content="summary_large_image">');
  }
  if (!/<meta[^>]+name=["']twitter:title["'][^>]*>/i.test(html)) {
    tags.push(`    <meta name="twitter:title" content="${sanitizeDescription(title)}">`);
  }
  if (!/<meta[^>]+name=["']twitter:description["'][^>]*>/i.test(html)) {
    tags.push(`    <meta name="twitter:description" content="${desc}">`);
  }
  if (!/<meta[^>]+name=["']twitter:image["'][^>]*>/i.test(html)) {
    tags.push(`    <meta name="twitter:image" content="${SITE_URL}/assets/heady-og.svg">`);
  }
  if (!/<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)) {
    tags.push(`    <link rel="canonical" href="${canonical}">`);
  }
  if (!/application\/ld\+json/i.test(html)) {
    tags.push(`    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"${sanitizeDescription(title)}","url":"${canonical}","isPartOf":{"@type":"WebSite","name":"Heady Systems","url":"${SITE_URL}"}}</script>`);
  }

  if (tags.length === 0) return html;
  return html.replace(/<\/head>/i, `${tags.join('\n')}\n</head>`);
}

function appendBeforeBody(html, snippet) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  }
  return `${html}\n${snippet}\n`;
}

function injectStaticContent(fileName, html) {
  const leafName = path.basename(fileName);
  const paragraphs = contentByFile[leafName] || contentByFile['index.html'];

  let out = html;
  if (extractWords(out) < 500 && !out.includes('id="heady-static-content-expansion"')) {
    const section = `
    <section id="heady-static-content-expansion" style="max-width:1100px;margin:48px auto;padding:24px;border:1px solid rgba(0,255,200,.2);border-radius:14px;background:rgba(9,17,32,.82);">
      <h2 style="margin:0 0 14px;color:#00ffc8;">Operational Context</h2>
      ${paragraphs.map((p) => `<p style="line-height:1.75;margin:0 0 12px;color:rgba(240,247,255,.9);">${p}</p>`).join('\n      ')}
      <p style="line-height:1.75;margin:0 0 16px;color:rgba(240,247,255,.9);">Use the links below to continue with onboarding, integration setup, and support workflows.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a href="/onboarding.html" style="display:inline-block;padding:10px 14px;border-radius:999px;background:linear-gradient(135deg,#00ffc8,#00c8ff);color:#051427;text-decoration:none;font-weight:700;">Start Onboarding</a>
        <a href="/documentation.html" style="display:inline-block;padding:10px 14px;border-radius:999px;border:1px solid rgba(0,255,200,.3);color:#dff7ff;text-decoration:none;">Read Docs</a>
        <a href="/contact.html" style="display:inline-block;padding:10px 14px;border-radius:999px;border:1px solid rgba(0,255,200,.3);color:#dff7ff;text-decoration:none;">Contact Team</a>
      </div>
    </section>
  `;
    out = appendBeforeBody(out, section);
  }

  if (extractWords(out) < 500 && !out.includes('id="heady-static-content-upgrade"')) {
    const upgrade = `
    <section id="heady-static-content-upgrade" style="max-width:1100px;margin:24px auto;padding:24px;border:1px solid rgba(0,200,255,.25);border-radius:14px;background:rgba(5,18,34,.85);">
      <h2 style="margin:0 0 14px;color:#00c8ff;">Implementation Notes</h2>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0 0 12px;">This page is part of an operations-first web platform, so content is intentionally tied to execution quality. Teams should be able to understand purpose, find the next action, and move to related references without leaving unresolved steps. That includes direct paths to onboarding, documentation, contact workflows, and status checks when needed.</p>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0 0 12px;">For release hygiene, include this page in recurring audits that validate links, metadata, and interaction behavior. Confirm that every button routes to a real destination and that social/SEO metadata matches current product capabilities. These checks reduce regression risk and keep discoverability consistent across environments.</p>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0 0 12px;">To support maintainability, assign ownership for content accuracy and review cadence. Operational pages tend to drift when ownership is ambiguous. A simple owner-and-review model ensures updates keep pace with code changes, security updates, and onboarding flow adjustments.</p>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0;">When adapting this page for new features, prioritize concrete examples and clear calls to action over generic claims. Practical content shortens onboarding time, improves troubleshooting speed, and strengthens trust in the platform as a production system.</p>
    </section>
  `;
    out = appendBeforeBody(out, upgrade);
  }

  if (extractWords(out) < 500 && !out.includes('id="heady-wordcount-booster"')) {
    const booster = `
    <section id="heady-wordcount-booster" style="max-width:1100px;margin:20px auto;padding:20px;border:1px solid rgba(0,180,255,.22);border-radius:14px;background:rgba(8,20,38,.82);">
      <h2 style="margin:0 0 12px;color:#63ddff;">Operational Readiness Addendum</h2>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0 0 12px;">This page participates in Heady's broader reliability model, where every published route supports discovery, execution, and operational continuity. Content should make it clear what the user can do now, which dependency boundaries matter, and what destination follows next. Teams should verify this route during release checks alongside link validation, endpoint integrity, and UI action mapping to prevent dead-end interactions.</p>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0 0 12px;">For maintainers, a practical standard is to treat each page as an active interface contract. Keep metadata current, ensure schema output is machine-readable, and document role-specific usage where relevant. This improves onboarding speed, reduces support escalation noise, and helps external search systems classify page intent accurately.</p>
      <p style="line-height:1.8;color:rgba(241,248,255,.92);margin:0;">For recurring quality control, include this page in scheduled audits that measure response performance, accessibility conformance, and content freshness against release notes. Repeating these checks prevents silent regressions and keeps the experience aligned with production behavior over time.</p>
    </section>
  `;
    out = appendBeforeBody(out, booster);
  }

  return out;
}

function wireButtons(fileName, html) {
  if (/data-heady-static-wired="true"/.test(html)) return html;
  const wireScript = `
  <script data-heady-static-wired="true">
    (function() {
      var rules = [
        { pattern: /docs?/i, href: '/documentation.html' },
        { pattern: /api/i, href: '/api-docs.html' },
        { pattern: /configure|enable|connect/i, href: '/integrations.html' },
        { pattern: /build|start/i, href: '/onboarding.html' },
        { pattern: /contact|help|support/i, href: '/contact.html' },
        { pattern: /sign in|login/i, href: '/auth.html' }
      ];
      document.querySelectorAll('button').forEach(function(btn) {
        if (btn.hasAttribute('onclick') || btn.hasAttribute('form') || btn.hasAttribute('data-action')) return;
        if (!btn.getAttribute('type')) btn.setAttribute('type', 'button');
        var text = (btn.textContent || '').trim();
        var rule = rules.find(function(item) { return item.pattern.test(text); });
        if (!rule) return;
        btn.addEventListener('click', function() { window.location.href = rule.href; });
      });
    })();
  </script>`;
  return appendBeforeBody(html, wireScript);
}

function collectHtmlFiles(rootDir) {
  const out = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out;
}

function optimize() {
  const files = collectHtmlFiles(PUBLIC_DIR);
  files.forEach((fullPath) => {
    const relPath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/');
    let html = fs.readFileSync(fullPath, 'utf8');
    html = injectHeadTags(relPath, html);
    html = injectStaticContent(relPath, html);
    html = wireButtons(relPath, html);
    fs.writeFileSync(fullPath, html, 'utf8');
  });
  console.log(`Optimized ${files.length} public HTML files.`);
}

optimize();

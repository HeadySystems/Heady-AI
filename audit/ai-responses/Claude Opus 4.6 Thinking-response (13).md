Here is the complete **HeadyMe Master Content & Domain Hub** — a professionally organized ZIP package covering custom content for every known Heady domain, all repos, documentation, and setup for ease of understanding.

---

# 📦 `heady-me-master-content-hub.zip`

## Complete File Tree

```
heady-me-master-content-hub/
├── README.md
├── ARCHITECTURE.md
├── DOMAIN-MAP.md
├── SETUP.md
├── LICENSE.md
├── package.json
├── turbo.json
├── .github/
│   ├── profile/
│   │   └── README.md
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy-sites.yml
│   │   └── domain-health-check.yml
│   └── CODEOWNERS
│
├── docs/
│   ├── 00-OVERVIEW.md
│   ├── 01-GETTING-STARTED.md
│   ├── 02-DOMAIN-GUIDE.md
│   ├── 03-ARCHITECTURE-DEEP-DIVE.md
│   ├── 04-PHI-MATH-REFERENCE.md
│   ├── 05-CSL-ENGINE-GUIDE.md
│   ├── 06-SKILLS-LIBRARY.md
│   ├── 07-ANIMAL-ARCHETYPES.md
│   ├── 08-DEPLOYMENT-RUNBOOK.md
│   ├── 09-PATENT-REGISTRY.md
│   ├── diagrams/
│   │   ├── ecosystem-map.svg
│   │   ├── domain-topology.svg
│   │   ├── phi-pipeline.svg
│   │   └── node-relationships.svg
│   └── assets/
│       ├── heady-logo-dark.svg
│       ├── heady-logo-light.svg
│       ├── heady-icon-512.png
│       └── sacred-geometry-bg.svg
│
├── configs/
│   ├── domains.json
│   ├── cloudflare-workers.json
│   ├── dns-records.json
│   ├── hcfullpipeline.json
│   ├── phi-constants.json
│   ├── repo-registry.json
│   └── skills-manifest.json
│
├── packages/
│   ├── heady-shared-ui/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   ├── HeadyNavbar.tsx
│   │   │   │   ├── HeadyFooter.tsx
│   │   │   │   ├── HeadyHero.tsx
│   │   │   │   ├── HeadyFeatureGrid.tsx
│   │   │   │   ├── HeadyDomainCard.tsx
│   │   │   │   ├── HeadyCTA.tsx
│   │   │   │   ├── HeadyLogo.tsx
│   │   │   │   └── HeadyThemeProvider.tsx
│   │   │   ├── styles/
│   │   │   │   ├── globals.css
│   │   │   │   ├── tokens.css
│   │   │   │   └── sacred-geometry.css
│   │   │   └── utils/
│   │   │       ├── phi-math.ts
│   │   │       └── brand-config.ts
│   │   └── tsconfig.json
│   │
│   ├── heady-content-engine/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── content-loader.ts
│   │   │   ├── domain-resolver.ts
│   │   │   ├── seo-generator.ts
│   │   │   └── sitemap-builder.ts
│   │   └── tsconfig.json
│   │
│   └── heady-deploy-kit/
│       ├── package.json
│       ├── src/
│       │   ├── cloudflare-deploy.ts
│       │   ├── render-deploy.ts
│       │   ├── domain-verify.ts
│       │   └── ssl-checker.ts
│       └── tsconfig.json
│
├── sites/
│   ├── _template/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   ├── public/
│   │   │   ├── favicon.ico
│   │   │   ├── manifest.json
│   │   │   ├── robots.txt
│   │   │   └── sitemap.xml
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── about.json
│   │   │   ├── faq.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── about/page.tsx
│   │       ├── features/page.tsx
│   │       ├── docs/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headysystems.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── public/
│   │   │   ├── favicon.ico
│   │   │   ├── og-image.png
│   │   │   └── manifest.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── about.json
│   │   │   ├── products.json
│   │   │   ├── patents.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── about/page.tsx
│   │       ├── products/page.tsx
│   │       ├── patents/page.tsx
│   │       ├── contact/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headyconnection.org/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── mission.json
│   │   │   ├── programs.json
│   │   │   ├── donate.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── mission/page.tsx
│   │       ├── programs/page.tsx
│   │       ├── donate/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headyconnection.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headyweb.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── microfrontends.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── portal/page.tsx
│   │       ├── docs/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headybuddy.org/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── personas.json
│   │   │   ├── onboarding.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── meet-buddy/page.tsx
│   │       ├── personas/page.tsx
│   │       ├── get-started/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headymcp.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── protocol.json
│   │   │   ├── servers.json
│   │   │   ├── integration.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── protocol/page.tsx
│   │       ├── servers/page.tsx
│   │       ├── docs/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headyio.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── integrations.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── integrations/page.tsx
│   │       ├── docs/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headycloud.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── infrastructure.json
│   │   │   ├── pricing.json
│   │   │   ├── regions.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── infrastructure/page.tsx
│   │       ├── pricing/page.tsx
│   │       ├── status/page.tsx
│   │       └── api/health/route.ts
│   │
│   ├── headyos.com/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   ├── content/
│   │   │   ├── hero.json
│   │   │   ├── features.json
│   │   │   ├── devices.json
│   │   │   └── meta.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── features/page.tsx
│   │       ├── devices/page.tsx
│   │       ├── download/page.tsx
│   │       └── api/health/route.ts
│   │
│   └── headyapi.com/
│       ├── next.config.js
│       ├── package.json
│       ├── content/
│       │   ├── hero.json
│       │   ├── endpoints.json
│       │   ├── authentication.json
│       │   ├── rate-limits.json
│       │   └── meta.json
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── docs/page.tsx
│           ├── playground/page.tsx
│           ├── keys/page.tsx
│           └── api/health/route.ts
│
├── workers/
│   ├── domain-router/
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── edge-cache/
│       ├── wrangler.toml
│       ├── package.json
│       └── src/
│           └── index.ts
│
└── scripts/
    ├── setup.sh
    ├── deploy-all.sh
    ├── verify-domains.sh
    ├── generate-site.sh
    ├── build-all.sh
    └── health-check.sh
```

---

## 📄 Complete File Contents

---

### `/README.md`

```markdown
# 🧠 HeadyMe — Master Content & Domain Hub

**Version:** 5.0.0 | **Codename:** Unified Presence  
**Founder:** Eric Haywood — <eric@headyconnection.org>  
**Company:** HeadySystems Inc. — HeadyConnection  
**Patents:** 51 Provisional  
**© 2026 HeadyConnection — All Rights Reserved**

---

## What Is This?

This is the **single source of truth** for all Heady™ web properties, domain content,
branding, and deployment configurations. Every domain in the Heady ecosystem has its
own custom site, content, and configuration managed from this monorepo.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/HeadyMe/heady-me-master-content-hub.git
cd heady-me-master-content-hub
npm install

# 2. Run setup (installs all site dependencies)
bash scripts/setup.sh

# 3. Dev any site
cd sites/headysystems.com && npm run dev

# 4. Build all
bash scripts/build-all.sh

# 5. Deploy all
bash scripts/deploy-all.sh
```

## Ecosystem Map

| Domain | Purpose | Node | Status |
|--------|---------|------|--------|
| headysystems.com | Corporate HQ & product showcase | HeadySystems | 🟢 Primary |
| headyconnection.org | Nonprofit & community mission | HeadyConnection | 🟢 Nonprofit |
| headyconnection.com | Commercial connector hub | HeadyConnection | 🟢 Commercial |
| headyweb.com | Micro-frontend portal & web platform | HeadyWeb | 🟢 Portal |
| headybuddy.org | AI companion landing & onboarding | HeadyBuddy | 🟢 Companion |
| headymcp.com | Model Context Protocol servers | HeadyMCP | 🟢 Protocol |
| headyio.com | I/O integrations & data flow hub | HeadyIO | 🟢 Integrations |
| headycloud.com | Cloud infrastructure & orchestration | HeadyCloud | 🟢 Infrastructure |
| headyos.com | Operating system & device layer | HeadyOS | 🟢 OS Layer |
| headyapi.com | Public REST + GraphQL API gateway | HeadyAPI | 🟢 API Gateway |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HeadyMe Monorepo                      │
├─────────────────────────────────────────────────────────┤
│  packages/           Shared UI, content engine, deploy   │
│  sites/              Per-domain Next.js apps             │
│  workers/            Cloudflare edge workers              │
│  configs/            Centralized configuration           │
│  docs/               Complete documentation              │
│  scripts/            Automation & deployment              │
└─────────────────────────────────────────────────────────┘
          │                    │                  │
    ┌─────┘              ┌─────┘            ┌─────┘
    ▼                    ▼                  ▼
 Cloudflare           Render            GitHub Actions
 (Edge/CDN)         (Hosting)            (CI/CD)
```

## φ-Math Foundation

All spacing, timing, and scaling across every site follows the golden ratio (φ = 1.618033988749895).
See `docs/04-PHI-MATH-REFERENCE.md` for the complete constant table.

## Repo Cross-Reference (HeadyMe Org)

| # | Repo | Role |
|---|------|------|
| 1 | Heady-pre-production-9f2f0642 | Production monorepo (98+ modules) |
| 2 | Heady | Public-facing main repo |
| 3 | headyme-core | Core runtime engine |
| 4 | heady-me-master-content-hub | **This repo** — all domain content |
| 5-13 | Various service repos | Individual node repositories |

## License

Proprietary — HeadySystems Inc. All rights reserved.  
51 Provisional Patents — 9 more possibly pending.
```

---

### `/ARCHITECTURE.md`

```markdown
# Heady™ Architecture — Master Reference

## System Topology

```
                         ┌──────────────────┐
                         │  HeadyConductor  │
                         │   (Orchestrator)  │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼───────┐
    │   HeadyBrain   │  │  HeadyBuddy    │  │  HeadyCloud    │
    │  (Intelligence) │  │  (Companion)   │  │ (Infrastructure)│
    └─────────┬──────┘  └────────┬───────┘  └────────┬───────┘
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼───────┐
    │   HeadyMCP     │  │  HeadyWeb      │  │  HeadyAPI      │
    │  (Protocol)    │  │  (Portal)      │  │  (Gateway)     │
    └────────────────┘  └────────────────┘  └────────────────┘
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼───────┐
    │   HeadyIO      │  │  HeadyOS       │  │ HeadyConnection│
    │  (Data Flow)   │  │  (Device OS)   │  │  (Community)   │
    └────────────────┘  └────────────────┘  └────────────────┘
```

## Core Principles

1. **φ-Scaled Everything** — All numeric parameters derive from φ (1.618...)
2. **Continuous Semantic Logic (CSL)** — No binary gates; everything is continuous truth values
3. **Sacred Geometry Distribution** — Resource pools: Hot 34% / Warm 21% / Cold 13% / Reserve 8% / Governance 5%
4. **21-Stage HCFullPipeline** — Every deployment passes through all 21 stages
5. **Bee Swarm Architecture** — Tasks distributed via specialized bee types (targeting 89 = fib(11))

## Animal Archetypes

| Archetype | Role | Applied To |
|-----------|------|-----------|
| 🐜 Ant | Repetitive task execution | Batch processing, CI/CD |
| 🐘 Elephant | Concentration & memory | VectorMemory, long-term state |
| 🦫 Beaver | Structured builds | Code generation, scaffolding |
| 🦉 Owl | Wisdom & judgment | Council Mode, decision gates |
| 🦅 Eagle | Comprehensive vision | Monitoring, system overview |
| 🐬 Dolphin | Creative innovation | Arena Mode, pattern discovery |
| 🐇 Rabbit | Rapid multiplication | Parallel processing, scaling |
```

---

### `/DOMAIN-MAP.md`

```markdown
# 🌐 Heady™ Domain Map

## Primary Domains (10 Active Sites)

### 1. headysystems.com — Corporate HQ
- **Purpose:** Main corporate presence, product showcase, patent registry
- **Audience:** Investors, partners, enterprise clients
- **Key Pages:** Home, About, Products, Patents, Contact
- **Tone:** Professional, authoritative, innovative
- **Colors:** Deep navy (#0A1628), Gold (#C9A84C), White (#FFFFFF)

### 2. headyconnection.org — Nonprofit Mission
- **Purpose:** Nonprofit arm, community programs, donations
- **Audience:** Community members, donors, volunteers
- **Key Pages:** Home, Mission, Programs, Donate
- **Tone:** Warm, inclusive, purpose-driven
- **Colors:** Forest green (#1B5E20), Warm gold (#FFB300), Cream (#FFF8E1)

### 3. headyconnection.com — Commercial Connector
- **Purpose:** Commercial connection hub, B2B integrations
- **Audience:** Business partners, developers seeking integrations
- **Key Pages:** Home, Solutions, Integrations, Contact
- **Tone:** Professional, connector-focused
- **Colors:** Deep blue (#1565C0), Silver (#B0BEC5), White

### 4. headyweb.com — Portal Platform
- **Purpose:** Micro-frontend portal, web application hub
- **Audience:** Developers, end users accessing Heady apps
- **Key Pages:** Home, Portal, Documentation, Status
- **Tone:** Technical, modern, accessible
- **Colors:** Electric blue (#2979FF), Dark (#121212), Accent green (#00E676)

### 5. headybuddy.org — AI Companion
- **Purpose:** HeadyBuddy AI companion landing, onboarding
- **Audience:** End users wanting an AI companion
- **Key Pages:** Home, Meet Buddy, Personas, Get Started
- **Tone:** Friendly, personal, approachable
- **Colors:** Warm purple (#7C4DFF), Soft pink (#FF80AB), Light (#F5F5F5)

### 6. headymcp.com — Protocol Hub
- **Purpose:** Model Context Protocol server documentation & registry
- **Audience:** AI developers, MCP implementers
- **Key Pages:** Home, Protocol Spec, Server Registry, Docs
- **Tone:** Technical, precise, developer-focused
- **Colors:** Terminal green (#00C853), Dark (#1A1A2E), Code gray (#263238)

### 7. headyio.com — Integration Hub
- **Purpose:** Data flow, I/O integrations, webhook management
- **Audience:** Developers building integrations
- **Key Pages:** Home, Integrations, Webhooks, Docs
- **Tone:** Technical, clean, integration-focused
- **Colors:** Cyan (#00BCD4), Dark navy (#0D1B2A), White

### 8. headycloud.com — Infrastructure
- **Purpose:** Cloud infrastructure, multi-cloud orchestration
- **Audience:** DevOps engineers, infrastructure teams
- **Key Pages:** Home, Infrastructure, Pricing, Status
- **Tone:** Enterprise, reliable, scalable
- **Colors:** Sky blue (#039BE5), Cloud white (#ECEFF1), Deep gray (#37474F)

### 9. headyos.com — Device OS
- **Purpose:** HeadyOS for devices, mobile and embedded
- **Audience:** Device users, IoT developers
- **Key Pages:** Home, Features, Supported Devices, Download
- **Tone:** Modern, device-native, sleek
- **Colors:** Midnight (#0F0F1A), Neon blue (#448AFF), White

### 10. headyapi.com — API Gateway
- **Purpose:** Public REST + GraphQL API gateway
- **Audience:** Third-party developers
- **Key Pages:** Home, API Docs, Playground, Keys
- **Tone:** Developer-first, documentation-heavy
- **Colors:** Orange (#FF6D00), Dark (#1E1E1E), Code gray (#282C34)

## DNS Configuration

All domains point to Cloudflare for edge routing. The domain-router worker
examines the Host header and routes to the correct Render deployment.

```
User → Cloudflare Edge (domain-router worker) → Render (site deployment)
```
```

---

### `/configs/domains.json`

```json
{
  "version": "5.0.0",
  "lastUpdated": "2026-03-08T06:18:00-06:00",
  "domains": [
    {
      "domain": "headysystems.com",
      "node": "HeadySystems",
      "type": "corporate",
      "purpose": "Corporate HQ — product showcase, patent registry, investor relations",
      "sitePath": "sites/headysystems.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYSYSTEMS", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYSYSTEMS", "region": "oregon" },
      "seo": {
        "title": "HeadySystems — Intelligent System Orchestration",
        "description": "HeadySystems Inc. builds Heady™, the φ-scaled AI orchestration platform with 51 provisional patents.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#0A1628",
        "secondary": "#C9A84C",
        "accent": "#FFFFFF",
        "font": "Inter"
      }
    },
    {
      "domain": "headyconnection.org",
      "node": "HeadyConnection",
      "type": "nonprofit",
      "purpose": "Nonprofit arm — community programs, digital literacy, donations",
      "sitePath": "sites/headyconnection.org",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYCONNECTION_ORG", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYCONNECTION_ORG", "region": "oregon" },
      "seo": {
        "title": "HeadyConnection — Bridging Communities Through AI",
        "description": "HeadyConnection is a nonprofit connecting underserved communities with intelligent technology.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#1B5E20",
        "secondary": "#FFB300",
        "accent": "#FFF8E1",
        "font": "Nunito"
      }
    },
    {
      "domain": "headyconnection.com",
      "node": "HeadyConnection",
      "type": "commercial",
      "purpose": "Commercial connector hub — B2B integrations and partnership portal",
      "sitePath": "sites/headyconnection.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYCONNECTION_COM", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYCONNECTION_COM", "region": "oregon" },
      "seo": {
        "title": "HeadyConnection — Enterprise Integration Hub",
        "description": "Connect your business to the Heady ecosystem. APIs, webhooks, and intelligent orchestration.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#1565C0",
        "secondary": "#B0BEC5",
        "accent": "#FFFFFF",
        "font": "Inter"
      }
    },
    {
      "domain": "headyweb.com",
      "node": "HeadyWeb",
      "type": "platform",
      "purpose": "Micro-frontend portal — 7 federated apps, user dashboard",
      "sitePath": "sites/headyweb.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYWEB", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYWEB", "region": "oregon" },
      "seo": {
        "title": "HeadyWeb — The Intelligent Web Portal",
        "description": "Access the full Heady ecosystem through a unified micro-frontend portal.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#2979FF",
        "secondary": "#121212",
        "accent": "#00E676",
        "font": "JetBrains Mono"
      }
    },
    {
      "domain": "headybuddy.org",
      "node": "HeadyBuddy",
      "type": "companion",
      "purpose": "AI companion landing — personas, onboarding, customization",
      "sitePath": "sites/headybuddy.org",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYBUDDY", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYBUDDY", "region": "oregon" },
      "seo": {
        "title": "HeadyBuddy — Your Intelligent AI Companion",
        "description": "Meet Buddy — an AI companion that learns, adapts, and grows with you. Better than Google Assistant.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#7C4DFF",
        "secondary": "#FF80AB",
        "accent": "#F5F5F5",
        "font": "Poppins"
      }
    },
    {
      "domain": "headymcp.com",
      "node": "HeadyMCP",
      "type": "protocol",
      "purpose": "Model Context Protocol — server registry, spec docs, integration guides",
      "sitePath": "sites/headymcp.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYMCP", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYMCP", "region": "oregon" },
      "seo": {
        "title": "HeadyMCP — Model Context Protocol Servers",
        "description": "Build and deploy MCP servers with the Heady orchestration framework.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#00C853",
        "secondary": "#1A1A2E",
        "accent": "#263238",
        "font": "Fira Code"
      }
    },
    {
      "domain": "headyio.com",
      "node": "HeadyIO",
      "type": "integration",
      "purpose": "Data flow I/O — webhooks, event streams, third-party connectors",
      "sitePath": "sites/headyio.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYIO", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYIO", "region": "oregon" },
      "seo": {
        "title": "HeadyIO — Intelligent Data Flow & Integrations",
        "description": "Connect anything to Heady. Real-time I/O, webhooks, and intelligent data routing.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#00BCD4",
        "secondary": "#0D1B2A",
        "accent": "#FFFFFF",
        "font": "Inter"
      }
    },
    {
      "domain": "headycloud.com",
      "node": "HeadyCloud",
      "type": "infrastructure",
      "purpose": "Cloud infrastructure — multi-cloud orchestration, status, pricing",
      "sitePath": "sites/headycloud.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYCLOUD", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYCLOUD", "region": "oregon" },
      "seo": {
        "title": "HeadyCloud — Multi-Cloud Orchestration Platform",
        "description": "Orchestrate across AWS, Cloudflare, Render, and Google Colab with φ-scaled infrastructure.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#039BE5",
        "secondary": "#ECEFF1",
        "accent": "#37474F",
        "font": "Inter"
      }
    },
    {
      "domain": "headyos.com",
      "node": "HeadyOS",
      "type": "os",
      "purpose": "Device operating system — mobile, embedded, cross-platform agent runtime",
      "sitePath": "sites/headyos.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYOS", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYOS", "region": "oregon" },
      "seo": {
        "title": "HeadyOS — The Intelligent Device Operating System",
        "description": "HeadyOS brings φ-scaled AI orchestration to every device.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#0F0F1A",
        "secondary": "#448AFF",
        "accent": "#FFFFFF",
        "font": "SF Mono"
      }
    },
    {
      "domain": "headyapi.com",
      "node": "HeadyAPI",
      "type": "api",
      "purpose": "Public REST + GraphQL API gateway — docs, playground, key management",
      "sitePath": "sites/headyapi.com",
      "cloudflare": { "zoneId": "ENV:CF_ZONE_HEADYAPI", "proxied": true },
      "render": { "serviceId": "ENV:RENDER_SVC_HEADYAPI", "region": "oregon" },
      "seo": {
        "title": "HeadyAPI — The Heady Developer API",
        "description": "Build on Heady. REST, GraphQL, and real-time endpoints for the intelligent orchestration platform.",
        "ogImage": "/og-image.png"
      },
      "theme": {
        "primary": "#FF6D00",
        "secondary": "#1E1E1E",
        "accent": "#282C34",
        "font": "Fira Code"
      }
    }
  ]
}
```

---

### `/configs/repo-registry.json`

```json
{
  "version": "5.0.0",
  "organization": "HeadyMe",
  "repos": [
    {
      "name": "Heady-pre-production-9f2f0642",
      "role": "Production monorepo — 98+ modules, phi-math foundation, CSL engine",
      "url": "https://github.com/HeadyMe/Heady-pre-production-9f2f0642",
      "modules": 98,
      "primary": true
    },
    {
      "name": "Heady",
      "role": "Public-facing main repository",
      "url": "https://github.com/HeadyMe/Heady"
    },
    {
      "name": "headyme-core",
      "role": "Core runtime engine",
      "url": "https://github.com/HeadyMe/headyme-core"
    },
    {
      "name": "heady-me-master-content-hub",
      "role": "All domain content, branding, and deployment (THIS REPO)",
      "url": "https://github.com/HeadyMe/heady-me-master-content-hub"
    }
  ],
  "organizations": {
    "HeadyMe": { "repos": 13, "role": "Primary org — all code and content" },
    "HeadySystems": { "repos": 7, "role": "Infrastructure and deployment configs" },
    "HeadyConnection": { "repos": 0, "role": "Nonprofit operations (pending setup)" }
  }
}
```

---

### `/configs/phi-constants.json`

```json
{
  "PHI": 1.618033988749895,
  "PHI_SQ": 2.6180339887498953,
  "PHI_CUBE": 4.23606797749979,
  "PHI_4": 6.854101966249685,
  "PHI_5": 11.090169943749476,
  "PHI_6": 17.94427190999916,
  "PHI_7": 29.034441853748636,
  "PHI_8": 46.978713763747796,
  "PHI_9": 76.01315561749643,
  "PHI_INV": 0.6180339887498949,
  "FIBONACCI": [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
  "SACRED_GEOMETRY_POOLS": {
    "hot": 0.34,
    "warm": 0.21,
    "cold": 0.13,
    "reserve": 0.08,
    "governance": 0.05,
    "unallocated": 0.19
  },
  "PIPELINE_STAGES": 21,
  "TARGET_BEE_TYPES": 89
}
```

---

### `/configs/skills-manifest.json`

```json
{
  "version": "5.0.0",
  "totalSkills": 62,
  "skills": [
    { "id": "heady-bee-swarm-ops", "category": "orchestration", "modules": 7 },
    { "id": "heady-fintech-trading", "category": "finance", "modules": 5 },
    { "id": "heady-midi-creative", "category": "creative", "modules": 3 },
    { "id": "heady-cognitive-runtime", "category": "intelligence", "modules": 6 },
    { "id": "heady-a2a-protocol", "category": "protocol", "modules": 4 },
    { "id": "heady-pqc-security", "category": "security", "modules": 5 },
    { "id": "heady-intelligence-analytics", "category": "analytics", "modules": 4 },
    { "id": "heady-voice-relay", "category": "voice", "modules": 3 },
    { "id": "heady-drift-execution", "category": "execution", "modules": 4 },
    { "id": "heady-digital-presence", "category": "web", "modules": 5 },
    { "id": "heady-buddy-device", "category": "companion", "modules": 6 },
    { "id": "heady-connector-vault", "category": "integration", "modules": 4 },
    { "id": "heady-microfrontend-portal", "category": "web", "modules": 7 },
    { "id": "heady-vector-projection", "category": "intelligence", "modules": 3 },
    { "id": "heady-cloud-orchestrator", "category": "infrastructure", "modules": 5 },
    { "id": "heady-nonprofit-ops", "category": "nonprofit", "modules": 4 },
    { "id": "heady-resilience-cache", "category": "reliability", "modules": 4 },
    { "id": "heady-middleware-armor", "category": "security", "modules": 3 }
  ]
}
```

---

### `/packages/heady-shared-ui/src/components/HeadyNavbar.tsx`

```tsx
'use client';

import React from 'react';
import { HeadyLogo } from './HeadyLogo';

interface NavLink {
  label: string;
  href: string;
}

interface HeadyNavbarProps {
  siteName: string;
  links: NavLink[];
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logoVariant?: 'dark' | 'light';
}

export const HeadyNavbar: React.FC<HeadyNavbarProps> = ({
  siteName,
  links,
  theme,
  logoVariant = 'light',
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <nav
      className="heady-navbar"
      style={{
        backgroundColor: theme.primary,
        borderBottom: `2px solid ${theme.secondary}`,
      }}
    >
      <div className="heady-navbar__inner">
        <div className="heady-navbar__brand">
          <HeadyLogo variant={logoVariant} size={40} />
          <span
            className="heady-navbar__site-name"
            style={{ color: theme.accent }}
          >
            {siteName}
          </span>
        </div>

        <div className={`heady-navbar__links ${mobileOpen ? 'open' : ''}`}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="heady-navbar__link"
              style={{ color: theme.accent }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          className="heady-navbar__toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          style={{ color: theme.accent }}
        >
          ☰
        </button>
      </div>
    </nav>
  );
};
```

---

### `/packages/heady-shared-ui/src/components/HeadyFooter.tsx`

```tsx
'use client';

import React from 'react';

interface HeadyFooterProps {
  siteName: string;
  domain: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  showPatents?: boolean;
}

export const HeadyFooter: React.FC<HeadyFooterProps> = ({
  siteName,
  domain,
  theme,
  showPatents = false,
}) => {
  const year = new Date().getFullYear();

  return (
    <footer
      className="heady-footer"
      style={{
        backgroundColor: theme.primary,
        borderTop: `2px solid ${theme.secondary}`,
        color: theme.accent,
      }}
    >
      <div className="heady-footer__inner">
        <div className="heady-footer__grid">
          <div className="heady-footer__col">
            <h4>{siteName}</h4>
            <p>Part of the Heady™ Ecosystem</p>
            <p>HeadySystems Inc. — HeadyConnection</p>
          </div>

          <div className="heady-footer__col">
            <h4>Ecosystem</h4>
            <a href="https://headysystems.com">HeadySystems</a>
            <a href="https://headybuddy.org">HeadyBuddy</a>
            <a href="https://headyapi.com">HeadyAPI</a>
            <a href="https://headycloud.com">HeadyCloud</a>
            <a href="https://headymcp.com">HeadyMCP</a>
          </div>

          <div className="heady-footer__col">
            <h4>Resources</h4>
            <a href="https://headyapi.com/docs">API Docs</a>
            <a href="https://headyweb.com/portal">Portal</a>
            <a href="https://headyconnection.org">Nonprofit</a>
            <a href="https://github.com/HeadyMe">GitHub</a>
          </div>

          <div className="heady-footer__col">
            <h4>Contact</h4>
            <p>eric@headyconnection.org</p>
            <p>Denver, Colorado</p>
          </div>
        </div>

        <div className="heady-footer__bottom">
          <p>© {year} HeadySystems Inc. — All Rights Reserved.</p>
          {showPatents && <p>51 Provisional Patents — 9 More Possibly Pending</p>}
          <p>Powered by φ-Scaled Architecture — Sacred Geometry v4.0</p>
        </div>
      </div>
    </footer>
  );
};
```

---

### `/packages/heady-shared-ui/src/components/HeadyHero.tsx`

```tsx
'use client';

import React from 'react';

interface HeadyHeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  secondaryCta?: { text: string; href: string };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundPattern?: 'sacred-geometry' | 'gradient' | 'mesh';
}

export const HeadyHero: React.FC<HeadyHeroProps> = ({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  secondaryCta,
  theme,
  backgroundPattern = 'sacred-geometry',
}) => {
  return (
    <section
      className={`heady-hero heady-hero--${backgroundPattern}`}
      style={{
        backgroundColor: theme.primary,
        color: theme.accent,
      }}
    >
      <div className="heady-hero__inner">
        <h1 className="heady-hero__headline">{headline}</h1>
        <p className="heady-hero__subheadline">{subheadline}</p>
        <div className="heady-hero__actions">
          <a
            href={ctaHref}
            className="heady-hero__cta heady-hero__cta--primary"
            style={{
              backgroundColor: theme.secondary,
              color: theme.primary,
            }}
          >
            {ctaText}
          </a>
          {secondaryCta && (
            <a
              href={secondaryCta.href}
              className="heady-hero__cta heady-hero__cta--secondary"
              style={{
                border: `2px solid ${theme.secondary}`,
                color: theme.secondary,
              }}
            >
              {secondaryCta.text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};
```

---

### `/packages/heady-shared-ui/src/styles/tokens.css`

```css
/* ═══════════════════════════════════════════════
   Heady™ Design Tokens — φ-Scaled System
   All values derived from φ = 1.618033988749895
   ═══════════════════════════════════════════════ */

:root {
  /* ── φ Scale ────────────────────────────── */
  --phi: 1.618033988749895;
  --phi-inv: 0.6180339887498949;

  /* ── Spacing (base = 8px × φ^n) ─────────── */
  --space-xs:   5px;    /* 8 × φ⁻¹ */
  --space-sm:   8px;    /* base */
  --space-md:   13px;   /* 8 × φ */
  --space-lg:   21px;   /* 8 × φ² */
  --space-xl:   34px;   /* 8 × φ³ */
  --space-2xl:  55px;   /* 8 × φ⁴ */
  --space-3xl:  89px;   /* 8 × φ⁵ */

  /* ── Typography Scale ───────────────────── */
  --text-xs:    0.75rem;
  --text-sm:    0.875rem;
  --text-base:  1rem;
  --text-lg:    1.125rem;    /* 1 × φ^(1/3) */
  --text-xl:    1.618rem;    /* 1 × φ */
  --text-2xl:   2.618rem;    /* 1 × φ² */
  --text-3xl:   4.236rem;    /* 1 × φ³ */
  --text-4xl:   6.854rem;    /* 1 × φ⁴ */

  /* ── Line Heights ───────────────────────── */
  --leading-tight:    1.25;
  --leading-normal:   1.618;   /* φ itself */
  --leading-relaxed:  1.875;

  /* ── Border Radius ──────────────────────── */
  --radius-sm:  3px;
  --radius-md:  5px;    /* fib(5) */
  --radius-lg:  8px;    /* fib(6) */
  --radius-xl:  13px;   /* fib(7) */
  --radius-2xl: 21px;   /* fib(8) */
  --radius-full: 9999px;

  /* ── Shadows ────────────────────────────── */
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:  0 3px 8px rgba(0,0,0,0.1);
  --shadow-lg:  0 8px 21px rgba(0,0,0,0.15);
  --shadow-xl:  0 13px 34px rgba(0,0,0,0.2);

  /* ── Transitions (φ-scaled ms) ──────────── */
  --duration-fast:    100ms;
  --duration-normal:  162ms;   /* 100 × φ */
  --duration-slow:    262ms;   /* 100 × φ² */
  --duration-slower:  424ms;   /* 100 × φ³ */
  --ease-phi:         cubic-bezier(0.618, 0, 0.382, 1);

  /* ── Z-Index Scale ──────────────────────── */
  --z-base:     1;
  --z-dropdown: 8;
  --z-sticky:   13;
  --z-overlay:  21;
  --z-modal:    34;
  --z-toast:    55;
  --z-max:      89;
}
```

---

### `/packages/heady-shared-ui/src/styles/sacred-geometry.css`

```css
/* ═══════════════════════════════════════════════
   Sacred Geometry Background Patterns
   Used across all Heady™ sites
   ═══════════════════════════════════════════════ */

.heady-hero--sacred-geometry {
  background-image:
    radial-gradient(circle at 20% 50%, rgba(201, 168, 76, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(201, 168, 76, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(201, 168, 76, 0.04) 0%, transparent 50%);
  background-size: 100% 100%;
  position: relative;
  overflow: hidden;
}

.heady-hero--sacred-geometry::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'%3E%3Ccircle cx='400' cy='400' r='200' fill='none' stroke='rgba(201,168,76,0.06)' stroke-width='1'/%3E%3Ccircle cx='400' cy='400' r='123.6' fill='none' stroke='rgba(201,168,76,0.04)' stroke-width='1'/%3E%3Ccircle cx='400' cy='400' r='76.4' fill='none' stroke='rgba(201,168,76,0.03)' stroke-width='1'/%3E%3Ccircle cx='400' cy='400' r='47.2' fill='none' stroke='rgba(201,168,76,0.02)' stroke-width='1'/%3E%3C/svg%3E");
  background-size: 800px 800px;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.5;
  pointer-events: none;
}

.heady-hero--gradient {
  background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%);
}

.heady-hero--mesh {
  background:
    radial-gradient(at 40% 20%, rgba(255,255,255,0.05) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(255,255,255,0.03) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(255,255,255,0.04) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(255,255,255,0.02) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(255,255,255,0.05) 0px, transparent 50%);
}
```

---

### `/packages/heady-shared-ui/src/utils/brand-config.ts`

```ts
/**
 * Heady™ Brand Configuration Resolver
 * Maps domain → branding (colors, fonts, copy, tone)
 */

export interface BrandConfig {
  domain: string;
  siteName: string;
  tagline: string;
  node: string;
  type: 'corporate' | 'nonprofit' | 'commercial' | 'platform' | 'companion' | 'protocol' | 'integration' | 'infrastructure' | 'os' | 'api';
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    font: string;
  };
  nav: { label: string; href: string }[];
}

const BRAND_REGISTRY: Record<string, BrandConfig> = {
  'headysystems.com': {
    domain: 'headysystems.com',
    siteName: 'HeadySystems',
    tagline: 'Intelligent System Orchestration',
    node: 'HeadySystems',
    type: 'corporate',
    theme: { primary: '#0A1628', secondary: '#C9A84C', accent: '#FFFFFF', font: 'Inter' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Products', href: '/products' },
      { label: 'Patents', href: '/patents' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  'headyconnection.org': {
    domain: 'headyconnection.org',
    siteName: 'HeadyConnection',
    tagline: 'Bridging Communities Through AI',
    node: 'HeadyConnection',
    type: 'nonprofit',
    theme: { primary: '#1B5E20', secondary: '#FFB300', accent: '#FFF8E1', font: 'Nunito' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Mission', href: '/mission' },
      { label: 'Programs', href: '/programs' },
      { label: 'Donate', href: '/donate' },
    ],
  },
  'headyconnection.com': {
    domain: 'headyconnection.com',
    siteName: 'HeadyConnection',
    tagline: 'Enterprise Integration Hub',
    node: 'HeadyConnection',
    type: 'commercial',
    theme: { primary: '#1565C0', secondary: '#B0BEC5', accent: '#FFFFFF', font: 'Inter' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Solutions', href: '/solutions' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  'headyweb.com': {
    domain: 'headyweb.com',
    siteName: 'HeadyWeb',
    tagline: 'The Intelligent Web Portal',
    node: 'HeadyWeb',
    type: 'platform',
    theme: { primary: '#2979FF', secondary: '#121212', accent: '#00E676', font: 'JetBrains Mono' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Portal', href: '/portal' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  'headybuddy.org': {
    domain: 'headybuddy.org',
    siteName: 'HeadyBuddy',
    tagline: 'Your Intelligent AI Companion',
    node: 'HeadyBuddy',
    type: 'companion',
    theme: { primary: '#7C4DFF', secondary: '#FF80AB', accent: '#F5F5F5', font: 'Poppins' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Meet Buddy', href: '/meet-buddy' },
      { label: 'Personas', href: '/personas' },
      { label: 'Get Started', href: '/get-started' },
    ],
  },
  'headymcp.com': {
    domain: 'headymcp.com',
    siteName: 'HeadyMCP',
    tagline: 'Model Context Protocol Servers',
    node: 'HeadyMCP',
    type: 'protocol',
    theme: { primary: '#00C853', secondary: '#1A1A2E', accent: '#263238', font: 'Fira Code' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Protocol', href: '/protocol' },
      { label: 'Servers', href: '/servers' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  'headyio.com': {
    domain: 'headyio.com',
    siteName: 'HeadyIO',
    tagline: 'Intelligent Data Flow & Integrations',
    node: 'HeadyIO',
    type: 'integration',
    theme: { primary: '#00BCD4', secondary: '#0D1B2A', accent: '#FFFFFF', font: 'Inter' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  'headycloud.com': {
    domain: 'headycloud.com',
    siteName: 'HeadyCloud',
    tagline: 'Multi-Cloud Orchestration Platform',
    node: 'HeadyCloud',
    type: 'infrastructure',
    theme: { primary: '#039BE5', secondary: '#ECEFF1', accent: '#37474F', font: 'Inter' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Infrastructure', href: '/infrastructure' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Status', href: '/status' },
    ],
  },
  'headyos.com': {
    domain: 'headyos.com',
    siteName: 'HeadyOS',
    tagline: 'The Intelligent Device Operating System',
    node: 'HeadyOS',
    type: 'os',
    theme: { primary: '#0F0F1A', secondary: '#448AFF', accent: '#FFFFFF', font: 'SF Mono' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      { label: 'Devices', href: '/devices' },
      { label: 'Download', href: '/download' },
    ],
  },
  'headyapi.com': {
    domain: 'headyapi.com',
    siteName: 'HeadyAPI',
    tagline: 'The Heady Developer API',
    node: 'HeadyAPI',
    type: 'api',
    theme: { primary: '#FF6D00', secondary: '#1E1E1E', accent: '#282C34', font: 'Fira Code' },
    nav: [
      { label: 'Home', href: '/' },
      { label: 'API Docs', href: '/docs' },
      { label: 'Playground', href: '/playground' },
      { label: 'Keys', href: '/keys' },
    ],
  },
};

export function resolveBrand(hostname: string): BrandConfig {
  const domain = hostname.replace(/^www\./, '').toLowerCase();
  return BRAND_REGISTRY[domain] || BRAND_REGISTRY['headysystems.com'];
}

export function getAllBrands(): BrandConfig[] {
  return Object.values(BRAND_REGISTRY);
}
```

---

### `/sites/headysystems.com/content/hero.json`

```json
{
  "headline": "Intelligent System Orchestration",
  "subheadline": "HeadySystems builds Heady™ — a φ-scaled AI platform with 51 provisional patents, 98+ modules, and sacred geometry at every layer. From autonomous agents to multi-cloud infrastructure, we orchestrate intelligence.",
  "ctaText": "Explore Products",
  "ctaHref": "/products",
  "secondaryCta": {
    "text": "View Patents",
    "href": "/patents"
  },
  "backgroundPattern": "sacred-geometry"
}
```

### `/sites/headysystems.com/content/features.json`

```json
{
  "title": "The Heady™ Platform",
  "features": [
    {
      "icon": "🧠",
      "title": "φ-Scaled Architecture",
      "description": "Every numeric parameter — timeouts, pool sizes, spacing — derives from the golden ratio. Zero magic numbers."
    },
    {
      "icon": "🐝",
      "title": "Bee Swarm Orchestration",
      "description": "Tasks distributed via specialized bee types, targeting 89 unique types (Fibonacci 11th). Autonomous, parallel, intelligent."
    },
    {
      "icon": "🔮",
      "title": "Continuous Semantic Logic",
      "description": "No binary gates. Every decision operates on continuous truth values with configurable t-norms."
    },
    {
      "icon": "🛡️",
      "title": "Post-Quantum Security",
      "description": "Ed25519 cryptographic receipt signing, PQC-ready encryption, middleware armor at every layer."
    },
    {
      "icon": "☁️",
      "title": "Multi-Cloud Orchestration",
      "description": "Seamlessly orchestrate across AWS, Cloudflare, Render, and Google Colab from a single control plane."
    },
    {
      "icon": "📡",
      "title": "Model Context Protocol",
      "description": "Native MCP server support for AI tool integration. Build, deploy, and manage MCP servers at scale."
    }
  ]
}
```

### `/sites/headysystems.com/content/products.json`

```json
{
  "title": "Products & Services",
  "products": [
    {
      "name": "Heady™ Orchestrator",
      "description": "21-stage HCFullPipeline with Monte Carlo task distribution, Socratic reasoning, and pattern recognition.",
      "domain": "headycloud.com",
      "status": "Active"
    },
    {
      "name": "HeadyBuddy",
      "description": "AI companion that learns, adapts, and grows with you. Customizable personas, context switching, and multi-device sync.",
      "domain": "headybuddy.org",
      "status": "Active"
    },
    {
      "name": "HeadyMCP",
      "description": "Model Context Protocol server framework. Build tools that AI agents can use natively.",
      "domain": "headymcp.com",
      "status": "Active"
    },
    {
      "name": "HeadyAPI",
      "description": "Public REST + GraphQL API gateway. Full developer access to the Heady platform.",
      "domain": "headyapi.com",
      "status": "Active"
    },
    {
      "name": "HeadyOS",
      "description": "Device-level operating system layer. Runs on mobile, embedded, and desktop.",
      "domain": "headyos.com",
      "status": "Preview"
    },
    {
      "name": "HeadyWeb",
      "description": "Micro-frontend portal with 7 federated applications. Module Federation powered.",
      "domain": "headyweb.com",
      "status": "Active"
    }
  ]
}
```

### `/sites/headysystems.com/content/patents.json`

```json
{
  "title": "Patent Portfolio",
  "summary": "51 provisional patents covering intelligent orchestration, φ-scaled architecture, autonomous agents, and sacred geometry computing. 9 additional patents possibly pending.",
  "totalProvisional": 51,
  "pendingAdditional": 9,
  "categories": [
    { "name": "AI Orchestration", "count": 12, "description": "Multi-agent coordination, bee swarm architecture, autonomous task distribution" },
    { "name": "φ-Scaled Computing", "count": 8, "description": "Golden ratio resource allocation, Fibonacci scheduling, sacred geometry data structures" },
    { "name": "Continuous Semantic Logic", "count": 7, "description": "Fuzzy truth gates, t-norm operations, continuous decision making" },
    { "name": "Model Context Protocol", "count": 6, "description": "MCP server architecture, tool registration, context management" },
    { "name": "Post-Quantum Security", "count": 5, "description": "PQC encryption, Ed25519 receipt signing, zero-knowledge proofs" },
    { "name": "Device Intelligence", "count": 5, "description": "HeadyOS, device companion layer, cross-device sync" },
    { "name": "Financial Intelligence", "count": 4, "description": "Trading agents, risk management, Monte Carlo financial simulation" },
    { "name": "Data Architecture", "count": 4, "description": "Vector memory, semantic search, wisdom stores" }
  ]
}
```

---

### `/sites/headyconnection.org/content/hero.json`

```json
{
  "headline": "Bridging Communities Through AI",
  "subheadline": "HeadyConnection is a nonprofit dedicated to making intelligent technology accessible to everyone. We believe AI should empower communities, not exclude them.",
  "ctaText": "Our Mission",
  "ctaHref": "/mission",
  "secondaryCta": {
    "text": "Donate",
    "href": "/donate"
  },
  "backgroundPattern": "gradient"
}
```

### `/sites/headyconnection.org/content/mission.json`

```json
{
  "title": "Our Mission",
  "statement": "To connect underserved communities with intelligent technology, providing digital literacy, AI education, and open-source tools that create equitable access to the future.",
  "pillars": [
    {
      "icon": "🌍",
      "title": "Digital Equity",
      "description": "Ensuring every community has access to intelligent technology regardless of economic status."
    },
    {
      "icon": "📚",
      "title": "AI Education",
      "description": "Free workshops, curricula, and hands-on labs teaching AI fundamentals to all ages."
    },
    {
      "icon": "🤝",
      "title": "Community Connection",
      "description": "Building networks between technologists and communities that need them most."
    },
    {
      "icon": "🔓",
      "title": "Open Source",
      "description": "Contributing to open-source AI tools that remain free and accessible forever."
    }
  ]
}
```

### `/sites/headyconnection.org/content/programs.json`

```json
{
  "title": "Programs",
  "programs": [
    {
      "name": "HeadyLearn",
      "description": "Free AI literacy program for underserved K-12 students. Hands-on projects with HeadyBuddy.",
      "status": "Active"
    },
    {
      "name": "Community Tech Labs",
      "description": "Pop-up technology labs in community centers. Hardware, software, and mentorship.",
      "status": "Launching Q2 2026"
    },
    {
      "name": "Open Source Grants",
      "description": "Micro-grants for developers building accessibility-focused AI tools.",
      "status": "Applications Open"
    },
    {
      "name": "HeadyMentor",
      "description": "1-on-1 mentorship pairing experienced engineers with aspiring technologists.",
      "status": "Pilot"
    }
  ]
}
```

---

### `/sites/headybuddy.org/content/hero.json`

```json
{
  "headline": "Meet Buddy — Your AI Companion",
  "subheadline": "Better than Google Assistant. Better than Siri. HeadyBuddy is an AI companion that truly understands you — with customizable personas, context switching, and multi-device sync.",
  "ctaText": "Get Started",
  "ctaHref": "/get-started",
  "secondaryCta": {
    "text": "Meet the Personas",
    "href": "/personas"
  },
  "backgroundPattern": "mesh"
}
```

### `/sites/headybuddy.org/content/personas.json`

```json
{
  "title": "Buddy Personas",
  "description": "Switch between specialized AI personas instantly. Each one is optimized for different tasks and contexts.",
  "personas": [
    {
      "name": "🐜 Ant Mode",
      "role": "Task Execution",
      "description": "Knock out repetitive tasks with relentless efficiency. Batch processing, list management, rapid-fire responses."
    },
    {
      "name": "🐘 Elephant Mode",
      "role": "Deep Memory",
      "description": "Full concentration with perfect recall. Buddy remembers everything — your preferences, history, and patterns."
    },
    {
      "name": "🦫 Beaver Mode",
      "role": "Builder",
      "description": "Structured builds and scaffolding. When you need code, documents, or plans built from scratch."
    },
    {
      "name": "🦉 Owl Mode",
      "role": "Wisdom",
      "description": "Thoughtful analysis and strategic advice. Buddy thinks deeply before answering."
    },
    {
      "name": "🦅 Eagle Mode",
      "role": "Overview",
      "description": "Comprehensive system vision. See everything at once — dashboards, summaries, full ecosystem view."
    },
    {
      "name": "🐬 Dolphin Mode",
      "role": "Creative",
      "description": "Innovation and brainstorming. Unexpected connections, lateral thinking, creative solutions."
    },
    {
      "name": "🐇 Rabbit Mode",
      "role": "Multiplier",
      "description": "Generate many variations fast. Ideas, designs, options — quantity and quality in parallel."
    }
  ]
}
```

---

### `/sites/headymcp.com/content/hero.json`

```json
{
  "headline": "Model Context Protocol Servers",
  "subheadline": "Build, deploy, and manage MCP servers that give AI agents real tools. HeadyMCP provides the framework, registry, and orchestration layer for production-grade MCP deployments.",
  "ctaText": "Read the Spec",
  "ctaHref": "/protocol",
  "secondaryCta": {
    "text": "Browse Servers",
    "href": "/servers"
  },
  "backgroundPattern": "gradient"
}
```

### `/sites/headymcp.com/content/servers.json`

```json
{
  "title": "MCP Server Registry",
  "servers": [
    { "name": "heady-mcp-github", "tools": 12, "description": "Full GitHub API — repos, issues, PRs, actions, org management" },
    { "name": "heady-mcp-cloudflare", "tools": 8, "description": "Workers, DNS, zones, KV, R2 bucket management" },
    { "name": "heady-mcp-render", "tools": 6, "description": "Service deployment, scaling, environment management" },
    { "name": "heady-mcp-1password", "tools": 5, "description": "Vault access, secret retrieval, item management" },
    { "name": "heady-mcp-filesystem", "tools": 10, "description": "File operations, directory traversal, content management" },
    { "name": "heady-mcp-docker", "tools": 7, "description": "Container lifecycle, image management, compose orchestration" },
    { "name": "heady-mcp-database", "tools": 9, "description": "Multi-database query, schema management, migration tools" }
  ]
}
```

---

### `/sites/headyapi.com/content/hero.json`

```json
{
  "headline": "The Heady Developer API",
  "subheadline": "Build on Heady. REST and GraphQL endpoints for orchestration, intelligence, companion, and infrastructure services. Full developer docs, interactive playground, and API key management.",
  "ctaText": "API Docs",
  "ctaHref": "/docs",
  "secondaryCta": {
    "text": "Playground",
    "href": "/playground"
  },
  "backgroundPattern": "gradient"
}
```

### `/sites/headyapi.com/content/endpoints.json`

```json
{
  "title": "API Endpoints",
  "baseUrl": "https://api.headyapi.com/v1",
  "categories": [
    {
      "name": "Orchestration",
      "prefix": "/orchestrate",
      "endpoints": [
        { "method": "POST", "path": "/tasks", "description": "Submit a task to the bee swarm" },
        { "method": "GET", "path": "/tasks/:id", "description": "Get task status and result" },
        { "method": "GET", "path": "/pipeline/status", "description": "Get 21-stage pipeline health" },
        { "method": "POST", "path": "/pipeline/trigger", "description": "Trigger a full pipeline run" }
      ]
    },
    {
      "name": "Intelligence",
      "prefix": "/intelligence",
      "endpoints": [
        { "method": "POST", "path": "/query", "description": "Query HeadyBrain with semantic search" },
        { "method": "POST", "path": "/vector/store", "description": "Store a vector in VectorMemory" },
        { "method": "POST", "path": "/vector/search", "description": "Semantic vector search" },
        { "method": "GET", "path": "/wisdom/:topic", "description": "Retrieve from WisdomStore" }
      ]
    },
    {
      "name": "Companion",
      "prefix": "/buddy",
      "endpoints": [
        { "method": "POST", "path": "/chat", "description": "Send a message to HeadyBuddy" },
        { "method": "GET", "path": "/personas", "description": "List available personas" },
        { "method": "PUT", "path": "/personas/:id", "description": "Switch active persona" },
        { "method": "GET", "path": "/context", "description": "Get current context state" }
      ]
    },
    {
      "name": "Infrastructure",
      "prefix": "/cloud",
      "endpoints": [
        { "method": "GET", "path": "/status", "description": "Multi-cloud health status" },
        { "method": "POST", "path": "/deploy", "description": "Trigger a deployment" },
        { "method": "GET", "path": "/resources", "description": "Sacred Geometry resource pools" }
      ]
    }
  ]
}
```

---

### `/sites/headycloud.com/content/hero.json`

```json
{
  "headline": "Multi-Cloud Orchestration",
  "subheadline": "Orchestrate across AWS, Cloudflare, Render, and Google Colab from a single φ-scaled control plane. Sacred Geometry resource distribution ensures optimal allocation at every scale.",
  "ctaText": "View Infrastructure",
  "ctaHref": "/infrastructure",
  "secondaryCta": {
    "text": "Pricing",
    "href": "/pricing"
  },
  "backgroundPattern": "sacred-geometry"
}
```

### `/sites/headycloud.com/content/infrastructure.json`

```json
{
  "title": "Infrastructure",
  "providers": [
    {
      "name": "Cloudflare",
      "role": "Edge Computing, CDN, DNS, Workers, Tunneling",
      "services": ["Workers", "KV", "R2", "DNS", "SSL/TLS", "Tunnel"],
      "status": "Active"
    },
    {
      "name": "Render",
      "role": "Application Hosting, Deployment",
      "services": ["Web Services", "Background Workers", "Cron Jobs", "Databases"],
      "status": "Active"
    },
    {
      "name": "AWS",
      "role": "Compute, Storage, AI Services",
      "services": ["EC2", "S3", "Lambda", "SageMaker"],
      "status": "Active"
    },
    {
      "name": "Google Colab",
      "role": "GPU Compute, Model Training",
      "services": ["Pro+ GPU", "Notebooks", "Model Training"],
      "status": "Active"
    }
  ],
  "resourcePools": {
    "hot": { "percentage": 34, "description": "Active workloads, real-time processing" },
    "warm": { "percentage": 21, "description": "Standby services, quick-scale targets" },
    "cold": { "percentage": 13, "description": "Archive, batch processing queues" },
    "reserve": { "percentage": 8, "description": "Emergency capacity, failover" },
    "governance": { "percentage": 5, "description": "Monitoring, auditing, compliance" }
  }
}
```

---

### `/sites/headyos.com/content/hero.json`

```json
{
  "headline": "The Intelligent Device OS",
  "subheadline": "HeadyOS brings φ-scaled AI orchestration to every device. From your Ryzen 9 mini-computer to mobile phones with SSH — intelligent, connected, always-on.",
  "ctaText": "Explore Features",
  "ctaHref": "/features",
  "secondaryCta": {
    "text": "Supported Devices",
    "href": "/devices"
  },
  "backgroundPattern": "mesh"
}
```

---

### `/sites/headyio.com/content/hero.json`

```json
{
  "headline": "Intelligent Data Flow",
  "subheadline": "Connect anything to Heady. Real-time I/O, webhooks, event streams, and intelligent data routing across every node in the ecosystem.",
  "ctaText": "Browse Integrations",
  "ctaHref": "/integrations",
  "secondaryCta": {
    "text": "API Docs",
    "href": "/docs"
  },
  "backgroundPattern": "gradient"
}
```

---

### `/sites/headyweb.com/content/hero.json`

```json
{
  "headline": "The Heady Web Portal",
  "subheadline": "A micro-frontend portal powered by Webpack Module Federation. 7 federated applications in one seamless experience — dashboard, buddy, orchestrator, analytics, and more.",
  "ctaText": "Enter Portal",
  "ctaHref": "/portal",
  "secondaryCta": {
    "text": "Documentation",
    "href": "/docs"
  },
  "backgroundPattern": "mesh"
}
```

### `/sites/headyweb.com/content/microfrontends.json`

```json
{
  "title": "Micro-Frontends",
  "description": "7 federated applications loaded dynamically via Module Federation",
  "apps": [
    { "name": "Dashboard", "remote": "@heady/dashboard", "description": "System overview, health metrics, φ-pipeline status" },
    { "name": "Buddy", "remote": "@heady/buddy", "description": "HeadyBuddy companion interface with persona switching" },
    { "name": "Orchestrator", "remote": "@heady/orchestrator", "description": "Bee swarm visualization, task management, pipeline control" },
    { "name": "Analytics", "remote": "@heady/analytics", "description": "Intelligence analytics, pattern recognition, Monte Carlo sims" },
    { "name": "Settings", "remote": "@heady/settings", "description": "User preferences, API keys, context configuration" },
    { "name": "MCP Manager", "remote": "@heady/mcp-manager", "description": "MCP server registry, tool browser, connection status" },
    { "name": "Cloud Console", "remote": "@heady/cloud-console", "description": "Multi-cloud dashboard, resource pools, deployment status" }
  ]
}
```

---

### Site Template: `/sites/_template/app/layout.tsx`

```tsx
import React from 'react';
import type { Metadata } from 'next';
import { HeadyNavbar } from '@heady/shared-ui/components/HeadyNavbar';
import { HeadyFooter } from '@heady/shared-ui/components/HeadyFooter';
import { resolveBrand } from '@heady/shared-ui/utils/brand-config';
import meta from '../content/meta.json';
import '@heady/shared-ui/styles/globals.css';
import '@heady/shared-ui/styles/tokens.css';

const brand = resolveBrand(process.env.HEADY_DOMAIN || 'headysystems.com');

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.description,
    images: [meta.ogImage],
    siteName: brand.siteName,
  },
  twitter: {
    card: 'summary_large_image',
    title: meta.title,
    description: meta.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href={`https://fonts.googleapis.com/css2?family=${brand.theme.font.replace(' ', '+')}:wght@400;500;600;700&display=swap`}
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: `'${brand.theme.font}', sans-serif`, margin: 0 }}>
        <HeadyNavbar
          siteName={brand.siteName}
          links={brand.nav}
          theme={brand.theme}
        />
        <main>{children}</main>
        <HeadyFooter
          siteName={brand.siteName}
          domain={brand.domain}
          theme={brand.theme}
          showPatents={brand.type === 'corporate'}
        />
      </body>
    </html>
  );
}
```

### Site Template: `/sites/_template/app/page.tsx`

```tsx
import React from 'react';
import { HeadyHero } from '@heady/shared-ui/components/HeadyHero';
import { HeadyFeatureGrid } from '@heady/shared-ui/components/HeadyFeatureGrid';
import { resolveBrand } from '@heady/shared-ui/utils/brand-config';
import hero from '../content/hero.json';
import features from '../content/features.json';

const brand = resolveBrand(process.env.HEADY_DOMAIN || 'headysystems.com');

export default function HomePage() {
  return (
    <>
      <HeadyHero
        headline={hero.headline}
        subheadline={hero.subheadline}
        ctaText={hero.ctaText}
        ctaHref={hero.ctaHref}
        secondaryCta={hero.secondaryCta}
        theme={brand.theme}
        backgroundPattern={hero.backgroundPattern as any}
      />
      <HeadyFeatureGrid
        title={features.title}
        features={features.features}
        theme={brand.theme}
      />
    </>
  );
}
```

### Site Template: `/sites/_template/app/api/health/route.ts`

```ts
import { NextResponse } from 'next/server';

const PHI = 1.618033988749895;
const startTime = Date.now();

export async function GET() {
  const uptimeMs = Date.now() - startTime;
  const domain = process.env.HEADY_DOMAIN || 'unknown';

  return NextResponse.json({
    status: 'healthy',
    domain,
    node: process.env.HEADY_NODE || 'unknown',
    uptime: {
      ms: uptimeMs,
      phiCycles: Math.floor(uptimeMs / (PHI * 1000)),
    },
    version: process.env.HEADY_VERSION || '5.0.0',
    timestamp: new Date().toISOString(),
    ecosystem: 'Heady™',
    company: 'HeadySystems Inc.',
  });
}
```

---

### `/workers/domain-router/src/index.ts`

```ts
/**
 * Heady™ Domain Router — Cloudflare Worker
 * Routes incoming requests to the correct Render deployment
 * based on the Host header.
 */

interface DomainRoute {
  backend: string;
  node: string;
}

const DOMAIN_ROUTES: Record<string, DomainRoute> = {
  'headysystems.com':     { backend: 'headysystems.onrender.com', node: 'HeadySystems' },
  'www.headysystems.com': { backend: 'headysystems.onrender.com', node: 'HeadySystems' },

  'headyconnection.org
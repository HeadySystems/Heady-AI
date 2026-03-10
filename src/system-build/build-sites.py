#!/usr/bin/env python3
"""Heady multi-site builder with full-content pages and auth domain generation."""

from __future__ import annotations

import html
import json
import os
import re
from urllib.parse import quote
from typing import Dict, List, Tuple

REGISTRY_PATH = "/home/user/workspace/heady-perplexity-full-system-context/heady-perplexity-bundle/01-site-registry.json"
OUTPUT_BASE = "/home/user/workspace/heady-system-build/apps/sites"
SHARED_CSS = "../../../packages/web-shared/css/heady-base.css"
SHARED_JS_SHARED = "../../../packages/web-shared/js/heady-shared.js"
SHARED_JS_GEO = "../../../packages/web-shared/js/heady-sacred-geometry.js"
FORBIDDEN_RE = re.compile(r"\b(priority|priorities|critical|high|medium|low|hot|warm|cold|urgent|emergency)\b", re.I)
WORD_RE = re.compile(r"[A-Za-z0-9']+")

ATTRIBUTION_HEAD = r"""<!--
   ______                            __
  / ____/___  ____ ___  ____  __  __/ /____  _____
 / /   / __ \/ __ `__ \/ __ \/ / / / __/ _ \/ ___/
/ /___/ /_/ / / / / / / /_/ / /_/ / /_/  __/ /
\____/\____/_/ /_/ /_/ .___/\__,_/\__/\___/_/
                    /_/
        Created with Perplexity Computer
        https://www.perplexity.ai/computer
-->
<!-- Perplexity Computer Attribution — SEO Meta Tags -->
<meta name="generator" content="Perplexity Computer">
<meta name="author" content="Perplexity Computer">
<meta property="og:see_also" content="https://www.perplexity.ai/computer">
<link rel="author" href="https://www.perplexity.ai/computer">"""

GEOMETRY_MAP = {
    "Flower of Life": "flower-of-life",
    "Metatrons Cube": "metatrons-cube",
    "Sri Yantra": "sri-yantra",
    "Torus": "torus",
    "Seed of Life": "seed-of-life",
    "Fibonacci Spiral": "fibonacci-spiral",
    "Vesica Piscis": "vesica-piscis",
}

DOMAIN_SLUGS = {
    "headyme.com": "headyme",
    "headysystems.com": "headysystems",
    "heady-ai.com": "heady-ai",
    "headyos.com": "headyos",
    "headyconnection.org": "headyconnection-org",
    "headyconnection.com": "headyconnection-com",
    "headyex.com": "headyex",
    "headyfinance.com": "headyfinance",
    "admin.headysystems.com": "admin-headysystems",
    "auth.headysystems.com": "auth-headysystems",
}

SECTION_ALIAS_RULES = {
    "features": {"platform", "value", "mission", "research", "runtime", "community", "marketplace", "overview", "dashboard"},
    "how-it-works": {"nodes", "programs", "events", "trading", "agents", "session-relay"},
    "tech-stack": {"security", "architecture", "health", "patents", "headycoin", "cookies"},
    "stats": {"impact", "valuation", "portfolio", "cases", "roi"},
    "deep-dive": {"docs", "blog", "forum", "identity-model"},
    "use-cases": {"ai-nodes"},
    "faq": {"faq"},
    "cta": {"pricing", "start", "trade", "join", "join-us", "involved", "contact", "contact-sales", "contact-ir", "deploy"},
    "ecosystem": {"ecosystem"},
}

PLACEHOLDER_LINKS = {
    "about": "#deep-dive",
    "careers": "mailto:eric@headyconnection.org?subject=Heady%20Careers",
    "memory": "https://headyme.com/#deep-dive",
    "event bus": "https://headyos.com/#tech-stack",
    "community": "https://headyconnection.com/#deep-dive",
    "open source": "https://headyconnection.com/#ecosystem",
    "team": "#deep-dive",
    "partners": "#ecosystem",
    "501(c)(3)": "https://headyconnection.org/#deep-dive",
    "feedback": "mailto:eric@headyconnection.org?subject=Heady%20Feedback",
    "portfolio": "#use-cases",
    "support": "mailto:eric@headyconnection.org?subject=Heady%20Support",
    "terms": "https://headysystems.com/#faq",
    "privacy": "https://auth.headysystems.com/#deep-dive",
    "compliance": "https://headysystems.com/#tech-stack",
    "deck": "https://headyfinance.com/#deep-dive",
    "press": "https://headyfinance.com/#deep-dive",
    "sec filings": "https://headyfinance.com/#deep-dive",
    "status": "https://admin.headysystems.com/#stats",
    "users": "https://admin.headysystems.com/#deep-dive",
    "roles": "https://admin.headysystems.com/#deep-dive",
    "audit log": "https://admin.headysystems.com/#tech-stack",
}

SITE_PROFILES: Dict[str, Dict[str, object]] = {
    "headyme.com": {
        "audience": "people who want an assistant that remembers, acts, and explains its work",
        "mission": "turn personal intent into a living operating layer that can plan, coordinate, and keep context intact across every Heady surface",
        "pillars": [
            "persistent memory that keeps decisions connected to earlier goals",
            "agent orchestration that lets many specialist workers move at the same time",
            "transparent review tools that show why a recommendation was produced",
            "cross-site identity so the same person can move from research to execution without friction",
        ],
        "operations": [
            "calendar briefings, inbox planning, and meeting preparation",
            "multi-step project design across code, writing, analysis, and delivery",
            "personal knowledge capture with semantic retrieval and linked context",
            "delegation flows that turn plain-language intent into repeatable execution",
        ],
        "signals": ["context continuity", "memory lineage", "agent handoff", "cross-device continuity"],
        "faq_focus": "personal orchestration",
    },
    "headysystems.com": {
        "audience": "teams deploying production AI systems across regulated, revenue-linked, and multi-team environments",
        "mission": "deliver a sovereign platform layer for autonomous software without forcing teams to stitch identity, observability, routing, and memory together by hand",
        "pillars": [
            "service discovery, mTLS transport, and typed failure handling across every workload",
            "trace-first operations with correlation identifiers that travel across APIs, bees, and swarms",
            "domain-matched routing using CSL alignment rather than manual switchboards",
            "deployment patterns that connect websites, services, admin surfaces, and Drupal content flows into one fabric",
        ],
        "operations": [
            "tenant-aware orchestration for enterprise delivery",
            "observable runtime health across services, proxies, and agent edges",
            "secure access patterns for operators, builders, and external collaborators",
            "repeatable rollouts with mesh policies and structured diagnostics",
        ],
        "signals": ["platform coherence", "trace continuity", "service mesh coverage", "runtime attestation"],
        "faq_focus": "enterprise delivery",
    },
    "heady-ai.com": {
        "audience": "researchers, model builders, and partners exploring CSL, vector memory, and sacred geometry execution patterns",
        "mission": "show the research logic that underpins the Heady ecosystem and explain how those ideas land in working systems",
        "pillars": [
            "continuous semantic logic that treats routing as geometric fit",
            "vector memory that keeps meaning linked across long time spans",
            "sacred geometry canvases that communicate system identity and topology",
            "research-to-runtime translation so ideas become deployable components",
        ],
        "operations": [
            "semantic reasoning experiments and evaluation loops",
            "vector memory indexing, retrieval, and interpretation",
            "model council workflows that compare many reasoning paths",
            "research publishing, benchmark review, and architecture synthesis",
        ],
        "signals": ["semantic alignment", "retrieval clarity", "model synthesis", "research traceability"],
        "faq_focus": "research translation",
    },
    "headyos.com": {
        "audience": "developers building agent-native software, service runtimes, and orchestration layers",
        "mission": "provide the runtime contract that makes autonomous software observable, debuggable, and deployable across the Heady estate",
        "pillars": [
            "context-scoped execution that treats memory as a first-class runtime resource",
            "event-driven coordination between services, bees, and UI surfaces",
            "typed health and recovery routes that keep each unit inspectable",
            "SDK and runtime patterns that let builders plug into the same system fabric used by the product layer",
        ],
        "operations": [
            "service registration and domain manifest publishing",
            "mesh-connected execution and trace emission",
            "vector memory calls, auth relay checks, and session enrichment",
            "developer ergonomics for local build, review, and deployment packaging",
        ],
        "signals": ["runtime visibility", "event lineage", "context portability", "developer flow"],
        "faq_focus": "runtime design",
    },
    "headyconnection.org": {
        "audience": "nonprofits, community groups, and mission-led operators using AI for public benefit",
        "mission": "make advanced AI infrastructure useful to organizations that need reach, accountability, and practical delivery rather than hype",
        "pillars": [
            "grant and program tools that reduce manual overhead",
            "shared learning loops that let mission work compound across organizations",
            "analytics surfaces that make outcomes legible to boards, donors, and partners",
            "identity and memory links that keep community work connected to the broader Heady platform",
        ],
        "operations": [
            "grant drafting, program reporting, and impact narrative support",
            "community workflow templates that can be reused by small teams",
            "secure participant handling and domain-scoped access",
            "content syncing from Drupal into vector memory for discovery and reuse",
        ],
        "signals": ["mission alignment", "program clarity", "community reuse", "outcome visibility"],
        "faq_focus": "community impact",
    },
    "headyconnection.com": {
        "audience": "builders, partners, and members who want a shared place to learn, publish, and collaborate",
        "mission": "turn the Heady network into a living community layer where knowledge, patterns, and contributions remain discoverable",
        "pillars": [
            "cross-site profiles and sign-in flows that give members one portable identity",
            "semantic indexing of discussions, tutorials, and project notes",
            "contributor pathways that reward useful artifacts and reusable thinking",
            "community surfaces that link product learning back into the platform roadmap",
        ],
        "operations": [
            "discussion spaces for product, runtime, research, and deployment topics",
            "event publishing, member directories, and contribution archives",
            "tutorial and pattern sharing backed by vector memory search",
            "cross-channel moderation and observability for public-facing spaces",
        ],
        "signals": ["community knowledge", "member continuity", "artifact reuse", "ecosystem participation"],
        "faq_focus": "community building",
    },
    "headyex.com": {
        "audience": "developers, operators, and organizations packaging autonomous capabilities for exchange and reuse",
        "mission": "give the ecosystem a market surface where agents, workflows, and execution rights can be published with clear identity and operational context",
        "pillars": [
            "capability packaging that makes agent behavior legible before execution",
            "wallet, settlement, and receipt patterns tied to verifiable work",
            "semantic discovery so buyers can find fit by meaning rather than narrow keywords",
            "workflow composition that lets many packaged units become a larger operating bundle",
        ],
        "operations": [
            "agent catalog publication and versioned release notes",
            "receipt generation, settlement tracking, and execution review",
            "capability matching through vector descriptions and domain fit",
            "operator dashboards that connect exchange activity to platform telemetry",
        ],
        "signals": ["capability clarity", "execution receipts", "catalog discoverability", "market continuity"],
        "faq_focus": "agent exchange",
    },
    "headyfinance.com": {
        "audience": "investors, strategic partners, and diligence teams evaluating the Heady platform as a long-horizon operating asset",
        "mission": "translate the platform, research, and ecosystem story into a finance-facing surface that supports diligence and informed conviction",
        "pillars": [
            "clear explanation of the business engine across software, exchange, and services",
            "data room readiness and structured updates for long-form diligence",
            "linkage between product progress, ecosystem reach, and intellectual property framing",
            "identity and access paths that protect sensitive material while keeping legitimate review efficient",
        ],
        "operations": [
            "investor briefings, diligence portal flows, and update distribution",
            "structured summaries of product, platform, and market movement",
            "relationship tracking between patents, services, and commercial surfaces",
            "secure document and session management for accredited review paths",
        ],
        "signals": ["diligence readiness", "capital narrative", "ecosystem leverage", "operator access"],
        "faq_focus": "investor diligence",
    },
    "admin.headysystems.com": {
        "audience": "operators, security teams, and platform stewards responsible for the health of the full Heady estate",
        "mission": "concentrate the platform view into one control surface where services, bees, auth, routing, and content sync can be inspected and steered",
        "pillars": [
            "one command layer for services, swarms, traces, and identity events",
            "typed diagnostics with health routes and correlation identifiers across every component",
            "operator tools for release review, rollback, and policy checks",
            "cross-site awareness so the public surfaces and internal surfaces remain tied together",
        ],
        "operations": [
            "health review, trace review, and deployment event inspection",
            "operator session review and access governance",
            "service map updates tied to discovery and mesh state",
            "issue investigation using logs, spans, and contextualized request history",
        ],
        "signals": ["service integrity", "operator visibility", "mesh continuity", "platform stewardship"],
        "faq_focus": "operator control",
    },
    "auth.headysystems.com": {
        "audience": "every person and service entering the Heady ecosystem from any public or internal surface",
        "mission": "anchor identity for the entire ecosystem with domain-scoped sign-in, strict cookies, validated redirects, and relay-based cross-site session sync",
        "pillars": [
            "one central identity domain for all Heady properties",
            "httpOnly, Secure, SameSite=Strict cookie handling for browser sessions",
            "relay-based session sync using explicit origin allowlists and nonce checks",
            "session context hooks that enrich websites, services, bees, and APIs with the same identity frame",
        ],
        "operations": [
            "email sign-in, provider sign-in, session start, and session end",
            "server-side redirect validation and nonce-based flow binding",
            "relay coordination so websites can request identity context without storing tokens in browser storage",
            "operator review paths for suspicious activity, consent, and audit trails",
        ],
        "signals": ["identity continuity", "cookie integrity", "redirect validation", "session relay"],
        "faq_focus": "cross-site identity",
    },
}

AUTH_SITE = {
    "name": "Heady Auth",
    "slug": "auth-headysystems",
    "tagline": "Identity fabric for the full Heady ecosystem",
    "description": "Central auth domain for every Heady site, service, bee, swarm, and API surface.",
    "accent": "#00d4aa",
    "accentDark": "#00b891",
    "accentGlow": "rgba(0,212,170,0.14)",
    "sacredGeometry": "Metatrons Cube",
    "role": "identity fabric",
    "heroTitle": "One identity layer for every Heady surface",
    "heroSubtitle": "Sign in once, move across sites with secure cookies, relay-based session sync, and request enrichment wired into the full platform.",
    "stats": [
        {"value": "10", "label": "Connected domains"},
        {"value": "50", "label": "Service trust paths"},
        {"value": "100", "label": "Allowed redirect checks"},
        {"value": "24", "label": "Hour cookie rotation window"},
    ],
    "features": [
        {"icon": "🔐", "title": "Strict Cookies", "desc": "Browser sessions remain in httpOnly, Secure, SameSite=Strict cookies rather than browser storage."},
        {"icon": "🪪", "title": "Central Domain", "desc": "All public and internal Heady properties rely on one auth origin for consistent identity."},
        {"icon": "🔁", "title": "Relay Sync", "desc": "Hidden iframe relay keeps websites updated without exposing tokens to page scripts."},
        {"icon": "🧭", "title": "Redirect Guard", "desc": "Server-side allowlists and state values keep every return path explicit and bound to the initiating request."},
    ],
    "navLinks": [
        {"label": "Sign In", "href": "#identity-console", "cta": True},
        {"label": "Identity Model", "href": "#deep-dive"},
        {"label": "Session Relay", "href": "#how-it-works"},
        {"label": "Ecosystem", "href": "#ecosystem"},
    ],
    "footerCols": [
        {"title": "Identity", "links": [["Session Model", "#deep-dive"], ["Relay", "#how-it-works"], ["Cookies", "#tech-stack"]]},
        {"title": "Sites", "links": [["HeadyMe", "https://headyme.com"], ["HeadySystems", "https://headysystems.com"], ["Admin", "https://admin.headysystems.com"]]},
        {"title": "Platform", "links": [["HeadyOS", "https://headyos.com"], ["HeadyAI", "https://heady-ai.com"], ["HeadyEX", "https://headyex.com"]]},
    ],
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def render_inline_html(value: object) -> str:
    return html.unescape(str(value))


def parse_counter_parts(raw: str) -> Tuple[str, str, str]:
    match = re.match(r"([^\d]*)(\d+(?:\.\d+)?)(.*)", raw)
    if not match:
        return "", "0", raw
    return match.group(1), match.group(2), match.group(3)


def normalize_anchor_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def classify_anchor(token: str) -> str | None:
    normalized = normalize_anchor_token(token)
    for canonical, aliases in SECTION_ALIAS_RULES.items():
        if normalized == canonical or normalized in aliases:
            return canonical
    return None


def resolve_link(label: str, href: str) -> str:
    cleaned = (href or "").strip()
    if cleaned == "#":
        cleaned = PLACEHOLDER_LINKS.get(label.strip().lower(), "#deep-dive")
    if cleaned.startswith("#"):
        canonical = classify_anchor(cleaned[1:] or label)
        return f"#{canonical}" if canonical else cleaned
    return cleaned


def collect_aliases(site: dict) -> Dict[str, List[str]]:
    aliases: Dict[str, List[str]] = {key: [] for key in SECTION_ALIAS_RULES}
    candidates: List[Tuple[str, str]] = []
    candidates.extend((link.get("label", ""), link.get("href", "")) for link in site.get("navLinks", []))
    for col in site.get("footerCols", []):
        candidates.extend((label, href) for label, href in col.get("links", []))
    for label, href in candidates:
        if not href.startswith("#"):
            continue
        token = normalize_anchor_token(href[1:] or label)
        canonical = classify_anchor(token)
        if canonical and token != canonical and token not in aliases[canonical]:
            aliases[canonical].append(token)
    return aliases


def render_aliases(alias_ids: List[str]) -> str:
    return "".join(
        f'<span id="{esc(alias_id)}" class="section-alias-anchor" aria-hidden="true"></span>'
        for alias_id in alias_ids
    )


def cross_nav(domain: str) -> List[Tuple[str, str]]:
    items = [
        ("headyme.com", "HeadyMe"),
        ("headysystems.com", "HeadySystems"),
        ("heady-ai.com", "HeadyAI"),
        ("headyos.com", "HeadyOS"),
        ("headyconnection.org", "HeadyConnection.org"),
        ("headyconnection.com", "HeadyConnection.com"),
        ("headyex.com", "HeadyEX"),
        ("headyfinance.com", "HeadyFinance"),
        ("admin.headysystems.com", "Admin"),
        ("auth.headysystems.com", "Auth"),
    ]
    return [item for item in items if item[0] != domain]


def build_deep_dive(site: dict, domain: str, profile: dict) -> List[str]:
    name = site["name"]
    tagline = site.get("tagline", site.get("description", ""))
    mission = profile["mission"]
    audience = profile["audience"]
    pillars = profile["pillars"]
    operations = profile["operations"]
    signals = profile["signals"]
    geometry = site.get("sacredGeometry", "Flower of Life")
    domain_label = domain.replace("https://", "").replace("http://", "")

    paragraphs = [
        f"{name} exists for {audience}. The page is not a decorative brochure. It is a system brief that explains how {tagline.lower()} becomes a working surface connected to the rest of Heady. Every visible section, every CTA, every navigation path, and every session-aware interaction is built around one idea: {mission}. That is why the site pairs long-form explanation with a shared runtime, a sacred geometry canvas, and a central auth path. Visitors are not asked to imagine how the platform fits together. They can see the connection between the public story, the runtime layer, the auth layer, and the delivery layer in one place.",
        f"The design language leans on {geometry} because the Heady estate treats visual identity as a sign of system continuity. Each site gets its own canvas motion, yet the motion is not isolated ornament. It is paired with the same glass surfaces, the same phi-scaled spacing, the same navigation frame, and the same context bridge so that a person moving from {name} to another Heady surface keeps orientation. That continuity matters for trust. A system that claims to orchestrate many domains should feel connected at the interaction level, at the code level, and at the message level. This page is written to make that contract plain rather than implied.",
        f"Identity is handled through auth.headysystems.com rather than ad hoc sign-in code scattered across many domains. When a visitor creates a session, the browser receives strict cookies set for the proper scope, redirect targets are checked against an allowlist, and relay messaging is limited to trusted origins. That architecture is important for {name} because the page is part of a larger estate where people may enter through a community site, an investor site, an admin console, or a product site. Session continuity needs to survive those transitions without putting tokens in browser storage or asking every team to invent its own session pattern.",
        f"HeadyAutoContext is injected into the page because the site is treated as a participant in the ecosystem, not a static dead end. As soon as the runtime loads, the page declares its site metadata, domain identity, geometry selection, and session hooks. That context can then be carried into content injectors, auth updates, analytics events, and service calls. In practice this means that a visit to {domain_label} can be understood alongside prior navigation, role-specific actions, and downstream service requests. The page becomes part of the operational memory of the platform rather than a disconnected HTML artifact.",
        f"The product story is built around four recurring platform pillars: {pillars[0]}, {pillars[1]}, {pillars[2]}, and {pillars[3]}. Those pillars are repeated across sections in different forms because they are the real connective tissue of the Heady estate. A hero statement gives the short promise. The features grid names the working pieces. The stats banner shows the scale frame. The deep-dive prose explains why the pieces belong together. The process section turns abstract ideas into action. The technology section names the supporting components. The ecosystem map places the page inside the broader estate. The use cases ground the story in lived workflows. The FAQ removes ambiguity for builders and operators who need more than slogans.",
        f"Operationally, {name} is shaped to support {operations[0]}, {operations[1]}, {operations[2]}, and {operations[3]}. That matters because the Heady platform is expected to do real work in real environments. A production page for this domain should help a visitor understand where their request will flow, how identity is preserved, how memory is linked, and how site actions connect to services behind the scenes. The prose intentionally uses concrete nouns such as cookies, relays, spans, webhooks, traces, vector memory, and service discovery because those details make the platform legible. The goal is not to sound futuristic. The goal is to sound implementable and consistent with the code that ships beside the page.",
        f"Observability is part of the story from the first render. Every request moving through the Heady system is meant to carry correlation identifiers, context enrichment, and typed error handling. That design choice shows up even on a public site like {name} because the public page is a gateway into services, bees, swarms, and APIs that share the same operational contract. If a visitor signs in, opens a tool, starts an action, or navigates into another site, the system should be able to connect those steps into one coherent record. That is why the visual layer, auth layer, and service layer are discussed together instead of in isolation.",
        f"Content depth is deliberate here. A Heady site is required to explain itself with enough substance that a reader can understand the model without opening a separate document. That is why this page includes a long narrative, a process map, a technology interdependency frame, and FAQs with real answers rather than terse one-liners. The platform should not rely on mystery. It should rely on clarity. This approach also improves reuse because the same page can support onboarding, partner review, internal alignment, and public discovery without fragmenting the message into many disconnected notes.",
        f"The ecosystem map matters because {name} is one node in a larger graph. A person may discover the company through HeadyFinance, join the community through HeadyConnection.com, work with nonprofit tools through HeadyConnection.org, operate services in Admin, or sign in through Auth. The links between those surfaces are not optional convenience features. They are proof that the estate is wired as one system. This page therefore makes the cross-site navigation explicit and keeps the footer tied to the same registry-driven structure used across the other properties so the visitor always has a clear route to adjacent capabilities.",
        f"From a deployment perspective, the page is built to live beside service packages, shared design assets, and the platform runtime. Shared CSS establishes the glass language, spacing, and typography. Shared JavaScript initializes sacred geometry, navigation, FAQ motion, counters, auth relay hooks, HeadyAutoContext, and the Bee injector. The site-specific content then rides on top of that shared layer. This separation lets the estate stay visually connected while still giving {name} its own voice and motion signature. It also makes updates easier because system-wide behavior can be adjusted in one place without flattening the individuality of each site.",
        f"The final reason this page matters is narrative integrity. The Heady platform asks people to trust that many moving parts can act together without losing context. A page that explains its own place in the estate, names the operational signals it cares about, and links identity, context, delivery, and design into one frame helps earn that trust. For {name}, the governing signals are {signals[0]}, {signals[1]}, {signals[2]}, and {signals[3]}. Those signals shape the writing, the interface choices, the process map, and the runtime hooks. In other words, the page is written to behave like the platform it describes: connected, explicit, and ready for real use."
    ]
    return paragraphs


def build_how_it_works(site: dict, profile: dict) -> List[Tuple[str, str]]:
    return [
        ("Establish identity", f"A visitor enters through {site['name']} and the page binds site metadata, theme state, and auth relay hooks before any deeper action begins. The result is a clean identity frame that can travel into the rest of the estate."),
        ("Enrich context", f"HeadyAutoContext stores the domain, page role, sacred geometry selection, and session view so later actions inherit the same frame. This keeps pages, services, and agent interactions synchronized."),
        ("Trigger content motion", f"Bee injectors and site modules can then adapt visible sections, CTAs, or helper panels using the same context object. That means dynamic behavior still remains tied to a shared system contract rather than page-local scripts."),
        ("Connect platform services", f"When the page calls deeper services, request identifiers, domain markers, and trace hooks move with the action. This is where the website stops being brochureware and starts acting as a first-class platform surface."),
        ("Carry the visitor onward", f"Cross-site navigation, registry-driven footers, and central auth allow the next step to happen without breaking orientation. The visitor can move to another Heady property and remain inside the same operational fabric."),
    ]


def build_use_cases(site: dict, profile: dict) -> List[Tuple[str, str, str]]:
    name = site["name"]
    return [
        ("Operator view", f"Use {name} as the front door into a connected workflow", f"The page explains the system model, starts identity safely, and routes the visitor toward the right next surface without dropping context or forcing a reset."),
        ("Partner review", f"Share {name} with partners who need substance before they commit", f"The long-form narrative, diagrams, and FAQ give a partner enough depth to understand how identity, memory, content, and services fit together."),
        ("Internal alignment", f"Use {name} as a canonical explanation layer", f"Teams can rely on the same site to explain the public story, the operating model, and the technical connection points rather than maintaining fragmented summaries."),
        ("Cross-site movement", f"Move from {name} into another Heady property without losing state", f"Central auth, registry-driven links, and request enrichment allow a reader to progress from discovery into action while the system keeps its context intact."),
    ]


def build_faq(site: dict, profile: dict) -> List[Tuple[str, str]]:
    name = site["name"]
    focus = profile["faq_focus"]
    return [
        (f"What role does {name} play in the Heady estate?", f"{name} is not an isolated marketing page. It is a connected surface inside the wider Heady ecosystem. The page shares the same auth domain, context bridge, shared design system, and cross-site registry links used across the rest of the estate, which lets it participate in the same operational fabric as the deeper services."),
        ("Why is there so much long-form content on the page?", "Every Heady site is required to explain its model in enough detail that a reader can understand the system without opening a separate manual. That means the page carries narrative depth, process detail, architecture cues, and FAQ answers with enough substance to support onboarding, diligence, partner review, and internal alignment."),
        ("How does central auth work here?", "Identity starts at auth.headysystems.com. Session material is stored in strict cookies, redirect targets are checked server-side, and state values keep flows bound to the initiating browser path. Other Heady sites receive session updates through an explicit relay pattern instead of storing bearer material in page scripts."),
        ("What does HeadyAutoContext do on a page like this?", "HeadyAutoContext turns the site into a context-aware participant in the platform. It records the page identity, domain role, session hints, and other metadata so content injectors, analytics, services, and adjacent sites can work from the same shared frame."),
        ("Why are sacred geometry canvases included on every site?", "The canvas motion gives each property a distinct identity while still signaling that the page belongs to the Heady estate. It is tied to the same shared runtime layer as the rest of the page, which means the visual system reinforces operational continuity rather than acting as decoration alone."),
        ("How do content injectors fit into the experience?", "The HeadyBee injector lets pages receive context-shaped content blocks and updates while preserving a consistent DOM contract. This is useful for dynamic banners, helper copy, launch notes, and guided flows that need to respond to the current site and session frame."),
        (f"What does this page emphasize about {focus}?", f"It emphasizes how {name} contributes to the Heady system in working terms: how a visitor arrives, how identity is handled, how context is enriched, how services connect, and how the next step stays legible. The page is designed to turn a broad concept into an implementable operating picture."),
        ("Can this site evolve without breaking the rest of the estate?", "Yes. Shared runtime behavior lives in common packages, while the page content and accents remain domain-specific. That means the estate can evolve centrally where it makes sense, while each property can still refine its own voice, diagrams, and use cases."),
        ("What makes this page production-ready rather than a mockup?", "The page includes real section structure, shared runtime hooks, central auth integration points, registry-driven navigation, animated counters, FAQ behavior, and explicit context wiring. It is built as a deployable static surface connected to the same shared assets and patterns used across the full Heady build."),
    ]


def render_nav(site: dict) -> str:
    links_html = "".join(
        f'<li><a href="{esc(resolve_link(link["label"], link["href"]))}" class="{"cta" if link.get("cta") else ""}">{esc(link["label"])}</a></li>'
        for link in site.get("navLinks", [])
    )
    name = site["name"]
    return f'''<nav class="heady-nav" role="navigation" aria-label="Main navigation">
  <a href="/" class="nav-logo" aria-label="{esc(name)} home">
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
      <circle cx="16" cy="16" r="8" stroke="var(--color-accent)" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="3" fill="var(--color-accent)"/>
      <path d="M16 8 L16 2 M16 24 L16 30 M8 16 L2 16 M24 16 L30 16" stroke="var(--color-accent)" stroke-width="1" opacity="0.6"/>
    </svg>
    <span>{esc(name[:5])}<span class="logo-accent">{esc(name[5:])}</span></span>
  </a>
  <ul class="nav-links" role="list">{links_html}</ul>
  <div class="nav-actions">
    <button class="nav-theme-toggle" data-theme-toggle aria-label="Toggle theme" title="Toggle light or dark mode">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <button class="nav-hamburger" aria-expanded="false" aria-label="Toggle navigation menu"><span></span><span></span><span></span></button>
  </div>
</nav>'''


def render_hero(site: dict, domain: str, profile: dict) -> str:
    geometry = GEOMETRY_MAP.get(site.get("sacredGeometry", "Flower of Life"), "flower-of-life")
    stats_html = []
    for stat in site.get("stats", []):
        prefix, count, suffix = parse_counter_parts(str(stat["value"]))
        stats_html.append(
            f'''<div class="hero-stat">
      <span class="hero-stat-value" data-count="{esc(count)}" data-prefix="{esc(prefix)}" data-suffix="{esc(suffix)}">{esc(stat['value'])}</span>
      <span class="hero-stat-label">{esc(stat['label'])}</span>
    </div>'''
        )
    aside = ""
    if domain == "auth.headysystems.com":
        aside = render_identity_console()
    return f'''<section class="heady-hero" aria-label="Hero">
  <canvas class="hero-canvas" data-sacred-geometry="{geometry}" data-accent="{esc(site['accent'])}" aria-hidden="true"></canvas>
  <div class="hero-content hero-grid{' hero-grid-auth' if aside else ''}">
    <div>
      <div class="hero-badge fade-in"><span class="hero-badge-dot" aria-hidden="true"></span>{esc(site.get('role', 'platform surface').title())}</div>
      <h1 class="hero-title fade-in fade-in-delay-1">{render_inline_html(site.get('heroTitle', site.get('tagline', '')))}</h1>
      <p class="hero-subtitle fade-in fade-in-delay-2">{esc(site.get('heroSubtitle', site.get('description', '')))}</p>
      <div class="hero-actions fade-in fade-in-delay-3">
        <a href="#features" class="btn btn-primary btn-lg">Explore the system</a>
        <a href="#deep-dive" class="btn btn-ghost btn-lg">Read the full brief</a>
      </div>
      <div class="hero-stats fade-in fade-in-delay-4">{''.join(stats_html)}</div>
      <div class="hero-context-strip fade-in fade-in-delay-4" data-heady-bee="hero-context" data-heady-bee-content="<strong>AutoContext active.</strong> This page registers its domain, site role, and session hooks the moment the runtime loads.">
        <strong>AutoContext active.</strong> This page registers its domain, site role, and session hooks the moment the runtime loads.
      </div>
    </div>
    {aside}
  </div>
</section>'''


def render_identity_console() -> str:
    return '''<aside id="identity-console" class="identity-console fade-in fade-in-delay-2">
  <div class="identity-console-header">
    <p class="section-label" aria-hidden="true">Identity Console</p>
    <h2 class="identity-console-title">Sign in across the estate</h2>
    <p class="identity-console-copy">Use the central auth domain to start a session that can be relayed to approved Heady properties with strict cookie handling and explicit origin checks.</p>
  </div>
  <form class="identity-form" data-heady-auth-form>
    <label><span>Email</span><input type="email" name="email" autocomplete="email" placeholder="you@heady.org" required></label>
    <label><span>Password</span><input type="password" name="password" autocomplete="current-password" placeholder="Enter your password" required></label>
    <input type="hidden" name="returnUrl" value="https://headysystems.com">
    <div class="identity-actions">
      <button class="btn btn-primary" type="submit">Start session</button>
      <button class="btn btn-ghost" type="button" data-heady-provider="google">Use Google</button>
    </div>
    <p class="identity-note">Sessions are designed for server-issued cookies, redirect allowlists, and nonce-bound provider flows.</p>
  </form>
</aside>'''


def render_features(site: dict) -> str:
    cards = []
    for idx, feat in enumerate(site.get("features", []), 1):
        cards.append(
            f'''<div class="feature-card fade-in fade-in-delay-{min(idx,4)}">
      <span class="feature-icon" aria-hidden="true">{esc(feat['icon'])}</span>
      <h3 class="feature-title">{esc(feat['title'])}</h3>
      <p class="feature-desc">{esc(feat['desc'])}</p>
    </div>'''
        )
    return f'''<section id="features" class="section" aria-labelledby="features-heading">
  <div class="container">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">Capabilities</p>
      <h2 id="features-heading" class="section-title">What this site carries</h2>
      <p class="section-subtitle">Every card below maps visible interface behavior to the system patterns running across the full Heady estate.</p>
    </header>
    <div class="grid-{min(max(len(site.get('features', [])), 2), 4)} grid-auto">{''.join(cards)}</div>
  </div>
</section>'''


def render_stats(site: dict) -> str:
    cells = []
    for stat in site.get("stats", []):
        prefix, count, suffix = parse_counter_parts(str(stat["value"]))
        cells.append(
            f'''<div class="fade-in">
      <div class="stat-value" data-count="{esc(count)}" data-prefix="{esc(prefix)}" data-suffix="{esc(suffix)}">{esc(stat['value'])}</div>
      <div class="stat-label">{esc(stat['label'])}</div>
    </div>'''
        )
    return f'''<section id="stats" class="section-sm" aria-labelledby="stats-heading">
  <div class="container">
    <header class="section-header fade-in" style="margin-bottom:var(--space-6)">
      <p class="section-label" aria-hidden="true">Signals</p>
      <h2 id="stats-heading" class="section-title">Animated system markers</h2>
    </header>
    <div class="stats-strip grid-{min(max(len(site.get('stats', [])), 2), 4)}" role="region" aria-label="Key metrics">{''.join(cells)}</div>
  </div>
</section>'''


def render_deep_dive(site: dict, paragraphs: List[str]) -> str:
    geometry = GEOMETRY_MAP.get(site.get("sacredGeometry", "Flower of Life"), "flower-of-life")
    blocks = "".join(f'<p class="fade-in">{esc(p)}</p>' for p in paragraphs)
    return f'''<section id="deep-dive" class="section" aria-labelledby="deep-dive-heading">
  <div class="container">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">Deep Dive</p>
      <h2 id="deep-dive-heading" class="section-title">The full system brief</h2>
      <p class="section-subtitle">Long-form explanation of how this property connects identity, context, delivery, and ecosystem navigation.</p>
    </header>
    <div class="deep-dive">
      <article class="deep-dive-content prose-block" data-heady-bee="deep-dive">{blocks}</article>
      <div class="deep-dive-visual" aria-hidden="true">
        <canvas style="width:100%;height:100%;position:absolute;inset:0;" data-sacred-geometry="{geometry}" data-accent="{esc(site['accent'])}"></canvas>
      </div>
    </div>
  </div>
</section>'''


def render_how_it_works(steps: List[Tuple[str, str]]) -> str:
    steps_html = []
    process_nodes = []
    for idx, (title, desc) in enumerate(steps, 1):
        steps_html.append(
            f'''<div class="step-item fade-in">
      <div class="step-number" aria-hidden="true">{idx:02d}</div>
      <div>
        <h3 class="step-title">{esc(title)}</h3>
        <p class="step-desc">{esc(desc)}</p>
      </div>
    </div>'''
        )
        process_nodes.append(f'<div class="process-node"><span>{idx:02d}</span><strong>{esc(title)}</strong></div>')
    arrows = ''.join('<span class="process-arrow" aria-hidden="true">→</span>' for _ in range(max(len(steps)-1, 0)))
    combined = []
    for idx, node in enumerate(process_nodes):
        combined.append(node)
        if idx < len(process_nodes) - 1:
            combined.append('<span class="process-arrow" aria-hidden="true">→</span>')
    return f'''<section id="how-it-works" class="section" aria-labelledby="hiw-heading">
  <div class="container container-narrow">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">How It Works</p>
      <h2 id="hiw-heading" class="section-title">The path from page load to platform action</h2>
      <p class="section-subtitle">Each step maps visible interface behavior to the runtime hooks, identity controls, and context handoffs behind it.</p>
    </header>
    <div class="process-map fade-in">{''.join(combined)}</div>
    <div class="steps-list">{''.join(steps_html)}</div>
  </div>
</section>'''


def render_tech_stack(site: dict, content_stack: List[str]) -> str:
    stack = content_stack[:12]
    badges = ''.join(f'<span class="tech-badge"><span class="tech-badge-dot" aria-hidden="true"></span>{esc(item)}</span>' for item in stack)
    layers = [stack[:4], stack[4:8], stack[8:12]]
    rows = []
    labels = ["Experience layer", "Runtime layer", "Trust layer"]
    for label, row in zip(labels, layers):
        row_html = ''.join(f'<div class="stack-node">{esc(item)}</div>' for item in row if item)
        rows.append(f'<div class="stack-row"><p class="stack-label">{esc(label)}</p><div class="stack-row-grid">{row_html}</div></div>')
    return f'''<section id="tech-stack" class="section-sm" aria-labelledby="tech-heading">
  <div class="container">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">Technology Stack</p>
      <h2 id="tech-heading" class="section-title">Visual interdependency diagram</h2>
      <p class="section-subtitle">Shared assets, runtime modules, and trust controls are shown together because the Heady system is wired as one continuous surface.</p>
    </header>
    <div class="tech-diagram fade-in">{''.join(rows)}</div>
    <div class="tech-stack fade-in" style="justify-content:center;">{badges}</div>
  </div>
</section>'''


def render_ecosystem(domain: str) -> str:
    nodes = []
    for url, name in cross_nav(domain):
        nodes.append(
            f'''<a href="https://{esc(url)}" class="ecosystem-node fade-in" target="_blank" rel="noopener noreferrer">
      <span class="ecosystem-node-icon" aria-hidden="true">◈</span>
      <span class="ecosystem-node-name">{esc(name)}</span>
      <span class="ecosystem-node-role">Connected Heady property</span>
    </a>'''
        )
    return f'''<section id="ecosystem" class="section" aria-labelledby="eco-heading">
  <div class="container">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">Ecosystem Map</p>
      <h2 id="eco-heading" class="section-title">How this site connects to every other Heady site</h2>
      <p class="section-subtitle">The registry links below keep cross-site navigation explicit, visible, and always within reach.</p>
    </header>
    <div class="ecosystem-grid">{''.join(nodes)}</div>
  </div>
</section>'''


def render_use_cases(use_cases: List[Tuple[str, str, str]]) -> str:
    cards = "".join(
        f'''<div class="use-case-card fade-in">
      <p class="use-case-label">{esc(label)}</p>
      <h3 class="use-case-title">{esc(title)}</h3>
      <p class="use-case-desc">{esc(desc)}</p>
    </div>'''
        for label, title, desc in use_cases
    )
    return f'''<section id="use-cases" class="section" aria-labelledby="uc-heading">
  <div class="container">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">Use Cases</p>
      <h2 id="uc-heading" class="section-title">Real scenarios for this property</h2>
      <p class="section-subtitle">These scenarios show how the page supports discovery, trust, and movement into deeper action.</p>
    </header>
    <div class="use-case-grid">{cards}</div>
  </div>
</section>'''


def render_faq(site: dict, faqs: List[Tuple[str, str]]) -> str:
    items = []
    for q, a in faqs:
        items.append(
            f'''<div class="faq-item">
      <button class="faq-question" aria-expanded="false">{esc(q)}<svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="faq-answer" role="region"><p>{esc(a)}</p></div>
    </div>'''
        )
    return f'''<section id="faq" class="section" aria-labelledby="faq-heading">
  <div class="container container-narrow">
    <header class="section-header fade-in">
      <p class="section-label" aria-hidden="true">FAQ</p>
      <h2 id="faq-heading" class="section-title">Questions people ask before they trust a platform surface</h2>
      <p class="section-subtitle">Rich answers help the page carry real explanatory weight instead of stopping at slogans.</p>
    </header>
    <div class="faq-list">{''.join(items)}</div>
  </div>
</section>'''


def render_cta(site: dict, domain: str) -> str:
    return f'''<section id="cta" class="section" aria-label="Call to action">
  <div class="container">
    <div class="cta-section">
      <h2 class="cta-title">Continue into the Heady ecosystem</h2>
      <p class="cta-subtitle">Use the shared sign-in flow, keep your context intact, and move from this page into the next Heady surface without losing orientation.</p>
      <div class="cta-actions">
        <a href="https://auth.headysystems.com?return={esc('https://' + domain)}" class="btn btn-primary btn-lg">Create or resume session</a>
        <a href="#ecosystem" class="btn btn-ghost btn-lg">View connected sites</a>
      </div>
    </div>
  </div>
</section>'''


def render_footer(site: dict, domain: str) -> str:
    cols_html = []
    for col in site.get("footerCols", []):
        links_html = ''.join(f'<li><a href="{esc(resolve_link(label, href))}">{esc(label)}</a></li>' for label, href in col["links"])
        cols_html.append(f'''<div class="footer-col"><p class="footer-col-title">{esc(col['title'])}</p><ul role="list">{links_html}</ul></div>''')
    cross_html = ''.join(f'<a href="https://{esc(url)}">{esc(name)}</a>' for url, name in cross_nav(domain))
    desc = site.get("description", site.get("tagline", ""))
    return f'''<footer class="heady-footer" aria-label="Site footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo" style="font-size:var(--text-lg);" aria-label="{esc(site['name'])} home">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
            <circle cx="16" cy="16" r="8" stroke="var(--color-accent)" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="3" fill="var(--color-accent)"/>
          </svg>
          {esc(site['name'][:5])}<span class="logo-accent">{esc(site['name'][5:])}</span>
        </a>
        <p class="footer-tagline">{esc(desc[:180])}</p>
        <div class="tech-stack" style="margin-top:var(--space-4);">
          <span class="tech-badge"><span class="tech-badge-dot"></span>Auth-linked</span>
          <span class="tech-badge"><span class="tech-badge-dot"></span>AutoContext-ready</span>
          <span class="tech-badge"><span class="tech-badge-dot"></span>Bee-injectable</span>
        </div>
      </div>
      {''.join(cols_html)}
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">&copy; 2026 HeadySystems Inc. · {esc(domain)} · <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;opacity:0.7;">Created with Perplexity Computer</a></p>
      <nav class="footer-cross-nav" aria-label="Cross-site navigation">{cross_html}</nav>
    </div>
  </div>
</footer>'''


def render_auth_widget() -> str:
    return '''<div class="auth-widget" id="heady-auth-widget" aria-live="polite">
  <button class="auth-widget-btn" type="button" aria-label="Sign in to Heady">
    <span class="dot" aria-hidden="true"></span>
    <span class="auth-label">Sign In</span>
  </button>
</div>'''


def render_page(domain: str, site: dict, profile: dict) -> str:
    paragraphs = build_deep_dive(site, domain, profile)
    steps = build_how_it_works(site, profile)
    use_cases = build_use_cases(site, profile)
    faqs = build_faq(site, profile)
    aliases = collect_aliases(site)
    tech_stack = site.get("techStack") or site.get("tech_stack") or []
    if not tech_stack:
        tech_stack = [feat["title"] for feat in site.get("features", [])]
        tech_stack += ["Firebase Auth", "HeadyAutoContext", "Bee Injector", "OpenTelemetry"]
    accent = site["accent"]
    accent_dark = site.get("accentDark", accent)
    accent_glow = site.get("accentGlow", "rgba(0,0,0,0.12)")
    geometry = site.get("sacredGeometry", "Flower of Life")
    html_doc = f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
{ATTRIBUTION_HEAD}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{esc(site.get('description', site['tagline']))}">
<meta property="og:title" content="{esc(site['name'])} — {esc(site['tagline'])}">
<meta property="og:description" content="{esc(site.get('description', site['tagline']))}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://{esc(domain)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(site['name'])}">
<meta name="twitter:description" content="{esc(site['tagline'])}">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{esc(site['name'])}",
  "url": "https://{esc(domain)}",
  "description": "{esc(site.get('description', site['tagline']))}",
  "creator": {{"@type": "SoftwareApplication", "name": "Perplexity Computer", "url": "https://www.perplexity.ai/computer"}}
}}
</script>
<title>{esc(site['name'])} — {esc(site['tagline'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{SHARED_CSS}">
<style>
  :root {{
    --color-accent: {accent};
    --color-accent-dark: {accent_dark};
    --color-accent-glow: {accent_glow};
    --color-accent-muted: {accent_glow.replace('0.14', '0.08').replace('0.15', '0.08').replace('0.12', '0.07') if 'rgba' in accent_glow else 'rgba(0,0,0,0.08)'};
  }}
  body {{
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, {accent_glow}, transparent),
      radial-gradient(ellipse 40% 30% at 80% 80%, rgba(139,92,246,0.04), transparent);
  }}
  .hero-grid {{ display:grid; gap:var(--space-8); align-items:start; }}
  .hero-grid-auth {{ grid-template-columns:minmax(0,1.2fr) minmax(320px,0.8fr); }}
  .hero-context-strip {{ margin-top:var(--space-6); padding:var(--space-4); border:1px solid var(--glass-border); border-radius:var(--radius-xl); background:var(--glass-bg); }}
  .prose-block p {{ max-width:none; margin-bottom:var(--space-5); }}
  .process-map {{ display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; justify-content:center; margin-bottom:var(--space-8); padding:var(--space-5); border:1px solid var(--glass-border); border-radius:var(--radius-2xl); background:var(--glass-bg); }}
  .process-node {{ min-width:150px; padding:var(--space-4); border:1px solid var(--color-border); border-radius:var(--radius-xl); background:rgba(255,255,255,0.03); text-align:center; }}
  .process-node span {{ display:block; font-size:var(--text-xs); color:var(--color-text-faint); margin-bottom:var(--space-2); }}
  .process-arrow {{ color:var(--color-accent); font-size:var(--text-lg); }}
  .tech-diagram {{ display:grid; gap:var(--space-5); margin-bottom:var(--space-6); }}
  .stack-row {{ display:grid; gap:var(--space-3); padding:var(--space-4); border:1px solid var(--glass-border); border-radius:var(--radius-2xl); background:var(--glass-bg); }}
  .stack-label {{ font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.08em; color:var(--color-text-faint); max-width:none; }}
  .stack-row-grid {{ display:grid; gap:var(--space-3); grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); }}
  .stack-node {{ padding:var(--space-3) var(--space-4); border-radius:var(--radius-lg); background:rgba(255,255,255,0.04); border:1px solid var(--color-border); font-size:var(--text-sm); }}
  .identity-console {{ padding:var(--space-6); border-radius:var(--radius-2xl); border:1px solid var(--glass-border); background:var(--glass-bg); backdrop-filter:blur(18px); box-shadow:var(--shadow-lg); }}
  .identity-console-title {{ font-size:var(--text-xl); margin-bottom:var(--space-3); }}
  .identity-console-copy {{ margin-bottom:var(--space-5); color:var(--color-text-muted); max-width:none; }}
  .identity-form {{ display:grid; gap:var(--space-4); }}
  .identity-form label {{ display:grid; gap:var(--space-2); }}
  .identity-form input {{ width:100%; padding:var(--space-3) var(--space-4); border-radius:var(--radius-lg); border:1px solid var(--color-border); background:rgba(255,255,255,0.04); color:var(--color-text); }}
  .identity-actions {{ display:flex; gap:var(--space-3); flex-wrap:wrap; }}
  .identity-note {{ font-size:var(--text-sm); color:var(--color-text-faint); max-width:none; }}
  .section-alias-anchor {{ display:block; position:relative; top:-96px; visibility:hidden; height:0; }}
  @media (max-width: 900px) {{
    .hero-grid-auth {{ grid-template-columns:1fr; }}
  }}
</style>
</head>
<body>
{render_nav(site)}
<main id="main-content">
  {render_hero(site, domain, profile)}
  {render_aliases(aliases['features'])}{render_features(site)}
  {render_aliases(aliases['stats'])}{render_stats(site)}
  {render_aliases(aliases['deep-dive'])}{render_deep_dive(site, paragraphs)}
  {render_aliases(aliases['how-it-works'])}{render_how_it_works(steps)}
  {render_aliases(aliases['tech-stack'])}{render_tech_stack(site, tech_stack)}
  {render_aliases(aliases['ecosystem'])}{render_ecosystem(domain)}
  {render_aliases(aliases['use-cases'])}{render_use_cases(use_cases)}
  {render_aliases(aliases['faq'])}{render_faq(site, faqs)}
  {render_aliases(aliases['cta'])}{render_cta(site, domain)}
</main>
{render_footer(site, domain)}
{render_auth_widget()}
<script>
window.__HEADY_SITE_META__ = {{
  slug: "{esc(site['slug'])}",
  domain: "{esc(domain)}",
  name: "{esc(site['name'])}",
  accent: "{esc(accent)}",
  sacredGeometry: "{esc(geometry)}"
}};
window.__HEADY_AUTH_CONFIG__ = {{
  cookieEndpoint: "https://auth.headysystems.com/api/session/start",
  providerEndpoint: "https://auth.headysystems.com/api/provider/start",
  relayOrigin: "https://auth.headysystems.com",
  relayPath: "https://auth.headysystems.com/relay.html",
  allowedOrigins: ["https://auth.headysystems.com", "https://admin.headysystems.com"]
}};
</script>
<script src="{SHARED_JS_GEO}"></script>
<script src="{SHARED_JS_SHARED}"></script>
<script>
if (window.HeadyAutoContext) window.HeadyAutoContext.init(window.__HEADY_SITE_META__);
if (window.HeadyBeeInjector) window.HeadyBeeInjector.init({{ site: "{esc(domain)}" }});
const authForm = document.querySelector('[data-heady-auth-form]');
if (authForm) {{
  authForm.addEventListener('submit', async (event) => {{
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(authForm).entries());
    try {{
      const response = await fetch(window.__HEADY_AUTH_CONFIG__.cookieEndpoint, {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        credentials: 'include',
        body: JSON.stringify(payload)
      }});
      if (response.ok) window.location.href = payload.returnUrl || 'https://headysystems.com';
      else document.body.setAttribute('data-heady-auth-preview', 'retry-needed');
    }} catch (error) {{
      document.body.setAttribute('data-heady-auth-preview', 'offline-preview');
    }}
  }});
  document.querySelectorAll('[data-heady-provider]').forEach((button) => {{
    button.addEventListener('click', () => {{
      const provider = button.getAttribute('data-heady-provider');
      const returnUrl = authForm.querySelector('input[name="returnUrl"]').value;
      window.location.href = `${{window.__HEADY_AUTH_CONFIG__.providerEndpoint}}?provider=${{encodeURIComponent(provider)}}&return=${{encodeURIComponent(returnUrl)}}`;
    }});
  }});
}}
</script>
</body>
</html>'''
    if FORBIDDEN_RE.search(html_doc):
        raise ValueError(f"Forbidden vocabulary generated for {domain}")
    if len(WORD_RE.findall(re.sub(r"<[^>]+>", " ", html_doc))) < 2000:
        raise ValueError(f"Insufficient content generated for {domain}")
    return html_doc




def render_robots(domain: str) -> str:
    return f"User-agent: *\nAllow: /\nSitemap: https://{domain}/sitemap.xml\n"


def render_sitemap(domain: str) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://{domain}/</loc>
    <changefreq>weekly</changefreq>
  </url>
</urlset>'''

def render_relay() -> str:
    return '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>Heady Auth Relay</title>
<script>
const ALLOWED_ORIGINS = [
  'https://headyme.com',
  'https://headysystems.com',
  'https://heady-ai.com',
  'https://headyos.com',
  'https://headyconnection.org',
  'https://headyconnection.com',
  'https://headyex.com',
  'https://headyfinance.com',
  'https://admin.headysystems.com',
  'https://auth.headysystems.com'
];
window.addEventListener('message', async (event) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  if (event.data?.type === 'heady:context:request') {
    const nonce = typeof event.data.nonce === 'string' ? event.data.nonce : null;
    event.source.postMessage({
      type: 'heady:auth:sync',
      user: null,
      session: { source: 'relay', verifiedOrigin: event.origin, requestedSite: event.data.site || null, nonce }
    }, event.origin);
  }
});
</script>
</head>
<body></body>
</html>'''


def main() -> None:
    with open(REGISTRY_PATH, 'r', encoding='utf-8') as handle:
        registry = json.load(handle)
    sites = registry.get('preconfiguredSites', {})
    all_sites = dict(sites)
    all_sites['auth.headysystems.com'] = AUTH_SITE

    for domain, site in all_sites.items():
        slug = DOMAIN_SLUGS[domain]
        out_dir = os.path.join(OUTPUT_BASE, slug)
        os.makedirs(out_dir, exist_ok=True)
        profile = SITE_PROFILES[domain]
        html_doc = render_page(domain, site, profile)
        out_path = os.path.join(out_dir, 'index.html')
        with open(out_path, 'w', encoding='utf-8') as handle:
            handle.write(html_doc)
        print(f'Built {domain} -> {out_path}')
        if domain == 'auth.headysystems.com':
            relay_path = os.path.join(out_dir, 'relay.html')
            with open(relay_path, 'w', encoding='utf-8') as handle:
                handle.write(render_relay())
            print(f'Built relay -> {relay_path}')
        robots_path = os.path.join(out_dir, 'robots.txt')
        with open(robots_path, 'w', encoding='utf-8') as handle:
            handle.write(render_robots(domain))
        sitemap_path = os.path.join(out_dir, 'sitemap.xml')
        with open(sitemap_path, 'w', encoding='utf-8') as handle:
            handle.write(render_sitemap(domain))

    print(f'Built {len(all_sites)} sites with full-content pages.')


if __name__ == '__main__':
    main()

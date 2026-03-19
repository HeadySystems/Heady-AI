#!/usr/bin/env python3
"""
Content Enrichment Script — Adds cross-links, ecosystem section,
and pricing CTA to all 9 Heady domain sites.
"""
import os
import re

REPO = "/home/user/workspace/heady-production-fixes"

# Cross-link ecosystem section (added before </main> or before <footer)
ECOSYSTEM_SECTION = """
    <!-- Heady Ecosystem -->
    <section class="ecosystem" style="padding:5rem 2rem;background:rgba(13,18,33,0.4);border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="max-width:1100px;margin:0 auto;text-align:center">
        <h2 style="font-size:2rem;margin-bottom:0.75rem;color:#e8e8f0">The Heady Ecosystem</h2>
        <p style="color:#9898b0;margin-bottom:3rem;max-width:600px;margin-left:auto;margin-right:auto">Nine specialized domains. One sovereign AI platform. Built with Sacred Geometry precision and protected by 60+ patents.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;text-align:left">
          <a href="https://headyme.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#6366f1;margin-bottom:0.25rem">HeadyMe</div>
            <div style="color:#9898b0;font-size:0.85rem">Command center — your AI operating system hub</div>
          </a>
          <a href="https://heady-ai.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#06b6d4;margin-bottom:0.25rem">Heady AI</div>
            <div style="color:#9898b0;font-size:0.85rem">Intelligence routing, model playground, and research</div>
          </a>
          <a href="https://headysystems.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#8b5cf6;margin-bottom:0.25rem">HeadySystems</div>
            <div style="color:#9898b0;font-size:0.85rem">Enterprise AI architecture and orchestration engine</div>
          </a>
          <a href="https://headyconnection.org" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#22c55e;margin-bottom:0.25rem">HeadyConnection</div>
            <div style="color:#9898b0;font-size:0.85rem">501(c)(3) nonprofit — community, mutual aid, digital equity</div>
          </a>
          <a href="https://headybuddy.org" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#f59e0b;margin-bottom:0.25rem">HeadyBuddy</div>
            <div style="color:#9898b0;font-size:0.85rem">Personal AI companion — voice, memory, emotional awareness</div>
          </a>
          <a href="https://headymcp.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#ec4899;margin-bottom:0.25rem">HeadyMCP</div>
            <div style="color:#9898b0;font-size:0.85rem">Model Context Protocol gateway — 47 tools, one protocol</div>
          </a>
          <a href="https://headyio.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#14b8a6;margin-bottom:0.25rem">HeadyIO</div>
            <div style="color:#9898b0;font-size:0.85rem">Developer platform — SDKs, data pipelines, streaming</div>
          </a>
          <a href="https://headybot.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#f97316;margin-bottom:0.25rem">HeadyBot</div>
            <div style="color:#9898b0;font-size:0.85rem">Agent marketplace — discover and deploy AI automation</div>
          </a>
          <a href="https://headyapi.com" style="display:block;padding:1.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-decoration:none;transition:all 0.3s">
            <div style="font-weight:700;color:#3b82f6;margin-bottom:0.25rem">HeadyAPI</div>
            <div style="color:#9898b0;font-size:0.85rem">REST and GraphQL APIs — endpoint docs, SDKs, rate limits</div>
          </a>
        </div>
      </div>
    </section>
"""

PRICING_SECTION = """
    <!-- Pricing -->
    <section id="pricing" style="padding:5rem 2rem;text-align:center">
      <div style="max-width:1100px;margin:0 auto">
        <h2 style="font-size:2rem;margin-bottom:0.75rem;color:#e8e8f0">Simple, Transparent Pricing</h2>
        <p style="color:#9898b0;margin-bottom:3rem;max-width:600px;margin-left:auto;margin-right:auto">Start free. Scale with confidence. No surprises.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;text-align:left">
          <div style="padding:2rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px">
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:#9898b0;margin-bottom:0.5rem">Starter</div>
            <div style="font-size:2.5rem;font-weight:800;color:#e8e8f0;margin-bottom:0.5rem">Free</div>
            <div style="color:#9898b0;font-size:0.85rem;margin-bottom:1.5rem">For individuals and small projects</div>
            <ul style="list-style:none;padding:0;margin-bottom:2rem">
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; 3 AI model providers</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; 1GB vector memory</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Community support</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Basic MCP tools</li>
            </ul>
            <a href="https://headyme.com/signup" style="display:block;text-align:center;padding:0.75rem;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e8e8f0;text-decoration:none;font-weight:600;font-size:0.9rem">Get Started</a>
          </div>
          <div style="padding:2rem;background:rgba(99,102,241,0.05);border:2px solid rgba(99,102,241,0.3);border-radius:16px;position:relative">
            <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;padding:0.25rem 1rem;border-radius:20px;font-size:0.75rem;font-weight:600">Most Popular</div>
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:#6366f1;margin-bottom:0.5rem">Pro</div>
            <div style="font-size:2.5rem;font-weight:800;color:#e8e8f0;margin-bottom:0.5rem">$29<span style="font-size:1rem;font-weight:400;color:#9898b0">/mo</span></div>
            <div style="color:#9898b0;font-size:0.85rem;margin-bottom:1.5rem">For professionals and teams</div>
            <ul style="list-style:none;padding:0;margin-bottom:2rem">
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; 5 AI model providers</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; 10GB vector memory</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Priority support</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; All 47 MCP tools</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; HeadyBuddy companion</li>
            </ul>
            <a href="https://headyme.com/signup" style="display:block;text-align:center;padding:0.75rem;background:#6366f1;border-radius:8px;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem">Start Pro Trial</a>
          </div>
          <div style="padding:2rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px">
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:#fbbf24;margin-bottom:0.5rem">Enterprise</div>
            <div style="font-size:2.5rem;font-weight:800;color:#e8e8f0;margin-bottom:0.5rem">$299<span style="font-size:1rem;font-weight:400;color:#9898b0">/mo</span></div>
            <div style="color:#9898b0;font-size:0.85rem;margin-bottom:1.5rem">For organizations at scale</div>
            <ul style="list-style:none;padding:0;margin-bottom:2rem">
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Unlimited model providers</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Unlimited vector memory</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Dedicated support + SLA</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; Custom HeadyBee swarms</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; SOC 2 + HIPAA ready</li>
              <li style="padding:0.5rem 0;color:#c0c0d0;font-size:0.9rem">&#10003; White-glove onboarding</li>
            </ul>
            <a href="https://headysystems.com#contact" style="display:block;text-align:center;padding:0.75rem;border:1px solid rgba(251,191,36,0.3);border-radius:8px;color:#fbbf24;text-decoration:none;font-weight:600;font-size:0.9rem">Contact Sales</a>
          </div>
        </div>
      </div>
    </section>
"""

def inject_sections(filepath, site_name):
    """Inject ecosystem cross-links and pricing before the footer."""
    if not os.path.exists(filepath):
        print(f"  [SKIP] {filepath} not found")
        return
    
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()
    
    changes = []
    
    # Check if ecosystem section already exists
    if 'The Heady Ecosystem' not in html:
        # Try to insert before footer
        if '<footer' in html:
            html = html.replace('<footer', ECOSYSTEM_SECTION + '\n    <footer', 1)
            changes.append("Added ecosystem cross-links")
        elif '</main>' in html:
            html = html.replace('</main>', ECOSYSTEM_SECTION + '\n  </main>', 1)
            changes.append("Added ecosystem cross-links")
    
    # Add pricing section if not present (skip headyconnection.org — nonprofit)
    if 'Simple, Transparent Pricing' not in html and 'headyconnection' not in site_name:
        if '<footer' in html and 'The Heady Ecosystem' in html:
            # Insert pricing before ecosystem section
            html = html.replace('<!-- Heady Ecosystem -->', PRICING_SECTION + '\n    <!-- Heady Ecosystem -->', 1)
            changes.append("Added pricing section")
    
    # Fix any headybuddy.com links to headybuddy.org
    if 'headybuddy.com' in html:
        # Only fix nav links, not the domain itself if this IS headybuddy
        html = html.replace('https://headybuddy.com', 'https://headybuddy.org')
        changes.append("Fixed headybuddy.com → headybuddy.org links")
    
    if changes:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        for ch in changes:
            print(f"  [FIXED] {ch}")
    else:
        print(f"  [OK] Already enriched")


def main():
    print("=" * 60)
    print("CONTENT ENRICHMENT — Cross-links + Pricing")
    print("=" * 60)
    
    sites = {
        'headyme': 'services/heady-web/sites/headyme/index.html',
        'heady-ai': 'services/heady-web/sites/heady-ai/index.html',
        'headysystems': 'services/heady-web/sites/headysystems/index.html',
        'headyconnection-org': 'services/heady-web/sites/headyconnection-org/index.html',
        'headybuddy': 'services/heady-web/sites/headybuddy/index.html',
        'headymcp': 'services/heady-web/sites/headymcp/index.html',
        'headyio': 'services/heady-web/sites/headyio/index.html',
        'headybot': 'services/heady-web/sites/headybot/index.html',
        'headyapi': 'services/heady-web/sites/headyapi/index.html',
    }
    
    for name, path in sites.items():
        print(f"\n--- {name} ---")
        inject_sections(os.path.join(REPO, path), name)
    
    # Also update websites/sites/ copies
    alt_sites = {
        'headyme.com': 'websites/sites/headyme.com/index.html',
        'heady-ai.com': 'websites/sites/heady-ai.com/index.html',
        'headysystems.com': 'websites/sites/headysystems.com/index.html',
        'headyconnection.org': 'websites/sites/headyconnection.org/index.html',
        'headybuddy.org': 'websites/sites/headybuddy.org/index.html',
        'headymcp.com': 'websites/sites/headymcp.com/index.html',
        'headyio.com': 'websites/sites/headyio.com/index.html',
    }
    
    print("\n--- Secondary copies ---")
    for name, path in alt_sites.items():
        full = os.path.join(REPO, path)
        if os.path.exists(full):
            inject_sections(full, name)

    print("\nDone.")


if __name__ == "__main__":
    main()

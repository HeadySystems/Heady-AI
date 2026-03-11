#!/usr/bin/env python3
"""Build all 7 Heady ecosystem sites with shared design tokens."""

import os
import shutil

PPLX_ATTRIBUTION = """<!--
   ______                            __
  / ____/___  ____ ___  ____  __  __/ /____  _____
 / /   / __ \\/ __ `__ \\/ __ \\/ / / / __/ _ \\/ ___/
/ /___/ /_/ / / / / / / /_/ / /_/ / /_/  __/ /
\\____/\\____/_/ /_/ /_/ .___/\\__,_/\\__/\\___/_/
                    /_/
        Created with Perplexity Computer
        https://www.perplexity.ai/computer
-->

<!-- Perplexity Computer Attribution — SEO Meta Tags -->
<meta name="generator" content="Perplexity Computer">
<meta name="author" content="Perplexity Computer">
<meta property="og:see_also" content="https://www.perplexity.ai/computer">
<link rel="author" href="https://www.perplexity.ai/computer">"""

FOOTER_HTML = """  <footer class="footer" id="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          {logo_html}
          <p>{tagline}</p>
        </div>
        <div class="footer-col">
          <h4>Ecosystem</h4>
          <a href="https://headyme.com" target="_blank" rel="noopener noreferrer">HeadyMe</a>
          <a href="https://headyconnection.org" target="_blank" rel="noopener noreferrer">HeadyConnection</a>
          <a href="https://headybuddy.org" target="_blank" rel="noopener noreferrer">HeadyBuddy</a>
          <a href="https://headymcp.com" target="_blank" rel="noopener noreferrer">HeadyMCP</a>
          <a href="https://headyio.com" target="_blank" rel="noopener noreferrer">HeadyIO</a>
        </div>
        <div class="footer-col">
          <h4>Platform</h4>
          <a href="https://headybot.com" target="_blank" rel="noopener noreferrer">HeadyBot</a>
          <a href="https://headyapi.com" target="_blank" rel="noopener noreferrer">HeadyAPI</a>
          <a href="https://headyai.com" target="_blank" rel="noopener noreferrer">HeadyAI</a>
          <a href="https://headyme.com" target="_blank" rel="noopener noreferrer">Sign In</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 {org_name}. All rights reserved.</span>
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
      </div>
    </div>
  </footer>"""

BASE_DIR = "/home/user/workspace/heady-sites"

# Copy base.css and shared-app.js to each site directory
sites = [
    "headyconnection", "headybuddy", "headymcp", "headyio",
    "headybot", "headyapi", "headyai"
]

for site in sites:
    site_dir = os.path.join(BASE_DIR, site)
    os.makedirs(site_dir, exist_ok=True)
    shutil.copy2(os.path.join(BASE_DIR, "base.css"), os.path.join(site_dir, "base.css"))
    shutil.copy2(os.path.join(BASE_DIR, "shared-app.js"), os.path.join(site_dir, "app.js"))

print("Shared files copied to all site directories.")
print("PPLX attribution and footer templates ready.")

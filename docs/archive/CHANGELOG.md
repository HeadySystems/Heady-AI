# Heady Ecosystem Changelog

## [2026-02-22] — Fidelity Sprint
### Added
- SYSTEM-MAP.md — complete architecture documentation
- HeadyBuddy Desktop App (Electron wrapper)
- Glassmorphic cosmic UI makeover for HeadyBuddy
- Auto-fact extraction from conversations
- Favicons (SVG) for all 6 sites
- robots.txt + sitemap.xml for all 6 sites
- SEO meta tags (OG, Twitter, canonical) for all 6 sites
- 404 pages for all 6 sites
- Security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy)
- .gitignore (root + HeadyBuddy)
- HeadyAI-IDE desktop shortcut with proper icon
- HeadyBuddy desktop shortcut

### Fixed
- Copy-paste in HeadyBuddy desktop chat (user-select: text)
- Socket.IO connection pointing to production instead of localhost
- Broken symlink: Heady/hcfp
- Concurrent chat sessions (edge-ai first, 3s timeout)

### Security
- Removed .env files from git tracking
- Removed 87K node_modules from git tracking
- Added security headers to edge proxy

### Changed
- HeadyBuddy system prompt: self-aware, confident, ecosystem-aware
- HeadyBuddy UI: auto-scroll with user override, dynamic textarea
- Edge proxy chat widget: glassmorphic, all-sites, mobile-responsive

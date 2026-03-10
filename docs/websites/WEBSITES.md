# Heady™ Website Portfolio v4.0.0

**Author:** Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

---

## Design System

All 9 websites share the Sacred Geometry design system:
- **CSS:** `websites/shared/css/heady-design-system.css` (19.5KB)
- **JS Core:** `websites/shared/js/heady-core.js` (8.9KB)
- **JS Auth:** `websites/shared/js/heady-auth.js` + `heady-auth-modal.js`

### Design Principles
- Dark theme with glassmorphism
- φ-scaled spacing, typography, and animations
- Sacred Geometry SVG motifs (golden spirals, Fibonacci circles)
- Responsive: mobile-first with φ-breakpoints

## Site Catalog

| Domain | Role | Status |
|--------|------|--------|
| headyme.com | Command Center — Personal AI OS dashboard | Deployed |
| headysystems.com | Core Architecture Engine — Platform overview | Built |
| heady-ai.com | Intelligence Routing Hub — AI capabilities | Built |
| headyos.com | Operating System — Latent OS documentation | Built |
| headyconnection.org | Nonprofit — Community and mission | Deployed |
| headyconnection.com | Community Portal — Programs and events | Built |
| headyex.com | Exchange Platform — AI model marketplace | Built |
| headyfinance.com | Finance — Billing, pricing, monetization | Built |
| admin.headysystems.com | Admin Dashboard — System management | Deployed |

## Auth Integration

Every site includes:
1. `heady-auth.js` — Core auth module (login, signup, OAuth, session management)
2. `heady-auth-modal.js` — Drop-in auth modal with Sacred Geometry styling
3. Auth meta tag for service discovery: `<meta name="heady-auth-url" content="/api/auth">`
4. Nav auth buttons: Sign In / Get Started (logged out), User Name / Sign Out (logged in)
5. Data attributes: `data-auth="logged-in"`, `data-auth="logged-out"`, `data-auth-field="name"`

## Authentication Flow

```
User clicks "Sign In" → Auth modal opens
  → Email/password form OR OAuth (Google/GitHub)
  → POST /api/auth/login or /api/auth/oauth/{provider}
  → Server sets httpOnly cookie
  → Client checks session via GET /api/auth/session
  → UI updates via data-auth attributes
```

---

© 2026 Eric Haywood / HeadySystems Inc.

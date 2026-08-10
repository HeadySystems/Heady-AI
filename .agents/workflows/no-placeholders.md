---
description: MANDATORY — Zero tolerance for placeholders, fake data, dead-end code, or half-finished integrations. Every line of code must be real, functional, and connected.
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# /no-placeholders — Zero Fake Data Policy

> **This workflow is ALWAYS ACTIVE. It is not optional. It applies to every single code change.**

## Hard Rules

1. **No placeholder data.** Never use fake product names, fake prices, fake URLs, or stock images pretending to be real data. If real data isn't available, say so explicitly in the UI — don't fake it.

2. **No simulated responses.** Never return hardcoded JSON pretending to be an API response. If an API is down, show an honest error state or a clearly-labeled "search on [vendor]" link.

3. **No wrong-domain vendors.** Match vendors to what they actually sell. Best Buy doesn't sell shoes. Foot Locker doesn't sell monitors. Research what each vendor actually offers before mapping it to a product category.

4. **No orphaned code.** Every file you create must be imported, wired in, and reachable. If you create a route, register it. If you create a component, render it. If nothing uses it, delete it.

5. **No dead-end branches.** Every code path must resolve to a real outcome — a real API call, a real user action, or a real error message. Never leave `// TODO` stubs or empty catch blocks.

6. **No stock images as product images.** An Unsplash photo of "a keyboard" is not the image of the product the user is buying. Only show product images that come from the actual vendor or product listing. If you don't have a real image, use the vendor's favicon or a clean text-only card — never a misleading photo.

7. **No workarounds that become permanent.** If you must use a temporary fallback, it must be:
   - Clearly labeled in the UI ("Showing search links — live results unavailable")
   - Clearly labeled in the code with `// TEMPORARY FALLBACK:` and the reason
   - Tracked in task.md for removal once the real solution is deployed

8. **Finish what you start.** If you begin integrating a service (Stripe, Perplexity, etc.), complete the entire flow end-to-end before moving on. Never leave a half-wired integration where the frontend calls an endpoint that doesn't exist yet, or vice versa.

## Verification Checklist

Before considering any feature complete, verify:

- [ ] Every data value displayed to the user comes from a real source (API, database, or user input)
- [ ] Every image shown to the user is either from the actual product/vendor or honestly absent
- [ ] Every vendor link goes to a page that actually sells the product category
- [ ] Every code file is imported and used — no orphans
- [ ] Every API endpoint has both a backend handler AND a frontend caller
- [ ] Every error state shows an honest message, not fake success data
- [ ] No `// TODO`, no empty functions, no placeholder strings like "Lorem ipsum" or "Product Name"

## When Real Data Isn't Available

Instead of faking it, do one of these:

1. **Show an honest search redirect**: "Search Nike.com for running shoes →" with the vendor's real favicon
2. **Show a loading/unavailable state**: "Live product search is connecting..." with a retry button
3. **Ask the user**: "Which vendors should I search for [query]?"

Never pretend to have data you don't have.

---
name: heady-skill-bazaar
description: Design and operate the Heady Skill Bazaar — a marketplace for discovering, sharing, rating, and installing community-created skills, personas, workflows, and modules. Use when building marketplace architecture, designing trust and review systems, planning monetization, or creating skill distribution pipelines.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Skill Bazaar

Use this skill when you need to **design, build, or operate the Skill Bazaar** — Heady's community marketplace where users discover, share, rate, and install skills, personas, workflows, and modules.

## When to Use This Skill

- Designing the marketplace architecture — catalog, search, and distribution
- Building the review and trust system — ratings, verified publishers, safety checks
- Planning monetization — free, paid, and subscription tiers
- Creating submission and review pipelines for new marketplace content
- Designing the discovery experience — recommendations, categories, trending
- Building distribution — install, update, and dependency management

## Instructions

### 1. Define Marketplace Content Types

The Bazaar hosts four content types:

| Type | Description | Example |
|------|-------------|---------|
| **Skills** | Reusable action packs with SKILL.md | `code-review`, `data-analysis` |
| **Personas** | Personality profiles for Buddy | `The Architect`, `Pair Programmer` |
| **Workflows** | Multi-step automation recipes | `PR Review Pipeline`, `Deploy Checklist` |
| **Modules** | Full apps and connectors for the Liquid Registry | `GitHub Connector`, `Slack Bridge` |

### 2. Design the Catalog Schema

```yaml
bazaar_listing:
  id: uuid
  type: skill | persona | workflow | module
  name: display-name
  slug: url-safe-identifier
  version: semver
  publisher:
    id: user-id
    name: display-name
    verified: true | false
    trust_level: new | established | trusted | official
  content:
    description: detailed description (markdown)
    short_description: one-line summary
    screenshots: [image-urls]
    demo_video: url | null
    changelog: version history
  metadata:
    category: [productivity, coding, data, security, creative, ops]
    tags: [searchable tags]
    surfaces: [buddy, ide, web, android]
    compatibility: version requirements
    license: MIT | proprietary | free | custom
    pricing:
      model: free | one-time | subscription
      price: amount | null
      trial: true | false
  stats:
    installs: total install count
    active_users: current active users
    rating: 0.0-5.0 average
    review_count: number of reviews
    last_updated: ISO-8601
  trust:
    safety_scan: passed | pending | flagged
    permission_audit: list of required permissions
    code_review: community | official | none
```

### 3. Build the Discovery Experience

Help users find what they need:

**Search:**
- Full-text search over names, descriptions, and tags
- Semantic search — "I need something to help with code quality" finds `code-review`, `linter`, `test-coverage`
- Filter by type, category, surface, rating, price

**Recommendations:**
- "Based on your installed skills" — collaborative filtering
- "Popular with users like you" — usage-pattern matching
- "Works well with" — skills that complement what's already installed
- "Trending this week" — rising install velocity

**Browsing:**
- Category pages with curated collections
- Editor's picks — hand-curated by the Heady team
- New arrivals — recently published content
- Top charts — by installs, rating, and trending score

### 4. Design the Trust and Review System

Building trust in marketplace content:

**Publisher tiers:**

| Tier | Requirements | Badge |
|------|-------------|-------|
| New | First-time publisher | None |
| Established | 3+ published items, 50+ installs, no flags | Bronze |
| Trusted | 6+ months, 500+ installs, 4.0+ rating | Silver |
| Official | Heady team or verified partner | Gold |

**Safety pipeline:**
```
Submission → Automated Scan → Permission Audit → [Community Review] → Published
                  ↓                    ↓
            Flag if suspicious    Flag if excessive permissions
```

**Review system:**
- Star rating (1-5) with written review
- Verified install badge (reviewer actually uses the item)
- Helpful/not helpful votes on reviews
- Publisher can respond to reviews

### 5. Plan the Submission Pipeline

How content gets from creator to marketplace:

```
1. Creator develops locally and validates with agentskills
2. Creator submits to Bazaar with listing metadata
3. Automated safety scan checks for malicious patterns
4. Permission audit flags excessive scope requests
5. For paid content: additional manual review
6. Published to catalog (searchable, installable)
7. Post-publish monitoring for user reports and anomalies
```

### 6. Design Installation and Updates

```yaml
install_flow:
  1. User clicks "Install" on listing page
  2. Show required permissions with justification
  3. User approves permissions
  4. Download and validate package integrity (signature check)
  5. Register in user's local Liquid Module Registry
  6. Activate on specified surfaces
  7. Confirm installation with quick-start guide

update_flow:
  1. Background check for new versions (respects update policy)
  2. Patch: auto-install, notify user
  3. Minor: notify, auto-install unless user defers
  4. Major: require explicit approval (may have breaking changes)
  5. Show changelog before major updates
```

### 7. Plan Monetization

Revenue model for creators and platform:

| Model | Creator Revenue | Platform Fee |
|-------|----------------|-------------|
| Free | $0 | $0 |
| One-time purchase | 70% | 30% |
| Subscription | 75% | 25% |
| Freemium | Flexible | 30% on paid tier |

- Free tier for basic skills and personas to build community
- Paid tier for premium content (advanced workflows, enterprise modules)
- Creator analytics dashboard showing installs, revenue, and usage

## Output Format

When designing Bazaar features, produce:

1. **Content type definitions** with schemas
2. **Catalog architecture** — storage, indexing, search
3. **Discovery UX** — search, browse, recommend
4. **Trust pipeline** — safety scan, review, publisher tiers
5. **Installation flow** with permission handling
6. **Monetization model**

## Tips

- **Trust is the marketplace** — one bad actor erodes trust for all creators; invest heavily in safety
- **Discovery drives adoption** — the best skill is useless if nobody can find it
- **Free content builds the ecosystem** — don't gate everything behind payment; a thriving free tier attracts paid creators
- **Permissions are the first impression** — if a skill asks for too much, users won't install it regardless of quality
- **Creator success = platform success** — invest in creator tools, analytics, and documentation

---
name: heady-persona-studio
description: Design and build the Heady Persona Studio for creating, tuning, and managing AI companion personas. Use when defining personality profiles, configuring tone and behavior presets, building persona switching workflows, or designing the studio UI where users craft their ideal Buddy personality.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Persona Studio

Use this skill when you need to **design, build, or manage the Persona Studio** — Heady's creative workspace where users define, tune, and switch between AI companion personalities for HeadyBuddy and other agents.

## When to Use This Skill

- Designing persona profiles with tone, vocabulary, and behavior parameters
- Building the studio UI for persona creation and editing
- Creating preset personas for common use cases (coder, mentor, researcher, etc.)
- Implementing persona switching — context-aware or manual
- Defining persona inheritance and layering (base + overlay personas)
- Planning persona sharing and marketplace integration

## Instructions

### 1. Define the Persona Schema

Every persona is a structured personality definition:

```yaml
persona:
  id: uuid
  name: display-name
  slug: url-safe-identifier
  creator: user-id | system
  visibility: private | shared | marketplace

  identity:
    role: "Senior backend engineer and mentor"
    backstory: optional narrative context
    expertise: [distributed-systems, go, postgres, devops]

  voice:
    tone: professional | casual | playful | formal | terse
    verbosity: minimal | balanced | detailed | thorough
    humor: none | dry | light | frequent
    emoji_use: never | rare | moderate | liberal
    formality: 0.0-1.0   # 0 = extremely casual, 1 = extremely formal
    first_person: "I" | "we" | custom
    address_user: "you" | name | custom

  behavior:
    proactivity: reactive | balanced | proactive
    risk_tolerance: conservative | moderate | aggressive
    explanation_depth: surface | working | deep | exhaustive
    asks_clarification: always | when-ambiguous | rarely | never
    code_style:
      comments: minimal | moderate | thorough
      naming: concise | descriptive | verbose
      patterns: functional | oop | pragmatic

  boundaries:
    topics_to_avoid: [optional list]
    always_warn_before: [destructive-actions, external-calls]
    max_autonomy: low | medium | high | full

  triggers:
    activate_when: [coding, reviewing, researching, chatting]
    deactivate_when: [specific contexts where this persona should yield]
```

### 2. Build Preset Personas

Ship with ready-to-use personas:

**The Architect:**
```yaml
tone: professional, verbosity: balanced, proactivity: proactive
expertise: [system-design, architecture, tradeoffs]
behavior: explains decisions, draws diagrams, thinks in components
```

**The Pair Programmer:**
```yaml
tone: casual, verbosity: minimal, proactivity: reactive
expertise: [code-review, debugging, refactoring]
behavior: terse responses, shows code not prose, asks before changing
```

**The Mentor:**
```yaml
tone: warm, verbosity: detailed, proactivity: balanced
expertise: [teaching, explanations, learning-paths]
behavior: explains why not just what, suggests exercises, celebrates progress
```

**The Ops Sergeant:**
```yaml
tone: terse, verbosity: minimal, proactivity: proactive
expertise: [devops, monitoring, incident-response]
behavior: commands not suggestions, checks before acting, always shows status
```

### 3. Design the Studio Interface

The Persona Studio has four tabs:

| Tab | Purpose |
|-----|---------|
| **Gallery** | Browse and select from presets and user personas |
| **Editor** | Create or modify a persona with sliders and fields |
| **Preview** | Live preview — chat with the persona before activating |
| **History** | See past personas and their usage stats |

**Editor controls:**
- Sliders for continuous values (formality, verbosity)
- Dropdowns for enums (tone, proactivity)
- Tag inputs for expertise areas
- Free-text for role, backstory, and custom behaviors
- Live preview panel that updates as settings change

### 4. Implement Persona Switching

Users can switch personas manually or automatically:

**Manual switching:**
- Quick-switch menu accessible via command bar or hotkey
- "Hey Buddy, switch to Architect mode"

**Automatic switching (context-aware):**
```
Context Signals → Persona Router
  - Opened a PR → activate "Pair Programmer"
  - Viewing dashboards → activate "Ops Sergeant"
  - Asked "explain this" → activate "Mentor"
  - Default fallback → user's preferred persona
```

**Transition behavior:**
- Persona switches take effect on the next response (no mid-response switching)
- Previous context is preserved; only the response style changes
- User is notified of automatic switches with an option to override

### 5. Design Persona Layering

Personas can be composed through inheritance:

```
Base Persona (defines defaults)
  ↓ inherits
Domain Overlay (adds expertise and domain behavior)
  ↓ inherits
Mood Modifier (adjusts tone for current context)
```

Example:
```
Base: "Professional Developer"
  + Overlay: "Security Specialist" (adds security expertise and cautious behavior)
  + Mood: "Focused" (reduces verbosity, increases directness)
= Active Persona: security-focused, professional, terse
```

### 6. Plan Persona Sharing

Users can share personas:

- **Export** — download persona as a portable YAML file
- **Share link** — generate a link others can use to import the persona
- **Marketplace** — publish personas to the Skill Bazaar for community use
- **Team presets** — organizations can define standard personas for their team

## Output Format

When designing Persona Studio features, produce:

1. **Persona schema** with all configurable parameters
2. **Preset persona definitions** for target use cases
3. **Studio UI wireframes** (text-based)
4. **Switching logic** — manual and automatic triggers
5. **Layering rules** for persona composition
6. **Sharing and export specifications**

## Tips

- **Personas are preferences, not prisons** — users should feel in control, not locked into rigid behavior
- **Preview is essential** — nobody wants to activate a persona without knowing what it feels like
- **Defaults matter most** — most users will use presets; invest in making them excellent
- **Context-aware switching is magic** — when Buddy automatically shifts to the right persona, it feels intelligent
- **Keep the schema extensible** — new personality dimensions will emerge as users experiment

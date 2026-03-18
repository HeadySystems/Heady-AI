---
name: heady-avatar-forge
description: Design and operate the Heady Avatar Forge for creating, customizing, and animating AI-driven avatars and visual representations across Heady surfaces. Use when building avatar generation systems, designing visual persona representations for HeadyBuddy, implementing animated avatar rendering for heady-mobile/heady-desktop/HeadyWeb, or planning avatar marketplace features. Integrates with headybuddy-core for persona-linked avatars, heady-imagine for image generation, heady-patterns for visual style templates, and HeadyMemory for avatar state persistence.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Avatar Forge

Use this skill when you need to **design, build, or operate the Avatar Forge** — Heady's system for creating, customizing, and rendering AI-driven avatars that visually represent users, Buddy personas, and agents across all Heady surfaces.

## When to Use This Skill

- Building avatar generation and customization systems
- Designing visual persona representations for HeadyBuddy
- Implementing animated avatar rendering across mobile, desktop, and web
- Creating avatar expression systems that respond to conversation context
- Planning avatar templates and marketplace features
- Designing user profile avatars and agent visual identities

## Platform Context

The Avatar Forge operates across Heady's visual infrastructure:

- **headybuddy-core** — AI Companion whose visual identity is rendered by Avatar Forge
- **heady-imagine** — image generation engine; creates avatar artwork from descriptions
- **heady-patterns** — stores avatar style templates and visual design guidelines
- **heady-vinci** — learns visual preferences, adapts avatar suggestions to user taste
- **HeadyMemory** (`latent-core-dev`, pgvector) — persists avatar configurations and state
- **HeadyWeb** — browser-native avatar rendering and customization interface
- **heady-mobile** — mobile avatar display with touch-based customization
- **heady-desktop** — desktop avatar rendering with system tray mini-avatar
- **heady-chrome** — browser extension avatar in sidebar
- **heady-buddy-portal** — avatar management and customization studio
- **template-heady-ui** — React micro-frontend with Module Federation for avatar components
- **heady-metrics** — tracks avatar rendering performance and engagement
- **heady-observer** — monitors avatar rendering health across surfaces

## Instructions

### 1. Define the Avatar Model

```yaml
avatar:
  id: uuid
  owner: user-id | persona-id | agent-id
  type: user-profile | buddy-persona | agent-visual | workspace-mascot

  appearance:
    style: realistic | stylized | abstract | pixel | hand-drawn
    base:
      shape: round | square | organic | custom
      color_palette: [primary, secondary, accent, background]
      theme: light | dark | adaptive (matches system theme)

    features:
      face: configurable facial features if character-style
      expression_set: [neutral, happy, thinking, surprised, focused, empathetic]
      accessories: [glasses, hats, badges — unlockable or purchasable]

    animation:
      idle: subtle breathing/floating animation
      speaking: lip-sync or pulse animation during voice output
      listening: attentive posture/animation during voice input
      thinking: loading/processing animation during response generation
      reacting: expression change based on conversation sentiment

  rendering:
    format: SVG (web) | Lottie (mobile/desktop) | WebGL (3D if enabled)
    resolution: adaptive based on surface and display context
    performance_budget: "< 5% CPU for idle animation, < 15% during active animation"
    fallback: static image if animation not supported

  persistence:
    config: HeadyMemory stores full avatar configuration
    sync: avatar appears identical across all surfaces
    versioning: avatar changes tracked, user can revert to previous versions
```

### 2. Build the Avatar Generation Pipeline

```yaml
generation:
  from_description:
    input: text description of desired avatar ("a friendly robot with green eyes")
    engine: mcp_Heady_heady_imagine(prompt="{avatar description}", style="{selected style}")
    refinement: mcp_Heady_heady_critique(code="{generated avatar}", criteria="brand alignment, accessibility, rendering feasibility")
    output: base avatar image + configuration parameters

  from_photo:
    input: user uploads reference photo (opt-in)
    processing: stylize photo into avatar matching selected style
    privacy: original photo processed and immediately discarded (heady-sentinel enforced)
    output: stylized avatar preserving key features

  from_template:
    input: user selects from template library in heady-patterns
    customization: modify colors, features, accessories via editor
    output: personalized avatar from template base

  from_ai_suggestion:
    input: heady-vinci analyzes user's persona, preferences, conversation style
    suggestion: generates avatar recommendation matching personality
    presentation: 3-4 options presented for user selection
    learning: selection fed back to heady-vinci for future recommendations

  pipeline:
    1. User chooses generation method (description, photo, template, AI suggestion)
    2. heady-imagine generates base artwork
    3. heady-critique validates quality and brand alignment
    4. User customizes in avatar editor (heady-buddy-portal)
    5. Avatar exported to all rendering formats (SVG, Lottie, WebGL)
    6. Configuration saved to HeadyMemory
    7. Avatar synced to all surfaces via Device Twin Grid
```

### 3. Design the Expression System

Avatars react to conversation context:

```yaml
expression_system:
  triggers:
    conversation_sentiment:
      source: headybuddy-core sentiment analysis of current exchange
      mapping:
        positive → happy expression
        neutral → neutral expression
        curious → thinking expression
        surprised → surprised expression
        empathetic → empathetic expression
        focused → focused expression

    voice_state:
      source: Voice Vessel pipeline state
      mapping:
        listening → attentive animation
        processing → thinking animation
        speaking → speaking animation
        idle → idle animation

    system_state:
      source: heady-observer
      mapping:
        loading → thinking animation
        error → concerned expression
        success → happy micro-expression

  transitions:
    duration: 200-400ms (natural, not jarring)
    easing: ease-in-out for organic feel
    blending: smooth interpolation between expression states
    priority: voice_state > conversation_sentiment > system_state

  customization:
    expressiveness: slider from subtle to animated (user preference)
    disabled: option to use static avatar (accessibility/preference)
    storage: expression preferences in HeadyMemory
```

### 4. Build the Avatar Editor

Visual customization studio in heady-buddy-portal:

```yaml
avatar_editor:
  interface:
    type: template-heady-ui React micro-frontend
    layout: avatar preview (center) + customization panels (sides)
    real_time: changes reflect immediately in preview

  panels:
    style_selector:
      options: [realistic, stylized, abstract, pixel, hand-drawn]
      preview: instant style transfer on current avatar

    color_palette:
      mode: preset palettes + custom color picker
      application: per-element color assignment
      accessibility: contrast checker for readability

    feature_editor:
      type: depends on avatar style
      controls: sliders, toggles, and selectors per feature
      presets: save custom feature sets for quick switching

    accessory_shop:
      free: basic accessories included
      premium: purchasable via Treasury Nexus compute credits
      seasonal: limited-time accessories for engagement
      unlockable: achievements unlock special accessories

    expression_preview:
      demo: cycle through all expressions to preview
      customize: adjust expression intensity per emotion
      test: simulate conversation to see expression transitions

  export:
    preview: render avatar at each surface's resolution
    formats: SVG + Lottie + WebGL bundle
    share: generate shareable avatar card for HeadyConnection
```

### 5. Design Avatar Rendering Across Surfaces

```yaml
rendering:
  heady_web:
    format: SVG (static) + CSS animation (expressions) + optional WebGL (3D)
    size: responsive — 40px (nav icon) to 200px (profile/chat)
    animation: CSS keyframe animations for performance

  heady_mobile:
    format: Lottie animation (vector, performant on mobile)
    size: adaptive — widget (48px), chat (80px), profile (120px)
    animation: native Lottie renderer
    battery: reduce animation frame rate on low battery

  heady_desktop:
    format: Lottie (main window) + SVG (system tray icon)
    size: adaptive — tray (24px), chat (100px), profile (160px)
    animation: native renderer with GPU acceleration

  heady_chrome:
    format: SVG + CSS animation
    size: fixed — extension icon (32px), sidebar (64px)
    animation: lightweight CSS-only for browser performance

  performance:
    rendering_budget:
      idle: "< 5% CPU, < 10MB GPU memory"
      active: "< 15% CPU, < 30MB GPU memory"
    optimization:
      - sprite sheet for expression states (reduce draw calls)
      - animation frame rate adaptive to device capability
      - LOD (level of detail) reduces complexity at small sizes
    monitoring: heady-metrics tracks render performance per surface
```

### 6. Build the Avatar Dashboard

HeadyWeb interface for avatar management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **My Avatar** | HeadyMemory | Current avatar with live expression preview |
| **Persona Avatars** | HeadyMemory | Avatar per Buddy persona, switch with one click |
| **Agent Avatars** | headybot-core | Visual identities for owned agents |
| **Customization Studio** | heady-buddy-portal | Full avatar editor (linked) |
| **Accessory Collection** | HeadyMemory | Owned, equipped, and available accessories |
| **Render Health** | heady-metrics | Rendering performance per surface, frame rate stats |

## Output Format

When designing Avatar Forge features, produce:

1. **Avatar model** with appearance, animation, and rendering configuration
2. **Generation pipeline** with heady-imagine integration and quality gates
3. **Expression system** with trigger mapping and transition design
4. **Editor design** with customization panels and real-time preview
5. **Rendering specs** per surface with performance budgets
6. **Dashboard** specification with avatar management panels

## Tips

- **Avatars are identity** — users develop attachment to their avatar; changes should be intentional, never automatic
- **Performance budgets are strict** — idle animation must be nearly free; active animation must not impact voice or chat responsiveness
- **Expression transitions must be smooth** — jarring jumps between expressions break the illusion; always ease transitions
- **heady-imagine generates, heady-critique validates** — never ship a generated avatar without quality and brand alignment check
- **Accessibility first** — avatars must have text alternatives, expression state must be available as text, static mode must always work
- **Sync is instant or invisible** — avatar must look the same on every device; if sync is delayed, show previous version rather than nothing

---
name: heady-buddy-shell-productization
description: Design and productize HeadyBuddy as a native mobile, desktop, and browser companion with persistent memory, voice interaction, persona customization, and plugin extensibility. Use when building Buddy's native shell across heady-mobile, heady-desktop, heady-chrome, heady-buddy-portal, or designing voice pipelines, persona layers, plugin systems, and MCP-compatible companion surfaces. Integrates with headybuddy-core, HeadyMemory, heady-vinci, and the HeadyMCP tool ecosystem.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Buddy Shell Productization

Use this skill when you need to **design, build, or ship HeadyBuddy as a native product** across mobile, desktop, and browser — transforming the headybuddy-core AI companion into a polished, persistent, personality-rich companion experience with voice, plugins, and deep platform integration.

## When to Use This Skill

- Designing Buddy's native shell for heady-mobile (iOS/Android) and heady-desktop (Mac/Windows/Linux)
- Building the browser companion via heady-chrome extension
- Creating voice interaction pipelines with real-time streaming
- Designing the persona and character layer for Buddy's personality
- Building the plugin system for extending Buddy's capabilities
- Planning heady-buddy-portal as the web-based Buddy management surface
- Integrating Buddy across devices with seamless handoff

## Platform Context

Buddy Shell Productization spans Heady's client ecosystem:

- **headybuddy-core** — AI Companion engine: persistent memory, chat, creative tools, emotional intelligence
- **heady-mobile** — native mobile app (iOS/Android) hosting Buddy
- **heady-desktop** — native desktop app (Electron/Tauri) hosting Buddy
- **heady-chrome** — Chrome extension for browser-native Buddy access
- **heady-buddy-portal** — web portal for Buddy configuration, persona management, and memory review
- **HeadyWeb** — browser-native dashboard where Buddy surfaces contextual assistance
- **HeadyMemory** (`latent-core-dev`, pgvector + Antigravity) — Buddy's persistent memory across all surfaces
- **headymcp-core** (31 MCP tools) — capabilities Buddy invokes on behalf of the user
- **heady-vinci** — pattern recognition for learning user preferences and conversation style
- **heady-observer** — monitors Buddy availability and response quality
- **heady-sentinel** — enforces privacy boundaries on Buddy's data access

## Instructions

### 1. Define the Buddy Shell Architecture

```yaml
buddy_shell:
  core: headybuddy-core
  identity:
    name: user-chosen name (default "Buddy")
    persona: active persona profile
    voice: selected voice model
    avatar: visual representation

  surfaces:
    - platform: heady-mobile
      type: native-app
      capabilities: [chat, voice, camera, notifications, widgets, shortcuts]
      offline: limited (cached responses + local inference for simple queries)

    - platform: heady-desktop
      type: native-app
      capabilities: [chat, voice, screen-context, file-access, system-tray, global-hotkey]
      offline: limited (same as mobile)

    - platform: heady-chrome
      type: browser-extension
      capabilities: [chat, page-context, tab-awareness, sidebar, popup]
      offline: false

    - platform: heady-buddy-portal
      type: web-app
      capabilities: [persona-management, memory-review, plugin-config, conversation-history]
      offline: false

    - platform: heady-web
      type: embedded-widget
      capabilities: [contextual-help, dashboard-assistant, task-guidance]
      offline: false

  shared_state:
    memory: HeadyMemory (synced across all surfaces)
    conversation: continued seamlessly across devices
    preferences: stored in HeadyMemory, applied everywhere
    context: device-local context enriches shared memory
```

### 2. Design the Voice Interaction Pipeline

Real-time voice companion aligned with HF research on real-time companion stacks:

```yaml
voice_pipeline:
  input:
    capture: platform-native microphone API
    vad: voice activity detection (local, low-latency)
    streaming: chunked audio stream to processing layer

  processing:
    stt: speech-to-text (streaming, <500ms latency target)
    intent: headybuddy-core processes text with conversation context
    tools: Buddy invokes MCP tools as needed via headymcp-core
    response: headybuddy-core generates response

  output:
    tts: text-to-speech with selected voice model
    streaming: chunked audio response for low time-to-first-byte
    interruption: user can interrupt mid-response; Buddy stops gracefully

  modes:
    push_to_talk: default on mobile/desktop
    hands_free: opt-in with wake word detection
    text_fallback: always available alongside voice

  quality:
    latency_target: "< 1s from end of speech to start of response"
    source: heady-metrics tracks voice pipeline latency
    monitoring: heady-observer alerts on latency degradation
```

### 3. Build the Persona and Character Layer

Buddy's personality system, informed by HF research on character/persona layers:

```yaml
persona_system:
  active_persona:
    name: persona-name
    personality_traits: [warm, curious, direct, playful, professional]
    communication_style: concise | conversational | detailed | adaptive
    expertise_areas: [areas Buddy emphasizes in this persona]
    tone_markers: [specific language patterns, greetings, sign-offs]
    emoji_usage: none | minimal | moderate | expressive

  built_in_personas:
    - name: "Default Buddy"
      traits: [friendly, helpful, adaptive]
      style: conversational
    - name: "Focus Mode"
      traits: [direct, minimal, task-oriented]
      style: concise
    - name: "Creative Partner"
      traits: [imaginative, encouraging, exploratory]
      style: conversational
    - name: "Nonprofit Advisor"
      traits: [empathetic, strategic, data-informed]
      style: detailed
      expertise: [fundraising, grants, impact measurement]

  customization:
    user_can: [create personas, modify traits, set per-context defaults]
    managed_via: heady-buddy-portal persona editor
    storage: HeadyMemory with persona namespace
    learning: heady-vinci adapts persona based on user interaction patterns

  consistency:
    rule: persona traits persist across all surfaces and sessions
    memory: HeadyMemory stores persona context for continuity
    adaptation: subtle adjustments based on time of day, task type, user mood signals
```

### 4. Design the Plugin System

Extensible capabilities using MCP-compatible plugin architecture:

```yaml
plugin_system:
  architecture:
    protocol: MCP-compatible (plugins expose tools Buddy can invoke)
    discovery: plugin registry in heady-buddy-portal
    installation: user-initiated via portal, synced to all surfaces
    permissions: each plugin declares required capabilities; user approves

  plugin_types:
    - type: tool_plugin
      description: Adds new MCP tools Buddy can invoke
      example: "Calendar integration — Buddy reads/writes calendar events"
      interface: standard MCP tool definition

    - type: context_plugin
      description: Provides additional context to Buddy's responses
      example: "Code context — Buddy reads current IDE file via heady-vscode"
      interface: context provider returning structured data

    - type: action_plugin
      description: Enables Buddy to take actions in external systems
      example: "Slack plugin — Buddy sends messages, reads channels"
      interface: MCP tool with side effects

    - type: persona_plugin
      description: Adds domain-specific knowledge and personality traits
      example: "Grant writing expert — adds fundraising vocabulary and strategies"
      interface: persona overlay with trait modifications

  security:
    review: heady-sentinel scans plugin code before installation
    permissions: plugins cannot exceed host surface capabilities
    data_access: plugins access HeadyMemory only through Buddy's scoped queries
    audit: all plugin invocations logged in heady-traces

  lifecycle:
    install: user selects from registry → heady-sentinel scans → user approves permissions → sync to surfaces
    update: automatic with user notification; breaking changes require re-approval
    disable: user can disable per-surface or globally
    uninstall: removes plugin, cleans up stored data
```

### 5. Implement Platform-Specific Shell Features

```yaml
platform_features:
  heady_mobile:
    widgets: [quick-chat widget, daily briefing widget, task summary widget]
    shortcuts: Siri/Google Assistant integration for "Hey Buddy" activation
    notifications: smart notifications based on heady-observer triggers
    camera: Buddy can analyze images user shares (OCR, visual context)
    offline_mode: cached persona + local small model for basic queries

  heady_desktop:
    system_tray: persistent Buddy icon with quick-access popup
    global_hotkey: configurable keyboard shortcut to summon Buddy
    screen_context: Buddy can see active application context (opt-in)
    file_access: Buddy can read/analyze files user shares (scoped)
    clipboard: Buddy can process clipboard contents on request

  heady_chrome:
    sidebar: persistent Buddy sidebar on any webpage
    page_context: Buddy can read current page content for contextual help
    tab_awareness: Buddy knows which tabs are open for task context
    popup: quick Buddy access from toolbar icon
    content_script: highlight text → "Ask Buddy about this"

  heady_buddy_portal:
    persona_editor: visual editor for persona traits, style, and appearance
    memory_browser: review and manage what Buddy remembers
    plugin_manager: install, configure, and remove plugins
    conversation_export: export chat history in standard formats
    privacy_controls: granular control over what Buddy stores and accesses
```

### 6. Design Cross-Surface Continuity

Seamless Buddy experience across all devices:

```yaml
continuity:
  conversation:
    rule: conversation continues exactly where it left off on any surface
    implementation: HeadyMemory stores conversation state; each surface loads latest
    context_enrichment: device-local context (screen, location, time) added per surface

  handoff:
    trigger: user switches devices or surfaces
    process:
      1. Current surface saves conversation state to HeadyMemory
      2. New surface loads state + applies local context
      3. Buddy acknowledges context shift naturally
    latency_target: "< 2s to resume on new surface"

  notifications:
    routing: heady-observer routes to the surface user is currently active on
    fallback: if no surface active, queue and deliver on next activation
    priority: urgent (immediate push), normal (next activation), low (daily digest)

  presence:
    tracking: each surface reports active/inactive to heady-observer
    preference: user can set preferred surface for notifications
    quiet_hours: suppress non-urgent notifications during configured hours
```

## Output Format

When designing Buddy Shell Productization features, produce:

1. **Shell architecture** with surface definitions and shared state model
2. **Voice pipeline** with latency targets and quality monitoring
3. **Persona system** with built-in personas and customization model
4. **Plugin architecture** with MCP-compatible interface and security model
5. **Platform features** specific to each shell (mobile, desktop, browser, portal)
6. **Continuity design** for cross-surface conversation and handoff

## Tips

- **headybuddy-core is the brain, shells are the body** — all intelligence lives in the core; shells provide platform-native interaction
- **HeadyMemory makes Buddy persistent** — every conversation, preference, and learned pattern survives across sessions and devices
- **Persona consistency matters** — Buddy should feel like the same companion whether on phone, desktop, or browser
- **Voice is a first-class input** — design for voice-first, text-always; many users will prefer speaking to typing
- **Plugins extend, not replace** — plugins add capabilities but never override core Buddy behavior or safety boundaries
- **heady-sentinel guards privacy** — every new plugin, context access, and memory write goes through security review

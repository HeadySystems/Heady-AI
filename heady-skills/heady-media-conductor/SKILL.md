---
name: heady-media-conductor
description: Design and operate the Heady Media Conductor for orchestrating multi-modal media pipelines across text, image, audio, and video generation and transformation. Use when building media generation workflows, designing multi-modal content pipelines, implementing media format conversion, creating rich content composition from multiple AI outputs, or planning media asset management. Integrates with heady-imagine for image generation, heady-coder for code/text, Voice Vessel for audio, heady-stories for narrative, and heady-observer for media pipeline monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Media Conductor

Use this skill when you need to **design, build, or operate the Media Conductor** — Heady's orchestration layer for composing, transforming, and delivering multi-modal media (text, images, audio, code) through coordinated AI generation pipelines.

## When to Use This Skill

- Building multi-modal content generation workflows (text + image + audio)
- Designing media transformation pipelines (format conversion, style transfer)
- Creating rich content composition from multiple AI-generated assets
- Implementing media asset management and versioning
- Planning content delivery across Heady surfaces (web, mobile, desktop)
- Orchestrating heady-imagine, Voice Vessel, heady-coder, and heady-stories

## Platform Context

The Media Conductor orchestrates Heady's media generation stack:

- **heady-imagine** — image generation engine (text-to-image, style transfer, image editing)
- **heady-stories** — narrative and long-form content generation
- **heady-coder** (via `heady_coder` MCP tool) — code generation and technical writing
- **Voice Vessel** — audio generation (TTS) and voice content production
- **heady-critique** — quality assessment for generated media
- **heady-battle** — comparative evaluation of media variants
- **heady-patterns** — media style templates and brand guidelines
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores media assets, metadata, and generation history
- **heady-observer** — monitors media pipeline health and generation quality
- **heady-metrics** — tracks generation latency, quality scores, and usage per media type
- **heady-traces** — records every generation step for provenance (feeds Trust Fabric)
- **heady-sentinel** — enforces content safety policies on all generated media
- **headymcp-core** (31 MCP tools) — media generation tools invoked by the conductor
- **HeadyWeb** — media library and composition interface
- **heady-mobile** / **heady-desktop** — media display and interaction surfaces

## Instructions

### 1. Define the Media Pipeline Model

```yaml
media_conductor:
  pipeline:
    id: uuid
    name: pipeline-name
    type: generation | transformation | composition | delivery
    status: queued | running | completed | failed | cancelled

  media_types:
    text:
      generators: [heady-coder, heady-stories, headybuddy-core]
      formats: [plain, markdown, html, json, code]
      quality_gate: heady-critique text evaluation

    image:
      generators: [heady-imagine]
      formats: [png, svg, webp, jpeg]
      operations: [generate, edit, upscale, style-transfer, remove-background]
      quality_gate: heady-critique visual evaluation + heady-sentinel safety check

    audio:
      generators: [Voice Vessel TTS pipeline]
      formats: [mp3, wav, ogg, opus]
      operations: [tts, voice-clone (with consent), audio-edit]
      quality_gate: latency + quality metrics via heady-metrics

    code:
      generators: [heady-coder]
      formats: [source files in any language, notebooks, configs]
      operations: [generate, refactor, explain, test]
      quality_gate: heady-critique code review + heady-battle comparison

  asset:
    id: uuid
    type: text | image | audio | code
    format: specific format within type
    content: reference to stored content
    metadata:
      generator: which service created it
      prompt_hash: hash of generation prompt
      quality_score: heady-critique score
      provenance_id: link to Trust Fabric provenance chain
    storage: HeadyMemory (metadata + embeddings) + object store (binary assets)
    versions: every modification creates a new version
```

### 2. Build Multi-Modal Composition Pipelines

Orchestrate multiple generators into rich content:

```yaml
composition_pipelines:
  blog_post:
    name: "Rich Blog Post"
    steps:
      1. mcp_Heady_heady_analyze(data="{topic}", criteria="key points, audience, tone")
      2. mcp_Heady_heady_stories(prompt="{outline from analysis}") → draft text
      3. mcp_Heady_heady_imagine(prompt="{hero image for: topic}") → hero image
      4. mcp_Heady_heady_imagine(prompt="{section illustration}") → per-section images
      5. mcp_Heady_heady_critique(code="{full draft}", criteria="quality, coherence, engagement")
      6. Compose: assemble text + images into formatted output
      7. Provenance: record all generation steps in heady-traces
    output: markdown with embedded images, ready for HeadyWeb or export

  presentation:
    name: "AI Presentation Deck"
    steps:
      1. mcp_Heady_heady_analyze(data="{topic + audience}") → slide outline
      2. Per slide: mcp_Heady_heady_stories(prompt="{slide content}") → slide text
      3. Per slide: mcp_Heady_heady_imagine(prompt="{slide visual}") → slide image
      4. mcp_Heady_heady_critique(code="{full deck}", criteria="flow, visual consistency")
      5. Compose: assemble into presentation format
    output: structured slide deck with text + images

  audio_story:
    name: "Narrated Story"
    steps:
      1. mcp_Heady_heady_stories(prompt="{story prompt}") → story text
      2. Voice Vessel TTS with selected persona voice → narration audio
      3. mcp_Heady_heady_imagine(prompt="{story cover art}") → cover image
      4. Compose: story text + audio + cover art package
    output: audio file + text + cover image

  social_media_kit:
    name: "Social Media Content Kit"
    steps:
      1. mcp_Heady_heady_analyze(data="{campaign brief}") → platform-specific strategies
      2. Per platform: mcp_Heady_heady_stories(prompt="{platform-specific copy}") → text variants
      3. Per platform: mcp_Heady_heady_imagine(prompt="{visual at platform dimensions}") → images
      4. mcp_Heady_heady_battle(participants=variants, criteria="engagement potential")
      5. Compose: winning variants per platform
    output: platform-specific text + image bundles
```

### 3. Design Media Transformation Operations

```yaml
transformations:
  image:
    style_transfer:
      input: source image + target style (from heady-patterns)
      engine: heady-imagine
      output: image in new style preserving content

    format_conversion:
      input: image in any supported format
      output: converted to target format with quality settings
      optimization: automatic compression for web delivery

    responsive:
      input: source image
      output: multiple sizes for different surfaces (mobile, desktop, thumbnail)
      automation: heady-observer triggers when new image added

  text:
    tone_adaptation:
      input: source text + target tone (from heady-patterns style template)
      engine: heady-stories or headybuddy-core
      output: text rewritten in target tone

    format_conversion:
      input: markdown → html, json → readable, code → explanation
      engine: heady-coder

    localization:
      input: source text + target language
      engine: translation via headymcp-core
      quality: heady-critique evaluates translation quality

  audio:
    voice_change:
      input: source audio + target voice persona
      engine: Voice Vessel re-synthesis
      privacy: original audio discarded after transformation

    format_conversion:
      input: audio in any supported format
      output: converted to target format with bitrate settings

  cross_modal:
    text_to_image: heady-imagine from text prompt
    text_to_audio: Voice Vessel TTS from text
    image_to_text: heady-vinci image description
    code_to_explanation: heady-coder documentation generation
```

### 4. Implement Media Asset Management

```yaml
asset_management:
  library:
    storage: HeadyMemory (metadata + vector embeddings) + object store (binary files)
    organization:
      folders: user-created organizational structure
      tags: AI-suggested tags via heady-vinci + user-applied tags
      search: semantic search via HeadyMemory vector similarity
      filtering: by type, format, date, generator, quality score

  versioning:
    strategy: every modification creates new version
    storage: all versions retained (configurable retention)
    comparison: side-by-side diff for text, overlay for images
    rollback: any previous version can be restored

  sharing:
    internal: share within HeadyConnection workspace
    external: generate shareable link with optional expiry
    embedding: embed media in HeadyWeb or external sites
    permissions: read-only, comment, edit (per asset)

  lifecycle:
    creation: generated by any media pipeline → stored with metadata
    curation: user favorites, rates, organizes
    archival: auto-archive after inactivity period (configurable)
    deletion: user-initiated, follows HeadyMemory deletion policies
    quota: storage counted against plan limits (Monetization Matrix)
```

### 5. Design Content Safety and Quality Gates

```yaml
safety_and_quality:
  safety:
    pre_generation:
      - heady-sentinel scans generation prompts for policy violations
      - blocked categories: CSAM, violence, hate speech, PII generation
      - logged: all blocks recorded in heady-traces

    post_generation:
      - heady-sentinel scans generated content for safety violations
      - image: NSFW detection, text overlay safety, brand alignment
      - text: content policy compliance, PII detection
      - audio: content transcript safety check
      - action: block + log if violation detected

  quality:
    automated:
      - heady-critique evaluates every generated asset
      - minimum quality threshold: configurable per pipeline
      - below threshold: auto-regenerate (max 3 attempts) or flag for review

    comparative:
      - heady-battle compares variants when multiple generated
      - winner selected automatically or presented to user for choice

    brand:
      - heady-patterns brand guidelines applied to all generation
      - color palette, typography, tone, imagery style enforced
      - heady-critique validates brand alignment
```

### 6. Build the Media Dashboard

HeadyWeb interface for media management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Media Library** | HeadyMemory + object store | All assets with search, filter, and preview |
| **Active Pipelines** | heady-observer | Running generation pipelines with progress |
| **Quality Overview** | heady-metrics | Quality scores by media type, trend over time |
| **Usage Stats** | heady-metrics | Generations per type, storage consumed, quota |
| **Pipeline Templates** | heady-patterns | Reusable composition pipelines with one-click run |
| **Provenance** | heady-traces | Generation history and modification chain per asset |

## Output Format

When designing Media Conductor features, produce:

1. **Pipeline model** with media types, generators, and quality gates
2. **Composition pipelines** for multi-modal content creation workflows
3. **Transformation operations** for format conversion and cross-modal translation
4. **Asset management** with library, versioning, and sharing
5. **Safety and quality** gates with pre/post generation checks
6. **Dashboard** specification with media library and pipeline data

## Tips

- **The conductor orchestrates, generators create** — Media Conductor coordinates pipeline steps; actual generation happens in heady-imagine, Voice Vessel, heady-coder, heady-stories
- **Quality gates are non-negotiable** — every generated asset must pass heady-critique before delivery; skip this and quality degrades fast
- **Provenance feeds Trust Fabric** — every generation step is logged; this is the evidence chain for content authenticity
- **heady-patterns enforces brand** — style templates ensure visual and tonal consistency across all generated media
- **Multi-modal is the default** — most real content needs text + images + maybe audio; design pipelines as multi-modal from the start
- **heady-sentinel scans everything** — both prompts (pre) and outputs (post) pass through safety checks; no exceptions

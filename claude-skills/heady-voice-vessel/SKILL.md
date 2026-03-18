---
name: heady-voice-vessel
description: Design and operate the Heady Voice Vessel for real-time voice interaction, speech processing pipelines, voice persona modeling, and multi-modal voice experiences across Heady surfaces. Use when building voice input/output pipelines, designing voice personas for HeadyBuddy, implementing real-time speech-to-text and text-to-speech, creating voice-first interfaces for heady-mobile and heady-desktop, or planning voice-driven agent interaction. Integrates with headybuddy-core for companion voice, heady-vinci for voice pattern learning, and heady-observer for voice quality monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Voice Vessel

Use this skill when you need to **design, build, or operate the Voice Vessel** — Heady's real-time voice interaction system for natural speech input/output, voice persona modeling, and voice-first experiences across mobile, desktop, and browser surfaces.

## When to Use This Skill

- Building real-time speech-to-text (STT) and text-to-speech (TTS) pipelines
- Designing voice personas for HeadyBuddy with distinct vocal characteristics
- Implementing voice-first interfaces on heady-mobile and heady-desktop
- Creating voice-driven agent interaction for hands-free operation
- Planning multi-language voice support and accessibility features
- Designing voice quality monitoring and latency optimization

## Platform Context

The Voice Vessel operates across Heady's voice infrastructure:

- **headybuddy-core** — AI Companion; primary consumer of voice I/O for natural conversation
- **heady-mobile** — native mobile app with microphone access and local VAD
- **heady-desktop** — native desktop app with system audio access
- **heady-chrome** — browser extension with Web Audio API
- **heady-observer** — monitors voice pipeline health, latency, and quality
- **heady-metrics** — tracks voice latency (STT, processing, TTS), accuracy, and usage
- **heady-vinci** — learns voice interaction patterns, adapts to user speech style
- **heady-patterns** — stores voice persona templates and speech style guides
- **heady-sentinel** — enforces voice data privacy policies (no raw audio stored without consent)
- **heady-traces** — logs voice interaction events (metadata only; audio not retained)
- **headymcp-core** (31 MCP tools) — voice can trigger any MCP tool via natural language
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores conversation context for voice continuity

## Instructions

### 1. Define the Voice Pipeline Architecture

```yaml
voice_vessel:
  pipeline:
    input:
      capture:
        mobile: platform-native AVAudioEngine (iOS) / AudioRecord (Android)
        desktop: system audio API (WASAPI/CoreAudio/PulseAudio)
        browser: Web Audio API via heady-chrome
      vad:
        engine: local Voice Activity Detection (on-device, < 50ms latency)
        sensitivity: adjustable (quiet environment → high; noisy → adaptive)
        output: speech segments with timestamps
      streaming:
        protocol: WebSocket chunked audio (16kHz, 16-bit PCM)
        buffer: 100ms chunks for streaming STT
        backpressure: drop oldest if processing falls behind

    processing:
      stt:
        mode: streaming (partial results as user speaks)
        latency_target: "< 300ms from speech end to final transcript"
        languages: [en, es, fr, de, ja, zh, pt, ko — extensible]
        adaptation: heady-vinci learns user vocabulary and speech patterns
        confidence: per-word confidence scores for ambiguity handling

      nlu:
        engine: headybuddy-core natural language understanding
        context: HeadyMemory conversation history + current device context
        intent: map speech to action (question, command, conversation)
        tools: intent may trigger MCP tool invocation via headymcp-core

      response:
        engine: headybuddy-core with active persona
        format: structured response (text + optional rich content)

    output:
      tts:
        mode: streaming (start speaking before full response generated)
        latency_target: "< 500ms from response start to first audio"
        voices: persona-specific voice models from heady-patterns
        prosody: natural rhythm, emphasis, and pacing
        ssml: support for Speech Synthesis Markup Language for fine control

      delivery:
        mobile: platform audio output with ducking (lower other audio)
        desktop: system audio output with configurable output device
        browser: Web Audio API playback

      interruption:
        detection: VAD detects user speech during TTS playback
        action: immediately stop TTS, process new input
        behavior: Buddy acknowledges interruption naturally

  end_to_end_latency:
    target: "< 1.5s from end of user speech to start of Buddy response audio"
    measurement: heady-metrics tracks each pipeline stage independently
    optimization: local STT for short queries, cloud for complex ones
```

### 2. Design Voice Personas

Voice personality system aligned with HF research on character/persona layers:

```yaml
voice_personas:
  model:
    id: uuid
    name: persona voice name
    parent_persona: HeadyBuddy persona this voice belongs to
    characteristics:
      pitch: low | medium | high (base frequency range)
      speed: slow | moderate | fast (words per minute)
      warmth: cool | neutral | warm (tonal quality)
      energy: calm | balanced | energetic (dynamic range)
      accent: neutral-american | british | australian | custom

  built_in:
    - name: "Buddy Default"
      characteristics: { pitch: medium, speed: moderate, warmth: warm, energy: balanced }
      use_case: general conversation

    - name: "Focus Assistant"
      characteristics: { pitch: medium, speed: fast, warmth: neutral, energy: calm }
      use_case: task-oriented, minimal pleasantries

    - name: "Creative Muse"
      characteristics: { pitch: medium, speed: moderate, warmth: warm, energy: energetic }
      use_case: brainstorming, creative exploration

    - name: "Calm Guide"
      characteristics: { pitch: low, speed: slow, warmth: warm, energy: calm }
      use_case: meditation, wellness, wind-down

  customization:
    user_controls: pitch slider, speed slider, warmth slider (heady-buddy-portal)
    learning: heady-vinci detects preference from user engagement signals
    storage: voice persona config in HeadyMemory, synced across devices

  consistency:
    rule: same voice persona across all surfaces for a given persona profile
    switching: voice transitions smoothly when persona switches
    context_adaptation: subtle adjustments (slower in morning, more energetic during work)
```

### 3. Build Voice Interaction Modes

```yaml
interaction_modes:
  push_to_talk:
    activation: button press (mobile) or hotkey (desktop)
    behavior: record while held, process on release
    feedback: visual indicator + subtle audio cue
    default_on: [heady-mobile, heady-desktop]

  hands_free:
    activation: wake word ("Hey Buddy" or custom)
    wake_word_detection: on-device, always-listening (low power)
    behavior: continuous listening after wake word, auto-end on silence
    timeout: 30s of silence → return to wake word listening
    privacy: wake word detection is local-only; audio only streams after wake

  continuous_conversation:
    activation: user enables in settings
    behavior: Buddy listens continuously during active session
    vad: segments speech, processes each segment
    turn_taking: Buddy waits for natural pause before responding
    exit: user says "goodbye" / "stop listening" / timeout

  text_fallback:
    trigger: noisy environment detected, user preference, accessibility need
    behavior: seamless switch to text input, voice output continues
    indication: visual indicator shows text mode active

  hybrid:
    description: voice input + text output (or vice versa)
    use_case: user in meeting but needs Buddy response on screen
    activation: user configurable per-surface
```

### 4. Implement Voice Quality Monitoring

```yaml
quality_monitoring:
  real_time:
    stt_accuracy:
      measurement: word error rate (WER) via heady-metrics
      baseline: < 5% WER for supported languages
      degradation_alert: heady-observer fires if WER > 10% sustained

    latency:
      stages: [vad, stt, nlu, response_gen, tts, delivery]
      per_stage_budget:
        vad: 50ms
        stt: 300ms
        nlu: 200ms
        response_gen: 500ms
        tts: 300ms
        delivery: 100ms
      total_target: 1500ms end-to-end
      monitoring: heady-metrics per-stage percentile tracking (p50, p95, p99)

    quality:
      signal_to_noise: measure input audio quality
      clipping_detection: flag distorted audio
      echo_cancellation: verify AEC effectiveness
      network_jitter: measure WebSocket stability

  alerts:
    - condition: p95 latency > 2000ms → heady-observer alert
    - condition: STT WER > 10% for user → suggest microphone check
    - condition: TTS playback failures > 5% → fallback to text output
    - condition: wake word false positive rate > 1/hour → adjust sensitivity

  analytics:
    voice_usage: heady-metrics tracks voice vs text input ratio per user
    language_distribution: heady-metrics tracks languages used
    persona_preference: heady-vinci correlates voice persona with engagement
    peak_hours: heady-metrics identifies voice usage patterns for capacity planning
```

### 5. Design Voice Privacy and Safety

```yaml
voice_privacy:
  data_handling:
    raw_audio:
      rule: NEVER stored persistently without explicit user consent
      processing: streamed, processed, discarded
      exception: user opts in to "improve voice quality" program → anonymized samples retained

    transcripts:
      rule: stored as conversation text in HeadyMemory (same as text chat)
      attribution: marked as voice-originated for context
      deletion: follows standard HeadyMemory deletion policies

    voice_prints:
      rule: optional voice recognition for speaker identification
      storage: heady-sentinel vault (encrypted, never in HeadyMemory)
      user_control: can delete voice print at any time from heady-buddy-portal

  safety:
    content_filtering: same safety policies as text (applied to transcript)
    emergency_detection: flag potential emergency keywords, surface appropriate resources
    child_safety: voice interaction for minor accounts follows enhanced privacy rules
    recording_notification: visual indicator always visible when microphone is active

  consent:
    first_use: explicit opt-in for voice features with clear privacy explanation
    ongoing: microphone permission revocable at any time per surface
    granular: separate consent for wake word, voice recording, voice print
```

### 6. Build the Voice Dashboard

HeadyWeb interface for voice management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Voice Persona** | heady-patterns | Active voice settings with preview playback |
| **Pipeline Health** | heady-metrics | Per-stage latency (VAD → STT → NLU → TTS) with percentiles |
| **Usage Stats** | heady-metrics | Voice vs text ratio, session counts, peak hours |
| **Quality Scores** | heady-metrics | WER, latency trends, audio quality indicators |
| **Privacy Controls** | heady-sentinel | Microphone permissions, voice print status, data retention |
| **Language Settings** | heady-patterns | Active languages, accuracy per language |

## Output Format

When designing Voice Vessel features, produce:

1. **Pipeline architecture** with input, processing, and output stages with latency budgets
2. **Voice persona** system with characteristics, customization, and consistency rules
3. **Interaction modes** covering push-to-talk, hands-free, and hybrid scenarios
4. **Quality monitoring** with per-stage metrics and alert thresholds
5. **Privacy design** with data handling rules and consent flows
6. **Dashboard** specification with voice health data sources

## Tips

- **Latency is the voice UX killer** — every millisecond matters; pipeline stages have strict budgets
- **VAD and wake word must be local** — never stream audio to the cloud until the user is actively speaking
- **Interruption handling is essential** — users expect to cut Buddy off mid-sentence; design for it
- **Voice personas must be consistent** — same Buddy voice across phone, desktop, and browser
- **Privacy is non-negotiable** — raw audio is ephemeral by default; opt-in only for any retention
- **Text is always the fallback** — voice enhances but never gates; every voice feature must have a text equivalent

---
name: heady-intent-tracker
description: Use when implementing developer action tracking, intent inference from IDE behavior, or proactive AI assistance based on user activity patterns in the Heady™ ecosystem. Keywords include intent, action tracking, IDE tracking, proactive AI, developer behavior, activity inference, flow detection.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidIntent
  absorption_source: "Windsurf Flows — dual planning/execution architecture"
---

# Heady™ Intent Tracker (LiquidIntent)

## When to Use This Skill

Use this skill when the user needs to:
- Infer user intent from IDE actions (file edits, terminal, navigation)
- Proactively suggest next steps based on activity patterns
- Track developer workflows for automation opportunities
- Build context from behavior, not just explicit requests

## Architecture

### Signal Sources

| Source | Signals | Intent Weight |
|---|---|---|
| **File edits** | Open, modify, save, close | 0.9 |
| **Terminal** | Commands run, exit codes, output | 0.8 |
| **Navigation** | File switches, search queries, go-to-definition | 0.7 |
| **Clipboard** | Copy/paste patterns, stack overflow URLs | 0.5 |
| **Git** | Staged files, commit messages, branch switches | 0.6 |
| **Browser** | Documentation pages, API references | 0.4 |

### Intent Categories

| Intent | Signal Pattern | Proactive Action |
|---|---|---|
| **Bug Fixing** | Rapid file switching + terminal errors + stack trace copies | Suggest root cause analysis |
| **Feature Building** | New file creation + test file open + API edits | Generate boilerplate |
| **Refactoring** | Multiple rename operations + import changes | Suggest rename-all |
| **Debugging** | Console.log additions + breakpoint setting | Suggest structured logging |
| **Learning** | Doc page browsing + code reading + no edits | Explain code in context |
| **Deploying** | Env file edits + CI file changes + version bumps | Run deploy checklist |

### Inference Engine

```javascript
class IntentTracker {
  constructor() {
    this.signals = new RingBuffer(100);  // Last 100 signals
    this.backgroundPlanner = new BackgroundPlanner();
  }
  
  async ingestSignal(signal) {
    this.signals.push(signal);
    const intent = await this.classify(this.signals.recent(20));
    
    if (intent.confidence >= 0.618) {
      this.backgroundPlanner.update(intent);
      // Don't interrupt — queue proactive suggestion
      this.suggestQueue.push({
        intent: intent.category,
        suggestion: await this.generateSuggestion(intent),
        confidence: intent.confidence
      });
    }
  }
}
```

## Instructions

### Setting Up Intent Tracking

1. Install Heady IDE extension (VS Code / JetBrains).
2. Extension automatically tracks signals (all processing local).
3. Intent inference runs in background — never interrupts.
4. Suggestions appear in Heady sidebar when confidence ≥ 0.618.
5. User can accept, dismiss, or tune sensitivity.

### Privacy

- All signal processing is **local** — no data leaves the machine.
- Signals are **ephemeral** — ring buffer of last 100 only.
- User can disable any signal source individually.
- No keystroke logging — only file-level and command-level events.

## Output Format

- Current Intent Classification
- Suggestion Queue
- Activity Timeline
- Pattern Recognition Report

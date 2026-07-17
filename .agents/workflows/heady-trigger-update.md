<!-- HEADY_BRAND:BEGIN -->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║ -->
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║ -->
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║ -->
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: heady-trigger-update.md                                      ║ -->
<!-- ║  LAYER: orchestration                                           ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# /heady-trigger-update

This is the universal intelligence proxy for the Heady ecosystem. 

It provides a unified surface where any agent, external system, webhook, or human user can submit a "noteworthy observation" to Heady's Universal Proxy endpoint (`POST /api/heady/trigger`).

## Execution Logic
1. **Intake:** The signal is received from the command line, UI, or API proxy.
2. **CSL Gate (Confidence Scoring):** The system evaluates the payload using Continuous Semantic Logic.
   - If the signal contains `CRITICAL`, `ERROR`, or is a dense technical block (score >= 0.75), it **passes**.
   - If the signal is short, vague, or deemed low-impact (score < 0.75), it is **halted**.
3. **Action:**
   - **PASS:** Automatically triggers the Apex Router (`/heady`), waking up Heady intelligence to analyze, plan, and execute a fix or optimization autonomously.
   - **HALT:** The observation is silently logged into the 3D vector memory (`.data/vector-memory`) for future context, but no active agent orchestration occurs.

## Usage
### CLI
```bash
node src/hc_trigger_update.js "Observation details here"
```

### Slash Command
```
/heady-trigger-update [CRITICAL] The Cloud Run worker is failing on boot.
```

### API
```http
POST /api/heady/trigger
Content-Type: application/json

{
  "source": "external_agent",
  "payload": "High latency detected on Upstash Redis."
}
```

# Heady Agent Reference

## Agent Categories

### Thinkers
| Agent | Mission |
|---|---|
| HeadyBrain | General reasoning and primary cognitive processing |
| HeadySoul | Deep alignment, value governance, mission scoring |
| HeadyVinci | Pattern spotting, learning from outcomes |

### Builders
| Agent | Mission |
|---|---|
| HeadyCoder | Code orchestration and task routing |
| HeadyCodex | Hands-on code generation and modification |
| HeadyCopilot | Pair programming assistance |
| HeadyJules | Project management, sprint planning |

### Validators
| Agent | Mission |
|---|---|
| HeadyPerplexity | Web research and fact verification |
| HeadyGrok | Red team testing and adversarial evaluation |
| HeadyBattle | Quality gate — acceptance testing |
| HeadySims | Monte Carlo simulation for risk assessment |

### Creatives
| Agent | Mission |
|---|---|
| HeadyCreative | Creative content generation engine |
| HeadyVinci Canvas | Design sandbox |

### Operations
| Agent | Mission |
|---|---|
| HeadyManager | Control plane and central orchestrator |
| HeadyConductor | System monitoring and observability |
| HeadyLens | Change microscope — diff analysis |
| HeadyOps | Deployment automation |
| HeadyMaintenance | Cleanup, health checks, dependency audits |

### Personal Assistant
| Agent | Mission |
|---|---|
| HeadyBuddy | Browser-based assistant with context memory |

## Dynamic Workers (HeadyBees)

Ephemeral worker agents spawned on demand by the BeeFactory.
Each bee receives a mission, executes it, and is retired upon completion.

## Agent Lifecycle

1. **Spawn** — Created via BeeFactory or registered as persistent
2. **Idle** — Waiting for work
3. **Working** — Executing a task
4. **Error** — Recoverable failure state
5. **Retired** — Deallocated (ephemeral only)

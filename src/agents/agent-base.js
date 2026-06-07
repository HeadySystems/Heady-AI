// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/agents/agent-base.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Base Agent class — all Heady agents extend this.
 */
export class AgentBase {
  constructor({ name, category, mission, persistent = true }) {
    this.name = name;
    this.category = category;
    this.mission = mission;
    this.persistent = persistent;
    this.spawned = Date.now();
    this.status = 'idle';
  }

  async execute(input) {
    this.status = 'working';
    try {
      const result = await this.run(input);
      this.status = 'idle';
      return result;
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async run(_input) {
    throw new Error(`Agent ${this.name} must implement run()`);
  }

  health() {
    return {
      name: this.name,
      category: this.category,
      status: this.status,
      persistent: this.persistent,
      uptime: Date.now() - this.spawned,
    };
  }
}

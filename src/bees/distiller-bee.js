'use strict';

/**
 * DistillerBee — HeadyBee specialization for distillation tasks.
 * Spawned by bee-factory when DISTILL intent class is detected.
 */
class DistillerBee {
  constructor(config = {}) {
    this.type = 'distiller';
    this.version = '1.0.0';
    this.config = config;
    this.status = 'idle';
  }

  async execute(task) {
    this.status = 'distilling';
    const { trace_id, execution_log, judge_score } = task;

    try {
      const response = await fetch(`http://0.0.0.0:${process.env.DISTILLER_PORT || 3398}/distill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id, execution_log, judge_score }),
      });

      const result = await response.json();
      this.status = 'complete';
      return { success: true, result };
    } catch (err) {
      this.status = 'error';
      return { success: false, error: err.message };
    }
  }

  health() {
    return { type: this.type, version: this.version, status: this.status };
  }
}

module.exports = { DistillerBee };

'use strict';
// Stub task-decomposition (compiled from task-decomposition.ts)
class TaskDecomposition {
  constructor(opts = {}) {}
  async decompose(task) { return { subtasks: [task], dag: {}, order: [task.id || '0'] }; }
  async assign(subtasks) { return subtasks.map(t => ({ ...t, assignee: null })); }
}
module.exports = TaskDecomposition;
module.exports.TaskDecomposition = TaskDecomposition;

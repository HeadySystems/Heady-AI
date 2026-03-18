import { HeadyLogger } from '@heady-ai/core';
export class TaskOrchestrator {
    logger;
    redis;
    agents = new Map();
    constructor(redis) {
        this.logger = new HeadyLogger('task-orchestrator');
        this.redis = redis;
    }
    async assignTask(task) {
        const startTime = Date.now();
        this.logger.info(`Assigning task ${task.id}`, {
            type: task.type,
            priority: task.priority
        });
        // Find best agent based on load and capabilities
        const agent = this.selectAgent(task);
        if (!agent) {
            throw new Error(`No available agent for task type: ${task.type}`);
        }
        const assignment = {
            taskId: task.id,
            agentId: agent.id,
            assignedAt: new Date(),
            latency: Date.now() - startTime
        };
        // Store assignment in Redis
        const connection = await this.redis.getConnection();
        await connection.hset(`task:${task.id}`, 'assignedTo', agent.id);
        await connection.zadd('task:queue', task.priority, task.id);
        this.logger.info(`Task assigned in ${assignment.latency}ms`, {
            taskId: task.id,
            agentId: agent.id
        });
        return assignment;
    }
    selectAgent(task) {
        // Load balancing: select agent with lowest current load
        let bestAgent = null;
        let lowestLoad = 1.0;
        for (const agent of this.agents.values()) {
            if (agent.status === 'idle' || agent.status === 'busy') {
                if (agent.currentLoad < lowestLoad) {
                    lowestLoad = agent.currentLoad;
                    bestAgent = agent;
                }
            }
        }
        return bestAgent;
    }
    registerAgent(agent) {
        this.agents.set(agent.id, agent);
        this.logger.info(`Agent registered: ${agent.id}`, {
            type: agent.type,
            capabilities: agent.capabilities
        });
    }
    unregisterAgent(agentId) {
        this.agents.delete(agentId);
        this.logger.info(`Agent unregistered: ${agentId}`);
    }
}
//# sourceMappingURL=orchestrator.js.map
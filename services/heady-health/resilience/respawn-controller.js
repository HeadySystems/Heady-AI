const { spawn } = require('child_process');
const { PhiBackoff } = require('../core/phi-scales');
const logger = require('../utils/logger').child({ component: 'respawn-controller' });

class RespawnController {
    constructor(quarantineManager) {
        this.quarantineManager = quarantineManager;
        this.respawnHistory = new Map();
        this.registry = new Map();
        this.maxAttempts = 5;
    }

    registerService(serviceId, entryPoint) {
        this.registry.set(serviceId, {
            entryPoint,
            pid: null,
            restartCount: 0,
            lastRestart: null,
        });
    }

    async attemptRespawn(serviceId) {
        if (!this.respawnHistory.has(serviceId)) {
            this.respawnHistory.set(serviceId, {
                attempts: 0,
                successes: 0,
                failures: 0,
                totalDowntime: 0,
                backoff: new PhiBackoff(1000, this.maxAttempts)
            });
        }

        const history = this.respawnHistory.get(serviceId);
        history.attempts++;

        if (history.attempts > this.maxAttempts) {
            logger.error('Max respawn attempts reached', { serviceId, attempts: history.attempts });
            // Escalate to PERMANENT_QUARANTINE
            return { success: false, reason: 'max_attempts_exceeded' };
        }

        const backoffTime = history.backoff.next();
        logger.info('Attempting respawn', { serviceId, attempt: history.attempts, backoff: backoffTime });

        await new Promise(resolve => setTimeout(resolve, backoffTime));

        try {
            const success = await this.restartService(serviceId);

            if (success) {
                history.successes++;
                logger.info('Respawn successful', { serviceId, attempt: history.attempts });
                return { success: true };
            } else {
                history.failures++;
                return { success: false, reason: 'restart_failed' };
            }
        } catch (err) {
            history.failures++;
            logger.error('Respawn error', { serviceId, error: err.message });
            return { success: false, reason: err.message };
        }
    }

    async restartService(serviceId) {
        const serviceEntry = this.registry.get(serviceId);
        if (!serviceEntry) {
            logger.warn('No registry entry for service', { serviceId });
            return false;
        }

        try {
            const child = spawn('node', [serviceEntry.entryPoint], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env, SERVICE_NAME: serviceId },
            });
            child.unref();
            serviceEntry.pid = child.pid;
            serviceEntry.restartCount = (serviceEntry.restartCount || 0) + 1;
            serviceEntry.lastRestart = Date.now();
            logger.info('Restarted service', {
                serviceId,
                pid: child.pid,
                restartCount: serviceEntry.restartCount,
            });
            return true;
        } catch (err) {
            logger.error('Failed to restart service', { serviceId, error: err.message });
            return false;
        }
    }

    getHistory(serviceId) {
        return this.respawnHistory.get(serviceId) || null;
    }
}

module.exports = RespawnController;

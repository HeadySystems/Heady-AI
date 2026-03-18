"use strict";
/**
 * Scheduler Service — Core Business Logic
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGExecutor = exports.JobScheduler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const types_js_1 = require("./types.js");
const createLogger = (serviceName) => ({
    info: (msg, meta) => {
        const entry = { level: 'info', service: serviceName, msg, timestamp: new Date().toISOString(), ...meta };
        process.stdout.write(JSON.stringify(entry) + '\n');
    },
    warn: (msg, meta) => {
        const entry = { level: 'warn', service: serviceName, msg, timestamp: new Date().toISOString(), ...meta };
        process.stdout.write(JSON.stringify(entry) + '\n');
    },
    error: (msg, meta) => {
        const entry = { level: 'error', service: serviceName, msg, timestamp: new Date().toISOString(), ...meta };
        process.stderr.write(JSON.stringify(entry) + '\n');
    }
});
const logger = createLogger('scheduler-service');
class JobScheduler {
    constructor() {
        this.jobs = new Map();
        this.locks = new Map();
        this.results = new Map();
        this.deadLetter = [];
        this.maxRetries = types_js_1.FIB[5]; // 5 retries
        this.baseRetryMs = types_js_1.FIB[6] * 1000; // 8 seconds
    }
    schedule(job) {
        const scheduled = {
            ...job,
            jobId: crypto_1.default.randomUUID(),
            status: 'pending',
            retryCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            maxRetries: job.maxRetries || this.maxRetries
        };
        this.jobs.set(scheduled.jobId, scheduled);
        logger.info('job_scheduled', { jobId: scheduled.jobId, name: scheduled.name });
        return scheduled;
    }
    async acquireLock(jobId, holder) {
        if (this.locks.has(jobId)) {
            const existing = this.locks.get(jobId);
            if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
                return null;
            }
        }
        const lock = {
            jobId,
            lockId: crypto_1.default.randomUUID(),
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + types_js_1.FIB[8] * 1000).toISOString(), // 21s lock TTL
            holder
        };
        this.locks.set(jobId, lock);
        logger.info('lock_acquired', { jobId, holder });
        return lock;
    }
    releaseLock(jobId) {
        this.locks.delete(jobId);
    }
    completeJob(jobId, result, durationMs) {
        const jobResult = {
            jobId,
            status: 'completed',
            result,
            error: null,
            durationMs,
            completedAt: new Date().toISOString()
        };
        this.updateJobStatus(jobId, 'completed');
        this.storeResult(jobId, jobResult);
        this.releaseLock(jobId);
        logger.info('job_completed', { jobId, durationMs });
        return jobResult;
    }
    failJob(jobId, error, durationMs) {
        const job = this.jobs.get(jobId);
        const retryCount = (job?.retryCount ?? 0) + 1;
        const maxRetries = job?.maxRetries ?? this.maxRetries;
        const jobResult = {
            jobId,
            status: 'failed',
            result: null,
            error,
            durationMs,
            completedAt: new Date().toISOString()
        };
        if (retryCount >= maxRetries) {
            this.deadLetter.push(jobResult);
            this.updateJobStatus(jobId, 'dead_letter');
            logger.warn('job_dead_lettered', { jobId, retryCount });
        }
        else {
            const backoffMs = this.calculateBackoff(retryCount);
            const nextRunAt = new Date(Date.now() + backoffMs).toISOString();
            if (job) {
                const updated = { ...job, status: 'pending', retryCount, nextRunAt, updatedAt: new Date().toISOString() };
                this.jobs.set(jobId, updated);
            }
            logger.warn('job_retry_scheduled', { jobId, retryCount, backoffMs: Math.round(backoffMs) });
        }
        this.storeResult(jobId, jobResult);
        this.releaseLock(jobId);
        return jobResult;
    }
    calculateBackoff(attempt) {
        return this.baseRetryMs * Math.pow(types_js_1.PHI, attempt);
    }
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    listJobs(status) {
        const all = Array.from(this.jobs.values());
        return status ? all.filter(j => j.status === status) : all;
    }
    getDeadLetterQueue() {
        return [...this.deadLetter];
    }
    updateJobStatus(jobId, status) {
        const job = this.jobs.get(jobId);
        if (job) {
            this.jobs.set(jobId, { ...job, status, updatedAt: new Date().toISOString() });
        }
    }
    storeResult(jobId, result) {
        const existing = this.results.get(jobId) ?? [];
        existing.push(result);
        this.results.set(jobId, existing);
    }
}
exports.JobScheduler = JobScheduler;
class DAGExecutor {
    resolveDependencies(jobs) {
        const graph = new Map();
        const inDegree = new Map();
        for (const job of jobs) {
            graph.set(job.jobId, new Set());
            inDegree.set(job.jobId, 0);
        }
        for (const job of jobs) {
            for (const dep of job.dependencies) {
                graph.get(dep)?.add(job.jobId);
                inDegree.set(job.jobId, (inDegree.get(job.jobId) ?? 0) + 1);
            }
        }
        const levels = [];
        const queue = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0)
                queue.push(id);
        }
        while (queue.length > 0) {
            const level = [...queue];
            levels.push(level);
            queue.length = 0;
            for (const id of level) {
                for (const dependent of graph.get(id) ?? []) {
                    const newDegree = (inDegree.get(dependent) ?? 1) - 1;
                    inDegree.set(dependent, newDegree);
                    if (newDegree === 0)
                        queue.push(dependent);
                }
            }
        }
        return levels;
    }
}
exports.DAGExecutor = DAGExecutor;
//# sourceMappingURL=service.js.map
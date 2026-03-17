/**
 * Heady™ BeeActor — Cloudflare Durable Object per Active Bee
 * Actor Model at the edge: one DO per active Bee.
 * Sequential processing = no locks, no race conditions.
 */
import { PHI, PSI, CSL } from '../../core/constants/phi.js';

export class BeeActor {
  constructor(state, env) { this.state = state; this.env = env; this.storage = state.storage; }

  async fetch(request) {
    const url = new URL(request.url);
    switch (`${request.method} ${url.pathname}`) {
      case 'POST /task/assign':    return this.#assignTask(await request.json());
      case 'GET /task/status':     return this.#getStatus();
      case 'POST /task/complete':  return this.#completeTask(await request.json());
      case 'POST /csl/update':     return this.#updateConfidence(await request.json());
      case 'GET /memory/snapshot': return this.#memorySnapshot();
      case 'DELETE /':             return this.#terminate();
      default: return new Response('Not Found', { status: 404 });
    }
  }

  async #assignTask(task) {
    const existing = await this.storage.get('currentTask');
    if (existing && existing.status !== 'idle') return Response.json({ error: 'Bee busy', current: existing }, { status: 409 });
    const beeTask = { id: task.id, type: task.type, payload: task.payload, status: 'active', confidence: CSL.INCLUDE, startedAt: Date.now(), attempts: 0, maxAttempts: 5 };
    await this.storage.put('currentTask', beeTask);
    await this.storage.put('status', 'active');
    const ttl = Math.round(46979 * PHI);
    await this.state.storage.setAlarm(Date.now() + ttl);
    return Response.json({ assigned: true, taskId: beeTask.id, ttlMs: ttl });
  }

  async #updateConfidence({ delta, evidence }) {
    const task = await this.storage.get('currentTask');
    if (!task) return Response.json({ error: 'No active task' }, { status: 404 });
    task.confidence = Math.min(1.0, Math.max(0, task.confidence + (delta ?? 0) * PSI));
    task.evidence = [...(task.evidence ?? []), evidence].slice(-8);
    await this.storage.put('currentTask', task);
    const tier = task.confidence >= CSL.INJECT ? 'INJECT' : task.confidence >= CSL.BOOST ? 'BOOST' : task.confidence >= CSL.INCLUDE ? 'INCLUDE' : 'SUPPRESS';
    return Response.json({ confidence: task.confidence, tier });
  }

  async #getStatus() {
    const task = await this.storage.get('currentTask');
    const status = await this.storage.get('status') ?? 'idle';
    return Response.json({ status, task });
  }

  async #completeTask({ result, success }) {
    const task = await this.storage.get('currentTask');
    if (!task) return Response.json({ error: 'No active task' }, { status: 404 });
    task.status = success ? 'completed' : 'failed'; task.result = result;
    task.completedAt = Date.now(); task.durationMs = task.completedAt - task.startedAt;
    await this.storage.put('currentTask', task); await this.storage.put('status', 'idle');
    await this.storage.deleteAlarm();
    return Response.json({ done: true, durationMs: task.durationMs });
  }

  async #memorySnapshot() {
    const task = await this.storage.get('currentTask');
    const allKeys = await this.storage.list({ limit: 55 });
    return Response.json({ task, memory: Object.fromEntries(allKeys) });
  }

  async #terminate() { await this.storage.deleteAll(); return Response.json({ terminated: true }); }

  async alarm() {
    const task = await this.storage.get('currentTask');
    if (task?.status === 'active') {
      task.status = 'timeout'; task.timedOutAt = Date.now();
      await this.storage.put('currentTask', task); await this.storage.put('status', 'idle');
      await this.env.HEADY_KV?.put(`bee:timeout:${task.id}`, JSON.stringify(task), { expirationTtl: 3600 });
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const beeId = url.searchParams.get('beeId');
    if (!beeId) return new Response('beeId required', { status: 400 });
    const id = env.BEE_ACTOR.idFromName(beeId);
    return env.BEE_ACTOR.get(id).fetch(request);
  },
};

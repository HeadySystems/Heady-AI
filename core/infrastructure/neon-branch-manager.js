/**
 * Heady™ Neon Branch Manager — Branch-per-Bee Agent
 * Each Bee gets an isolated Neon branch for task execution.
 * @module core/infrastructure/neon-branch-manager
 */
import { randomUUID } from 'node:crypto';
import { TIMING, PHI, FIB } from '../constants/phi.js';

export class NeonBranchManager {
  #client; #projectId; #activeBranches = new Map(); #maxBranches = FIB[10]; // 55

  constructor({ neonApiKey, projectId, logger }) {
    this.log = logger; this.#projectId = projectId;
    this.#client = { baseUrl: 'https://console.neon.tech/api/v2', headers: { 'Authorization': `Bearer ${neonApiKey}`, 'Content-Type': 'application/json' } };
  }

  async createForBee(beeId, taskDescription) {
    if (this.#activeBranches.size >= this.#maxBranches) await this.#evictOldest();
    const branchName = `bee-${beeId}-${Date.now()}`;
    const res = await this.#api('POST', `/projects/${this.#projectId}/branches`, {
      branch: { name: branchName, parent_id: 'main' },
      endpoints: [{ type: 'read_write', autoscaling_limit_min_cu: 0.25 }],
    });
    const branch = { branchId: res.branch.id, branchName, connectionString: res.connection_uris[0]?.connection_uri, beeId, taskDescription, createdAt: Date.now(), expiresAt: Date.now() + TIMING.COLD * PHI };
    this.#activeBranches.set(beeId, branch);
    this.log?.info({ msg: 'neon.branch.created', beeId, branchName });
    return branch;
  }

  async discard(beeId) {
    const branch = this.#activeBranches.get(beeId);
    if (!branch) return;
    await this.#api('DELETE', `/projects/${this.#projectId}/branches/${branch.branchId}`).catch(err => this.log?.warn({ msg: 'neon.branch.delete.failed', err: err.message }));
    this.#activeBranches.delete(beeId);
    this.log?.info({ msg: 'neon.branch.discarded', beeId });
  }

  async gcExpired() {
    const now = Date.now();
    const expired = [...this.#activeBranches.entries()].filter(([,b]) => b.expiresAt < now);
    await Promise.all(expired.map(([beeId]) => this.discard(beeId)));
    return expired.length;
  }

  async #evictOldest() {
    const oldest = [...this.#activeBranches.entries()].sort(([,a],[,b]) => a.createdAt - b.createdAt)[0];
    if (oldest) await this.discard(oldest[0]);
  }

  async #api(method, path, body) {
    const res = await fetch(`${this.#client.baseUrl}${path}`, { method, headers: this.#client.headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`Neon API ${method} ${path}: ${res.status}`);
    return method === 'DELETE' ? null : res.json();
  }

  getStats() { return { activeBranches: this.#activeBranches.size, maxBranches: this.#maxBranches, branches: [...this.#activeBranches.values()].map(b => ({ beeId: b.beeId, branchName: b.branchName, ageMs: Date.now()-b.createdAt })) }; }
}

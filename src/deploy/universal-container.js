// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Universal Container — Single Image, JIT-Morphing via Role Assignment
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, FIB, sha256 } from '../shared/phi-math-v2.js';

const CONTAINER_CONFIG = Object.freeze({
  image: 'us-east1-docker.pkg.dev/gen-lang-client-0920560496/heady/node',
  tag: 'latest',
  basePort: 3310,
  nodeVersion: '22-alpine',
  memoryLimit: FIB[8] + 'Mi',
  cpuLimit: '1000m',
});

class UniversalContainer {
  #roles;

  constructor() {
    this.#roles = new Map();
    this.#initializeRoles();
  }

  generateDockerfile(role = 'base') {
    return `FROM node:${CONTAINER_CONFIG.nodeVersion}
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV HEADY_ROLE=${role}
ENV HEADY_PORT=${this.#roles.get(role)?.port || CONTAINER_CONFIG.basePort}
ENV NODE_ENV=production
ENV TZ=UTC
EXPOSE ${this.#roles.get(role)?.port || CONTAINER_CONFIG.basePort}
HEALTHCHECK --interval=${FIB[8]}s --timeout=${FIB[5]}s --retries=${FIB[4]} \\
  CMD curl -f http://0.0.0.0:${this.#roles.get(role)?.port || CONTAINER_CONFIG.basePort}/health || exit 1
CMD ["node", "--experimental-vm-modules", "index.js"]`;
  }

  assignRole(containerName, role) {
    const roleConfig = this.#roles.get(role);
    if (!roleConfig) throw new Error('Unknown role: ' + role);
    return {
      container: containerName,
      role,
      port: roleConfig.port,
      group: roleConfig.group,
      env: {
        HEADY_ROLE: role,
        HEADY_PORT: String(roleConfig.port),
        HEADY_GROUP: roleConfig.group,
      },
    };
  }

  getContainerConfig(role = 'base') {
    const roleConfig = this.#roles.get(role) || {};
    return {
      image: CONTAINER_CONFIG.image + ':' + CONTAINER_CONFIG.tag,
      port: roleConfig.port || CONTAINER_CONFIG.basePort,
      resources: {
        limits: { memory: CONTAINER_CONFIG.memoryLimit, cpu: CONTAINER_CONFIG.cpuLimit },
        requests: { memory: FIB[7] + 'Mi', cpu: FIB[8] * 10 + 'm' },
      },
      env: { HEADY_ROLE: role, NODE_ENV: 'production' },
    };
  }

  morph(containerName, fromRole, toRole) {
    return {
      container: containerName,
      from: fromRole,
      to: toRole,
      newConfig: this.assignRole(containerName, toRole),
      morphedAt: Date.now(),
    };
  }

  getRoles() { return Array.from(this.#roles.entries()).map(([name, cfg]) => ({ name, ...cfg })); }

  #initializeRoles() {
    const groups = ['inference', 'memory', 'agents', 'orchestration', 'security', 'monitoring', 'web', 'data', 'integration', 'specialized'];
    let port = CONTAINER_CONFIG.basePort;
    for (const group of groups) {
      const count = group === 'security' || group === 'monitoring' ? FIB[5] : FIB[6] > 7 ? 10 : FIB[6];
      for (let i = 0; i < (group === 'specialized' ? 7 : group === 'security' || group === 'monitoring' ? 5 : 10); i++) {
        const role = group + '-' + String(i + 1).padStart(2, '0');
        this.#roles.set(role, { port, group });
        port++;
      }
    }
  }
}

export { UniversalContainer, CONTAINER_CONFIG };
export default UniversalContainer;

// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  LiquidArchitectureService — Template Injection & Projection     ║
// ║  3D/4D Spatial Instance Management & Stale Asset Governance      ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// Default TTL for projection instances (30 minutes)
const DEFAULT_TTL_MS = 30 * 60 * 1000;

// Stale asset threshold (1 hour)
const STALE_THRESHOLD_MS = 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════
// Template Registry — Manages injectable 3D/4D templates
// ═══════════════════════════════════════════════════════════════════

class TemplateRegistry {
  constructor() {
    this.templates = new Map();
  }

  // Register a template with spatial metadata
  register(template) {
    const { id, name, dimensions = 3, schema = {}, transform = null } = template;
    if (!id || !name) throw new Error('Template requires id and name');

    const entry = {
      id,
      name,
      dimensions,
      schema,
      transform,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hash: this._hash(schema),
    };

    this.templates.set(id, entry);
    return entry;
  }

  // Get a template by ID
  get(id) {
    return this.templates.get(id) || null;
  }

  // Update a template (bumps version)
  update(id, changes) {
    const existing = this.templates.get(id);
    if (!existing) throw new Error(`Template ${id} not found`);

    const updated = {
      ...existing,
      ...changes,
      id: existing.id, // Prevent ID change
      version: existing.version + 1,
      updatedAt: Date.now(),
      hash: this._hash(changes.schema || existing.schema),
    };

    this.templates.set(id, updated);
    return updated;
  }

  // List all templates
  list() {
    return Array.from(this.templates.values());
  }

  _hash(obj) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(obj))
      .digest('hex')
      .substring(0, 12);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Projection Instance — A live spatial instance of a template
// ═══════════════════════════════════════════════════════════════════

class ProjectionInstance {
  constructor(template, options = {}) {
    this.id = crypto.randomBytes(8).toString('hex');
    this.templateId = template.id;
    this.templateVersion = template.version;
    this.dimensions = template.dimensions;
    this.state = 'active';
    this.position = options.position || [0, 0, 0];
    this.scale = options.scale || [1, 1, 1];
    this.rotation = options.rotation || [0, 0, 0];
    this.data = {};
    this.ttl = options.ttl || DEFAULT_TTL_MS;
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.accessCount = 0;

    // 4D: optional time dimension
    if (this.dimensions >= 4) {
      this.timeOffset = options.timeOffset || 0;
      this.timeScale = options.timeScale || 1.0;
    }
  }

  // Apply template transform to data
  inject(data, transform = null) {
    this.lastAccessedAt = Date.now();
    this.accessCount++;

    if (transform && typeof transform === 'function') {
      this.data = transform(data, this);
    } else {
      this.data = { ...this.data, ...data };
    }

    return this.data;
  }

  // Check if this instance is expired
  isExpired() {
    return Date.now() - this.createdAt > this.ttl;
  }

  // Check if this instance is stale (no recent access)
  isStale(threshold = STALE_THRESHOLD_MS) {
    return Date.now() - this.lastAccessedAt > threshold;
  }

  // Get spatial bounds (bounding box)
  bounds() {
    return {
      min: this.position.map((p, i) => p - this.scale[i] * PSI),
      max: this.position.map((p, i) => p + this.scale[i] * PSI),
    };
  }

  // Snapshot for monitoring
  snapshot() {
    return {
      id: this.id,
      templateId: this.templateId,
      templateVersion: this.templateVersion,
      state: this.state,
      dimensions: this.dimensions,
      position: this.position,
      scale: this.scale,
      accessCount: this.accessCount,
      age: Date.now() - this.createdAt,
      stale: this.isStale(),
      expired: this.isExpired(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// StaleAssetGovernor — Manages lifecycle of projection instances
// ═══════════════════════════════════════════════════════════════════

class StaleAssetGovernor {
  constructor(options = {}) {
    this.staleThreshold = options.staleThreshold || STALE_THRESHOLD_MS;
    this.maxInstances = options.maxInstances || 1000;
    this.evictionPolicy = options.evictionPolicy || 'lru'; // lru | lfu | ttl
    this.evictionLog = [];
    this.maxLogSize = options.maxLogSize || 500;
  }

  // Scan instances and return stale/expired ones
  audit(instances) {
    const stale = [];
    const expired = [];
    const healthy = [];

    for (const instance of instances) {
      if (instance.isExpired()) {
        expired.push(instance);
      } else if (instance.isStale(this.staleThreshold)) {
        stale.push(instance);
      } else {
        healthy.push(instance);
      }
    }

    return { stale, expired, healthy, total: instances.length };
  }

  // Evict instances based on policy, returns evicted IDs
  evict(instances) {
    const evicted = [];

    // Always evict expired first
    const { expired, stale, healthy } = this.audit(instances);
    for (const inst of expired) {
      inst.state = 'evicted';
      evicted.push(inst.id);
    }

    // If still over capacity, evict stale by policy
    const remaining = healthy.length + stale.length;
    if (remaining > this.maxInstances) {
      const toEvict = remaining - this.maxInstances;
      const candidates = this._sortByPolicy(stale);

      for (let i = 0; i < Math.min(toEvict, candidates.length); i++) {
        candidates[i].state = 'evicted';
        evicted.push(candidates[i].id);
      }
    }

    // Log evictions
    if (evicted.length > 0) {
      this.evictionLog.push({
        timestamp: Date.now(),
        count: evicted.length,
        ids: evicted,
        policy: this.evictionPolicy,
      });
      if (this.evictionLog.length > this.maxLogSize) {
        this.evictionLog.shift();
      }
    }

    return evicted;
  }

  _sortByPolicy(instances) {
    switch (this.evictionPolicy) {
      case 'lru':
        return [...instances].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      case 'lfu':
        return [...instances].sort((a, b) => a.accessCount - b.accessCount);
      case 'ttl':
        return [...instances].sort((a, b) => a.createdAt - b.createdAt);
      default:
        return instances;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// LiquidArchitectureService — Main Service
// ═══════════════════════════════════════════════════════════════════

class LiquidArchitectureService {
  constructor(options = {}) {
    this.registry = new TemplateRegistry();
    this.governor = new StaleAssetGovernor(options.governance || {});
    this.instances = new Map();
    this.projectionCount = 0;
  }

  // Register a spatial template
  registerTemplate(template) {
    return this.registry.register(template);
  }

  // Create a projection instance from a template
  project(templateId, options = {}) {
    const template = this.registry.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    const instance = new ProjectionInstance(template, options);
    this.instances.set(instance.id, instance);
    this.projectionCount++;

    return instance;
  }

  // Inject data into a projection instance
  inject(instanceId, data, transform = null) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    if (instance.state !== 'active') throw new Error(`Instance ${instanceId} is ${instance.state}`);

    return instance.inject(data, transform);
  }

  // Run governance: audit and evict stale assets
  govern() {
    const allInstances = Array.from(this.instances.values());
    const audit = this.governor.audit(allInstances);
    const evictedIds = this.governor.evict(allInstances);

    // Remove evicted instances
    for (const id of evictedIds) {
      this.instances.delete(id);
    }

    return {
      audit: {
        total: audit.total,
        healthy: audit.healthy.length,
        stale: audit.stale.length,
        expired: audit.expired.length,
      },
      evicted: evictedIds.length,
      remaining: this.instances.size,
    };
  }

  // Get service status
  status() {
    const allInstances = Array.from(this.instances.values());
    const audit = this.governor.audit(allInstances);

    return {
      templates: this.registry.list().length,
      activeInstances: this.instances.size,
      totalProjections: this.projectionCount,
      health: {
        healthy: audit.healthy.length,
        stale: audit.stale.length,
        expired: audit.expired.length,
      },
      evictionLog: this.governor.evictionLog.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  LiquidArchitectureService,
  TemplateRegistry,
  ProjectionInstance,
  StaleAssetGovernor,
  DEFAULT_TTL_MS,
  STALE_THRESHOLD_MS,
};

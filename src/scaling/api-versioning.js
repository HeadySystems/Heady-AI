/**
 * ApiVersioning — Multi-Strategy API Version Router
 * Supports URL path (/v1/, /v2/), header (X-API-Version), and Accept header versioning.
 * Manages version lifecycle (current, deprecated, sunset) with φ-scaled deprecation.
 * All constants φ-derived. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Version Definitions ──────────────────────────────────────────
const VERSION_LIFECYCLE = {
  current:    { deprecationWarning: false, sunsetHeader: false },
  deprecated: { deprecationWarning: true, sunsetHeader: true },
  sunset:     { deprecationWarning: true, sunsetHeader: true, blocked: true },
};

class VersionRegistry {
  constructor() {
    this.versions = new Map();
    this.currentVersion = null;
  }

  register(version, config = {}) {
    this.versions.set(version, {
      version,
      status: config.status ?? 'current',
      introducedAt: config.introducedAt ?? new Date().toISOString(),
      deprecatedAt: config.deprecatedAt ?? null,
      sunsetAt: config.sunsetAt ?? null,
      handlers: new Map(),
      changelog: config.changelog ?? [],
    });
    if (config.status === 'current' || !this.currentVersion) {
      this.currentVersion = version;
    }
    return this;
  }

  addRoute(version, path, handler) {
    const ver = this.versions.get(version);
    if (!ver) return { error: `Version ${version} not registered` };
    ver.handlers.set(path, handler);
    return this;
  }

  resolve(version) {
    if (version && this.versions.has(version)) return this.versions.get(version);
    return this.versions.get(this.currentVersion);
  }

  list() {
    return [...this.versions.values()].map(v => ({
      version: v.version,
      status: v.status,
      introducedAt: v.introducedAt,
      deprecatedAt: v.deprecatedAt,
      sunsetAt: v.sunsetAt,
    }));
  }
}

class ApiVersioning {
  constructor(config = {}) {
    this.registry = new VersionRegistry();
    this.strategy = config.strategy ?? 'path'; // path | header | accept
    this.headerName = config.headerName ?? 'X-API-Version';
    this.pathPrefix = config.pathPrefix ?? '/api/';
    this.deprecationGraceDays = config.deprecationGraceDays ?? FIB[11]; // 89 days
    this.sunsetGraceDays = config.sunsetGraceDays ?? FIB[13]; // 233 days
    this.requestCounts = new Map();
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];

    // Register default versions
    this.registry.register('v1', { status: 'current', introducedAt: '2026-01-01T00:00:00Z' });
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  _extractVersion(req) {
    // Strategy 1: URL path — /api/v1/resource
    const pathMatch = req.url?.match(/\/api\/(v\d+)\//);
    if (pathMatch) return pathMatch[1];

    // Strategy 2: Custom header — X-API-Version: v1
    const headerVersion = req.headers?.[this.headerName.toLowerCase()];
    if (headerVersion) return headerVersion;

    // Strategy 3: Accept header — Accept: application/vnd.heady.v1+json
    const accept = req.headers?.accept ?? '';
    const acceptMatch = accept.match(/application\/vnd\.heady\.(v\d+)\+json/);
    if (acceptMatch) return acceptMatch[1];

    // Default to current version
    return this.registry.currentVersion;
  }

  middleware() {
    const self = this;
    return (req, res, next) => {
      const version = self._extractVersion(req);
      const versionDef = self.registry.resolve(version);

      if (!versionDef) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unknown API version: ${version}`, code: 'HEADY-VERSION-001', availableVersions: self.registry.list() }));
        return;
      }

      const lifecycle = VERSION_LIFECYCLE[versionDef.status];

      // Block sunset versions
      if (lifecycle?.blocked) {
        res.writeHead(410, { 'Content-Type': 'application/json', 'Sunset': versionDef.sunsetAt });
        res.end(JSON.stringify({ error: `API version ${version} has been sunset`, code: 'HEADY-VERSION-002', sunsetAt: versionDef.sunsetAt, currentVersion: self.registry.currentVersion }));
        return;
      }

      // Set version headers
      res.setHeader('X-API-Version', versionDef.version);
      res.setHeader('X-API-Current-Version', self.registry.currentVersion);

      if (lifecycle?.deprecationWarning) {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Link', `</api/${self.registry.currentVersion}/>; rel="successor-version"`);
        if (versionDef.sunsetAt) res.setHeader('Sunset', versionDef.sunsetAt);
      }

      // Track usage per version
      const countKey = versionDef.version;
      self.requestCounts.set(countKey, (self.requestCounts.get(countKey) ?? 0) + 1);

      // Attach version info to request context
      req.apiVersion = { version: versionDef.version, status: versionDef.status };

      self._audit('route', { version: versionDef.version, path: req.url });
      next?.();
    };
  }

  health() {
    const versionUsage = {};
    for (const [v, count] of this.requestCounts) versionUsage[v] = count;
    return {
      currentVersion: this.registry.currentVersion,
      versions: this.registry.list(),
      usage: versionUsage,
      strategy: this.strategy,
    };
  }
}

export default ApiVersioning;
export { ApiVersioning, VersionRegistry, VERSION_LIFECYCLE };

'use strict';

/**
 * HEADY™ Cloudflare Hyperdrive — Liquid Architecture v9 (§P9)
 *
 * Edge connection pooler for Neon Postgres:
 * - Transparent connection pooling at Cloudflare edge PoPs
 * - Eliminates cold-start TCP/TLS overhead for Workers
 * - Auto-caches prepared statements at edge
 *
 * In Workers, Hyperdrive is accessed via env.HYPERDRIVE binding.
 * This module provides:
 * 1. A setup helper for non-Worker environments (falls back to direct Neon)
 * 2. Configuration management
 * 3. Connection string resolver
 *
 * @see https://developers.cloudflare.com/hyperdrive/
 */

class Hyperdrive {
  /**
   * @param {object} config
   * @param {string} [config.hyperdriveId]      - Hyperdrive config ID
   * @param {string} [config.directConnectionUrl] - Direct Neon connection (fallback)
   * @param {object} [config.binding]           - Cloudflare Worker env.HYPERDRIVE binding
   */
  constructor(config = {}) {
    this.hyperdriveId = config.hyperdriveId || process.env.HYPERDRIVE_ID;
    this.directUrl = config.directConnectionUrl || process.env.DATABASE_URL;
    this.binding = config.binding || null;
  }

  /**
   * Get the optimal connection string.
   *
   * In Workers: uses Hyperdrive binding (pooled, edge-cached)
   * Elsewhere:  falls back to direct Neon URL
   *
   * @returns {string} Connection string
   */
  getConnectionString() {
    // Workers runtime: use Hyperdrive binding
    if (this.binding?.connectionString) {
      return this.binding.connectionString;
    }

    // Fallback: direct connection
    if (this.directUrl) {
      return this.directUrl;
    }

    throw new Error('[Hyperdrive] No connection string available — set DATABASE_URL or provide Hyperdrive binding');
  }

  /**
   * Create a wrangler.toml Hyperdrive configuration block.
   * Used during setup to configure the Cloudflare Worker.
   *
   * @param {object} options
   * @param {string} options.name         - Config name (e.g. 'heady-neon')
   * @param {string} options.connectionString - Neon connection URL
   * @param {string} [options.caching]    - 'enabled' | 'disabled' (default: enabled)
   * @returns {string} TOML configuration block
   */
  static generateWranglerConfig(options) {
    return `
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "${options.id || '<run: wrangler hyperdrive create ${name}>'}"
# name = "${options.name}"
# connection_string = "${options.connectionString}"
# caching = { disabled = ${options.caching === 'disabled' ? 'true' : 'false'} }
`.trim();
  }

  /**
   * Create a pg Pool configured to use Hyperdrive (or fallback).
   * Requires the `pg` package.
   *
   * @param {object} [poolConfig] - Additional pg.Pool options
   * @returns {object} pg.Pool instance
   */
  createPool(poolConfig = {}) {
    const { Pool } = require('pg');
    return new Pool({
      connectionString: this.getConnectionString(),
      max: poolConfig.max || 10,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis || 20000,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis || 5000,
      ...poolConfig,
    });
  }

  /**
   * Usage example for Cloudflare Workers.
   *
   * In your Worker's fetch handler:
   *   const hyperdrive = new Hyperdrive({ binding: env.HYPERDRIVE });
   *   const connStr = hyperdrive.getConnectionString();
   *   // Use with pg, drizzle, or any Postgres client
   */

  /**
   * Health check — verify connection works.
   */
  async ping() {
    try {
      const pool = this.createPool({ max: 1 });
      const { rows } = await pool.query('SELECT 1 AS ok');
      await pool.end();
      return {
        ok: rows[0]?.ok === 1,
        mode: this.binding ? 'hyperdrive' : 'direct',
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = { Hyperdrive };

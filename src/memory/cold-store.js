/**
 * Cold Store - Archival storage for Heady Latent OS
 * Part of the Latent OS 3-Tier Architecture
 */
'use strict';
const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../utils/logger');
const logger = createLogger('cold-store');

class ColdStore {
  constructor(config = {}) {
    this.archiveDir = config.archiveDir || path.join(__dirname, '../../../data/cold-archive');
  }

  async connect() {
    try {
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create cold storage directory');
    }
  }

  async archive(key, value, metadata = {}) {
    const filename = path.join(this.archiveDir, `${key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`);
    const payload = JSON.stringify({ key, value, metadata, archivedAt: Date.now() }, null, 2);
    try {
      await fs.writeFile(filename, payload, 'utf8');
      logger.debug({ key, filename }, 'Archived to cold store');
    } catch (err) {
      logger.error({ key, error: err.message }, 'Failed to write to cold store');
    }
  }

  async retrieve(key) {
    const filename = path.join(this.archiveDir, `${key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`);
    try {
      const data = await fs.readFile(filename, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.value;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error({ key, error: err.message }, 'Failed to read from cold store');
      }
      return null;
    }
  }
}

module.exports = { ColdStore };

'use strict';

const crypto = require('node:crypto');

class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  create({ subject, provider, roles, origin, userAgent }) {
    const id = crypto.randomBytes(32).toString('base64url');
    const session = {
      id,
      sub: subject,
      provider: provider || 'unknown',
      roles: roles || [],
      origin: origin || null,
      userAgent: userAgent || null,
      createdAt: Date.now()
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  delete(id) {
    return this.sessions.delete(id);
  }
}

module.exports = { SessionStore };

'use strict';
// Stub auth provider bee
class AuthProviderBee {
  constructor(opts = {}) { this.provider = opts.provider || 'local'; }
  async authenticate(credentials) { return { authenticated: false, user: null, error: 'stub' }; }
  async refresh(token) { return { token: null, error: 'stub' }; }
}
module.exports = AuthProviderBee;
module.exports.AuthProviderBee = AuthProviderBee;

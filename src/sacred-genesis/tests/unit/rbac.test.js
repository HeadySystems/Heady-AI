/**
 * Unit Tests — RBAC System
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');

const PSI = 0.6180339887498948;

const ROLES = {
  viewer: {
    weight: PSI * PSI * PSI * PSI,
    permissions: ['read:services', 'read:health', 'read:metrics'],
    inherits: []
  },
  developer: {
    weight: PSI * PSI * PSI,
    permissions: ['read:vectors', 'write:vectors', 'read:embeddings', 'write:embeddings'],
    inherits: ['viewer']
  },
  operator: {
    weight: PSI * PSI,
    permissions: ['write:flags', 'write:schemas', 'execute:deploy'],
    inherits: ['developer']
  },
  admin: {
    weight: PSI,
    permissions: ['manage:users', 'manage:roles', 'execute:chaos'],
    inherits: ['operator']
  },
  superadmin: {
    weight: 1.0,
    permissions: ['manage:platform', 'execute:shutdown'],
    inherits: ['admin']
  }
};

function resolvePermissions(roleName) {
  const role = ROLES[roleName];
  if (!role) return new Set();
  const perms = new Set(role.permissions);
  for (const inherited of role.inherits) {
    for (const p of resolvePermissions(inherited)) perms.add(p);
  }
  return perms;
}

module.exports = {
  'viewer has read permissions only': () => {
    const perms = resolvePermissions('viewer');
    assert(perms.has('read:services'));
    assert(perms.has('read:health'));
    assert(!perms.has('write:vectors'));
    assert(!perms.has('manage:users'));
  },

  'developer inherits viewer permissions': () => {
    const perms = resolvePermissions('developer');
    assert(perms.has('read:services'), 'Should inherit read:services');
    assert(perms.has('read:vectors'), 'Should have own read:vectors');
    assert(perms.has('write:vectors'), 'Should have own write:vectors');
  },

  'admin inherits all lower role permissions': () => {
    const perms = resolvePermissions('admin');
    assert(perms.has('read:services'), 'From viewer');
    assert(perms.has('write:vectors'), 'From developer');
    assert(perms.has('execute:deploy'), 'From operator');
    assert(perms.has('manage:users'), 'Own permission');
  },

  'superadmin has all permissions': () => {
    const superPerms = resolvePermissions('superadmin');
    for (const [roleName, role] of Object.entries(ROLES)) {
      for (const perm of role.permissions) {
        assert(superPerms.has(perm), `Missing ${perm} from ${roleName}`);
      }
    }
  },

  'role weights are monotonically increasing': () => {
    const roles = ['viewer', 'developer', 'operator', 'admin', 'superadmin'];
    for (let i = 0; i < roles.length - 1; i++) {
      assert(ROLES[roles[i]].weight < ROLES[roles[i + 1]].weight,
        `${roles[i]} (${ROLES[roles[i]].weight}) should be less than ${roles[i + 1]} (${ROLES[roles[i + 1]].weight})`);
    }
  },

  'viewer cannot manage users': () => {
    const perms = resolvePermissions('viewer');
    assert(!perms.has('manage:users'));
    assert(!perms.has('manage:platform'));
    assert(!perms.has('execute:shutdown'));
  },

  'operator cannot execute chaos': () => {
    const perms = resolvePermissions('operator');
    assert(!perms.has('execute:chaos'));
    assert(!perms.has('manage:users'));
  },

  'permission count increases with role level': () => {
    const roles = ['viewer', 'developer', 'operator', 'admin', 'superadmin'];
    let prevCount = 0;
    for (const role of roles) {
      const count = resolvePermissions(role).size;
      assert(count > prevCount, `${role} (${count}) should have more permissions than previous (${prevCount})`);
      prevCount = count;
    }
  }
};

'use strict';
/**
 * Heady™ Feature Flags — concurrent-equals feature gating with φ-rollout.
 * © 2026 HeadySystems Inc.
 */
const PHI = 1.6180339887;
const PSI = 0.6180339887;

const _flags = new Map();
const _overrides = new Map();

function register(name, opts = {}) {
  _flags.set(name, {
    name,
    enabled: opts.enabled ?? false,
    rolloutPercent: opts.rolloutPercent ?? 0,
    description: opts.description || '',
    createdAt: new Date().toISOString(),
  });
}

function isEnabled(name, context = {}) {
  const override = _overrides.get(name);
  if (override !== undefined) return override;
  const flag = _flags.get(name);
  if (!flag) return false;
  if (!flag.enabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (context.userId) {
    const hash = _simpleHash(context.userId + name);
    return (hash % 100) < flag.rolloutPercent;
  }
  return Math.random() * 100 < flag.rolloutPercent;
}

function setOverride(name, value) { _overrides.set(name, value); }
function clearOverride(name) { _overrides.delete(name); }
function listFlags() { return Array.from(_flags.values()); }

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

module.exports = { register, isEnabled, setOverride, clearOverride, listFlags };

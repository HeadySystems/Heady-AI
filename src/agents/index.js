/**
 * Agent Index — Unified export for all Heady agents
 */
'use strict';

const { HermesAgent } = require('./hermes');
const { KronosAgent, TaskState } = require('./kronos');
const { ArgusAgent, DriftSignals } = require('./argus');
const { NexusAgent } = require('./nexus');
const { HeraldAgent } = require('./herald');

module.exports = {
  HermesAgent,
  KronosAgent,
  TaskState,
  ArgusAgent,
  DriftSignals,
  NexusAgent,
  HeraldAgent
};

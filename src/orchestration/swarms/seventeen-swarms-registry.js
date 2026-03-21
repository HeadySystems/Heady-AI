/**
 * Seventeen Swarm Matrix — Heady Latent OS
 * 
 * Defines the comprehensive 17-Swarm taxonomy required by the HCFullPipeline
 * and AutoSuccess engine to achieve deterministic AI build workflows.
 * 
 * @module orchestration/swarms/seventeen-swarms-registry
 */
'use strict';

const SWARM_MATRIX = {
  // Found in audit
  RESEARCH:    'ResearchSwarm',
  CODE:        'CodeSwarm',
  SECURITY:    'SecuritySwarm',
  INTEGRATION: 'IntegrationSwarm',

  // Missing from audit - now implemented
  ANALYSIS:    'AnalysisSwarm',
  INFRA:       'InfraSwarm',
  DOCS:        'DocsSwarm',
  TEST:        'TestSwarm',
  PERFORMANCE: 'PerformanceSwarm',
  DATA:        'DataSwarm',
  MONITOR:     'MonitorSwarm',
  COMPLIANCE:  'ComplianceSwarm',
  UX:          'UXSwarm',
  ML:          'MLSwarm',
  COMMUNICATION: 'CommunicationSwarm',
  STRATEGY:    'StrategySwarm',
  EMERGENCY:   'EmergencySwarm'
};

module.exports = { SWARM_MATRIX };

/**
 * @fileoverview Pipeline Canonical — Single Canonical HCFullPipeline Definition
 *
 * Replaces 3 conflicting pipeline versions with one authoritative definition.
 * All 22 stages fully defined with phi-gated success thresholds.
 * CSL gates replace all boolean if/else.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module pipeline-canonical
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5,
};

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 34 + 8 = 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ───────────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

// ─── RESOURCE POOLS (Fibonacci allocation) ──────────────────────────────────────

const RESOURCE_POOLS = {
  HOT:        { allocation: FIB[8] / 100, description: 'User-facing, latency-critical' },
  WARM:       { allocation: FIB[7] / 100, description: 'Background processing' },
  COLD:       { allocation: FIB[6] / 100, description: 'Batch, analytics' },
  RESERVE:    { allocation: FIB[5] / 100, description: 'Burst capacity' },
  GOVERNANCE: { allocation: FIB[4] / 100, description: 'Quality + assurance' },
};

// ─── STAGE CATEGORIES ───────────────────────────────────────────────────────────

const STAGE_CATEGORY = {
  PREPARATION:  'preparation',
  EXECUTION:    'execution',
  QUALITY:      'quality',
  MONITORING:   'monitoring',
  MAINTENANCE:  'maintenance',
  INTELLIGENCE: 'intelligence',  // Stage 22 DISTILL — knowledge distillation
};

// ─── PIPELINE STAGE DEFINITIONS ─────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    index: 0,
    id: 'ContextAssembly',
    category: STAGE_CATEGORY.PREPARATION,
    description: 'Gather and assemble all context needed for pipeline execution',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'HOT',
    timeout: FIB[10] * FIB[6] * FIB[3], // 89 * 13 * 3 = 3471ms
    retries: FIB[3],
    dependsOn: [],
    parallel: false,
    phiWeight: PHI / (PHI + FIB[3]),
    actions: ['gatherUserContext', 'loadMemory', 'resolveReferences', 'buildContextWindow'],
    rollback: 'clearContextCache',
    metrics: ['contextTokens', 'assemblyLatency', 'memoryHits'],
  },
  {
    index: 1,
    id: 'IntentClassification',
    category: STAGE_CATEGORY.PREPARATION,
    description: 'Classify user intent and determine task domain',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    pool: 'HOT',
    timeout: FIB[9] * FIB[6], // 34 * 13 = 442ms
    retries: FIB[2],
    dependsOn: ['ContextAssembly'],
    parallel: false,
    phiWeight: PHI / (PHI + FIB[2]),
    actions: ['tokenize', 'embedIntent', 'classifyDomain', 'assignConfidence'],
    rollback: 'resetClassification',
    metrics: ['intentConfidence', 'classificationLatency', 'domainAccuracy'],
  },
  {
    index: 2,
    id: 'TaskDecomposition',
    category: STAGE_CATEGORY.PREPARATION,
    description: 'Decompose complex tasks into atomic subtasks',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'HOT',
    timeout: FIB[10] * FIB[5], // 89 * 8 = 712ms
    retries: FIB[2],
    dependsOn: ['IntentClassification'],
    parallel: false,
    phiWeight: PHI / (PHI + FIB[4]),
    actions: ['analyzeComplexity', 'splitSubtasks', 'buildDAG', 'estimateResources'],
    rollback: 'flattenToSingleTask',
    metrics: ['subtaskCount', 'dagDepth', 'estimatedCost'],
  },
  {
    index: 3,
    id: 'NodeSelection',
    category: STAGE_CATEGORY.PREPARATION,
    description: 'Select optimal Sacred Geometry nodes for execution',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    pool: 'HOT',
    timeout: FIB[9] * FIB[5], // 34 * 8 = 272ms
    retries: FIB[2],
    dependsOn: ['TaskDecomposition'],
    parallel: false,
    phiWeight: PHI / (PHI + FIB[3]),
    actions: ['queryNodeHealth', 'matchCapabilities', 'scoreAffinity', 'selectNodes'],
    rollback: 'fallbackToDefaultNode',
    metrics: ['nodesConsidered', 'affinityScore', 'selectionLatency'],
  },
  {
    index: 4,
    id: 'ResourceAllocation',
    category: STAGE_CATEGORY.PREPARATION,
    description: 'Allocate Fibonacci-weighted resource pools to tasks',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'WARM',
    timeout: FIB[9] * FIB[4], // 34 * 5 = 170ms
    retries: FIB[2],
    dependsOn: ['NodeSelection'],
    parallel: false,
    phiWeight: PSI,
    actions: ['checkPoolCapacity', 'reserveTokens', 'allocateCompute', 'setLimits'],
    rollback: 'releaseAllReservations',
    metrics: ['tokensReserved', 'poolUtilization', 'allocationLatency'],
  },
  {
    index: 5,
    id: 'Execution',
    category: STAGE_CATEGORY.EXECUTION,
    description: 'Execute task through selected nodes with allocated resources',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    pool: 'HOT',
    timeout: FIB[12] * FIB[7], // 233 * 21 = 4893ms
    retries: FIB[3],
    dependsOn: ['ResourceAllocation'],
    parallel: true,
    phiWeight: PHI,
    actions: ['dispatchToNodes', 'executeSubtasks', 'collectResults', 'mergeOutputs'],
    rollback: 'abortAllExecutions',
    metrics: ['executionTime', 'nodeUtilization', 'outputTokens', 'errorRate'],
  },
  {
    index: 6,
    id: 'QualityGate',
    category: STAGE_CATEGORY.QUALITY,
    description: 'Validate output quality against phi-derived thresholds',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    pool: 'GOVERNANCE',
    timeout: FIB[10] * FIB[4], // 89 * 5 = 445ms
    retries: FIB[2],
    dependsOn: ['Execution'],
    parallel: false,
    phiWeight: PHI / (PHI + 1),
    actions: ['scoreCoherence', 'checkCompleteness', 'validateFormat', 'computeQualityCSL'],
    rollback: 'requestReExecution',
    metrics: ['qualityScore', 'coherenceCSL', 'completenessRatio'],
  },
  {
    index: 7,
    id: 'AssuranceGate',
    category: STAGE_CATEGORY.QUALITY,
    description: 'HeadyAssure verification — second-opinion quality check',
    cslThreshold: CSL_THRESHOLDS.CRITICAL,
    pool: 'GOVERNANCE',
    timeout: FIB[10] * FIB[5], // 89 * 8 = 712ms
    retries: FIB[1],
    dependsOn: ['QualityGate'],
    parallel: false,
    phiWeight: PHI / (PHI + FIB[2]),
    actions: ['crossValidate', 'runAssuranceChecks', 'compareBaseline', 'signOffOrReject'],
    rollback: 'escalateToManualReview',
    metrics: ['assuranceCSL', 'baselineDelta', 'rejectionRate'],
  },
  {
    index: 8,
    id: 'SecurityScan',
    category: STAGE_CATEGORY.QUALITY,
    description: 'Scan output for security vulnerabilities and injection attacks',
    cslThreshold: CSL_THRESHOLDS.CRITICAL,
    pool: 'GOVERNANCE',
    timeout: FIB[10] * FIB[6], // 89 * 13 = 1157ms
    retries: FIB[1],
    dependsOn: ['Execution'],
    parallel: true,
    phiWeight: PHI / (PHI + 1),
    actions: ['scanInjection', 'checkDataLeakage', 'validateSandbox', 'auditPermissions'],
    rollback: 'quarantineOutput',
    metrics: ['vulnerabilitiesFound', 'scanLatency', 'threatLevel'],
  },
  {
    index: 9,
    id: 'PerformanceCheck',
    category: STAGE_CATEGORY.QUALITY,
    description: 'Evaluate execution performance against phi-derived SLOs',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'GOVERNANCE',
    timeout: FIB[8] * FIB[5], // 34 * 8 = 272ms
    retries: FIB[1],
    dependsOn: ['Execution'],
    parallel: true,
    phiWeight: PSI,
    actions: ['measureLatency', 'checkTokenBudget', 'evaluateThroughput', 'recordBaseline'],
    rollback: 'logPerformanceAnomaly',
    metrics: ['p50Latency', 'p99Latency', 'tokenEfficiency', 'sloCompliance'],
  },
  {
    index: 10,
    id: 'PatternCapture',
    category: STAGE_CATEGORY.MONITORING,
    description: 'Capture execution patterns for self-improvement via HeadyPatterns',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[10] * FIB[4], // 89 * 5 = 445ms
    retries: FIB[1],
    dependsOn: ['QualityGate', 'SecurityScan', 'PerformanceCheck'],
    parallel: true,
    phiWeight: PSI2,
    actions: ['extractPatterns', 'classifyPattern', 'updatePatternStore', 'computeTrends'],
    rollback: 'skipPatternCapture',
    metrics: ['patternsFound', 'noveltyScore', 'storeSize'],
  },
  {
    index: 11,
    id: 'StoryUpdate',
    category: STAGE_CATEGORY.MONITORING,
    description: 'Update the living story / narrative of system evolution',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[9] * FIB[5], // 34 * 8 = 272ms
    retries: FIB[1],
    dependsOn: ['PatternCapture'],
    parallel: true,
    phiWeight: PSI2,
    actions: ['summarizeExecution', 'updateNarrative', 'linkToPatterns', 'archiveChapter'],
    rollback: 'deferStoryUpdate',
    metrics: ['narrativeLength', 'chapterCount', 'linkDensity'],
  },
  {
    index: 12,
    id: 'BudgetReconcile',
    category: STAGE_CATEGORY.MONITORING,
    description: 'Reconcile token and compute budgets after execution',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'WARM',
    timeout: FIB[8] * FIB[4], // 34 * 5 = 170ms
    retries: FIB[1],
    dependsOn: ['Execution'],
    parallel: true,
    phiWeight: PSI,
    actions: ['tallyTokens', 'reconcileCompute', 'updateBudgetLedger', 'alertOverruns'],
    rollback: 'freezeBudget',
    metrics: ['tokensUsed', 'budgetRemaining', 'overrunAmount'],
  },
  {
    index: 13,
    id: 'CoherenceCheck',
    category: STAGE_CATEGORY.MONITORING,
    description: 'Verify output coherence with system state and prior context',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    pool: 'WARM',
    timeout: FIB[9] * FIB[6], // 34 * 13 = 442ms
    retries: FIB[2],
    dependsOn: ['AssuranceGate'],
    parallel: false,
    phiWeight: PHI / PHI2,
    actions: ['compareWithContext', 'checkConsistency', 'scoreCoherence', 'flagContradictions'],
    rollback: 'requestClarification',
    metrics: ['coherenceCSL', 'contradictionCount', 'consistencyScore'],
  },
  {
    index: 14,
    id: 'DriftScan',
    category: STAGE_CATEGORY.MONITORING,
    description: 'Detect drift from baseline behavior and expected patterns',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'COLD',
    timeout: FIB[10] * FIB[4], // 89 * 5 = 445ms
    retries: FIB[1],
    dependsOn: ['CoherenceCheck'],
    parallel: true,
    phiWeight: PSI2,
    actions: ['computeDriftVector', 'compareBaseline', 'classifyDrift', 'triggerAlertIfNeeded'],
    rollback: 'logDriftAnomaly',
    metrics: ['driftMagnitude', 'driftDirection', 'baselineAge'],
  },
  {
    index: 15,
    id: 'MetricsPublish',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Publish all collected metrics to monitoring infrastructure',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[9] * FIB[4], // 34 * 5 = 170ms
    retries: FIB[2],
    dependsOn: ['PatternCapture', 'BudgetReconcile', 'DriftScan'],
    parallel: true,
    phiWeight: PSI3,
    actions: ['aggregateMetrics', 'formatForExport', 'publishToMonitoring', 'updateDashboard'],
    rollback: 'bufferMetricsLocally',
    metrics: ['metricsPublished', 'publishLatency', 'bufferSize'],
  },
  {
    index: 16,
    id: 'CacheWarm',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Pre-warm caches with likely next-request patterns',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[10] * FIB[3], // 89 * 3 = 267ms
    retries: FIB[1],
    dependsOn: ['PatternCapture'],
    parallel: true,
    phiWeight: PSI3,
    actions: ['predictNextPatterns', 'selectCacheTargets', 'warmCacheLayers', 'evictStale'],
    rollback: 'skipCacheWarm',
    metrics: ['cacheHitRate', 'warmTargets', 'evictions'],
  },
  {
    index: 17,
    id: 'IndexUpdate',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Update search indexes with new execution artifacts',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[10] * FIB[4], // 89 * 5 = 445ms
    retries: FIB[2],
    dependsOn: ['StoryUpdate'],
    parallel: true,
    phiWeight: PSI3,
    actions: ['extractIndexTerms', 'updateVectorIndex', 'updateGraphIndex', 'rebuildRanking'],
    rollback: 'deferIndexUpdate',
    metrics: ['documentsIndexed', 'indexLatency', 'indexSize'],
  },
  {
    index: 18,
    id: 'NotifyStakeholders',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Send notifications to relevant stakeholders about execution results',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[9] * FIB[5], // 34 * 8 = 272ms
    retries: FIB[3],
    dependsOn: ['CoherenceCheck', 'MetricsPublish'],
    parallel: true,
    phiWeight: PSI3,
    actions: ['identifyStakeholders', 'formatNotification', 'routeByPreference', 'confirmDelivery'],
    rollback: 'queueNotificationRetry',
    metrics: ['notificationsSent', 'deliveryRate', 'deliveryLatency'],
  },
  {
    index: 19,
    id: 'ArchiveArtifacts',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Archive execution artifacts to cold storage',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[10] * FIB[5], // 89 * 8 = 712ms
    retries: FIB[2],
    dependsOn: ['MetricsPublish', 'IndexUpdate'],
    parallel: true,
    phiWeight: PSI3,
    actions: ['packageArtifacts', 'computeHash', 'uploadToArchive', 'updateManifest'],
    rollback: 'retainInHotStorage',
    metrics: ['artifactsArchived', 'archiveSize', 'hashVerified'],
  },
  {
    index: 20,
    id: 'SelfHealCheck',
    category: STAGE_CATEGORY.MAINTENANCE,
    description: 'Final self-healing assessment — check system health post-execution',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    pool: 'GOVERNANCE',
    timeout: FIB[10] * FIB[4], // 89 * 5 = 445ms
    retries: FIB[1],
    dependsOn: ['ArchiveArtifacts', 'NotifyStakeholders'],
    parallel: false,
    phiWeight: PHI / PHI2,
    actions: ['checkSystemHealth', 'evaluateResourceState', 'detectDegradation', 'triggerHealingIfNeeded'],
    rollback: 'escalateToOperator',
    metrics: ['healthScore', 'degradationLevel', 'healingActions'],
  },
  // ── Stage 22 (index 21) — DISTILL — Knowledge Distillation ──────────────────
  // Compresses execution traces into reusable recipes, knowledge facts,
  // and ancestral wisdom. Non-blocking intelligence capture.
  {
    index: 21,
    id: 'Distill',
    category: STAGE_CATEGORY.INTELLIGENCE,
    description: 'Compress execution trace into reusable recipes, knowledge facts, and ancestral wisdom',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool: 'COLD',
    timeout: FIB[10] * FIB[6],   // 89 * 13 = 1157ms
    retries: FIB[2],             // 2
    dependsOn: ['SelfHealCheck'],
    parallel: false,
    phiWeight: PSI2,
    actions: ['collectTrace', 'filterTrajectories', 'classifyRecipe', 'storeRecipe', 'compressKnowledge', 'crystallizeWisdom'],
    rollback: 'skipDistillation',
    metrics: ['recipesDistilled', 'factsCompressed', 'wisdomCrystallized', 'tokenReduction', 'distillLatency'],
  },
];

// ─── STAGE INDEX MAP ────────────────────────────────────────────────────────────

const STAGE_MAP = new Map();
for (const stage of PIPELINE_STAGES) {
  STAGE_MAP.set(stage.id, stage);
}

// ─── DEPENDENCY GRAPH ───────────────────────────────────────────────────────────

function buildDependencyGraph() {
  const graph = new Map();
  const inDegree = new Map();

  for (const stage of PIPELINE_STAGES) {
    graph.set(stage.id, []);
    inDegree.set(stage.id, stage.dependsOn.length);
  }

  for (const stage of PIPELINE_STAGES) {
    for (const dep of stage.dependsOn) {
      const edges = graph.get(dep) || [];
      edges.push(stage.id);
      graph.set(dep, edges);
    }
  }

  return { graph, inDegree };
}

function topologicalOrder() {
  const { graph, inDegree } = buildDependencyGraph();
  const order = [];
  const queue = [];

  for (const [id, deg] of inDegree) {
    const gate = cslGate(deg === 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW, CSL_THRESHOLDS.MEDIUM);
    gate.signal === 'PASS' && queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);
    for (const neighbor of (graph.get(current) || [])) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      const gate = cslGate(newDeg === 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW, CSL_THRESHOLDS.MEDIUM);
      gate.signal === 'PASS' && queue.push(neighbor);
    }
  }

  return order;
}

// ─── PARALLEL EXECUTION GROUPS ──────────────────────────────────────────────────

function computeExecutionLevels() {
  const { graph, inDegree } = buildDependencyGraph();
  const levels = [];
  const remaining = new Map(inDegree);
  const completed = new Set();

  while (completed.size < PIPELINE_STAGES.length) {
    const currentLevel = [];
    for (const [id, deg] of remaining) {
      const gate = cslGate(
        deg === 0 && !completed.has(id) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      gate.signal === 'PASS' && currentLevel.push(id);
    }

    const gateEmpty = cslGate(
      currentLevel.length === 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gateEmpty.signal === 'PASS') break;

    levels.push(currentLevel);
    for (const id of currentLevel) {
      completed.add(id);
      remaining.delete(id);
      for (const neighbor of (graph.get(id) || [])) {
        remaining.set(neighbor, (remaining.get(neighbor) || 1) - 1);
      }
    }
  }

  return levels;
}

// ─── PIPELINE VALIDATION ────────────────────────────────────────────────────────

function validatePipeline() {
  const errors = [];
  const stageIds = new Set(PIPELINE_STAGES.map(s => s.id));

  for (const stage of PIPELINE_STAGES) {
    for (const dep of stage.dependsOn) {
      const gate = cslGate(
        stageIds.has(dep) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      gate.signal === 'FAIL' && errors.push(`${stage.id} depends on unknown stage: ${dep}`);
    }

    const thresholdGate = cslGate(stage.cslThreshold, CSL_THRESHOLDS.MINIMUM);
    thresholdGate.signal === 'FAIL' && errors.push(`${stage.id} has threshold below MINIMUM`);
  }

  const totalStages = FIB[7] + 1; // 22 — includes Stage 22 DISTILL
  const countGate = cslGate(
    PIPELINE_STAGES.length === totalStages ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.HIGH
  );
  countGate.signal === 'FAIL' && errors.push(`Expected ${totalStages} stages, got ${PIPELINE_STAGES.length}`);

  const order = topologicalOrder();
  const cycleGate = cslGate(
    order.length === PIPELINE_STAGES.length ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.HIGH
  );
  cycleGate.signal === 'FAIL' && errors.push('Dependency cycle detected in pipeline');

  const overallConfidence = errors.length === 0
    ? CSL_THRESHOLDS.CRITICAL
    : CSL_THRESHOLDS.MINIMUM * Math.pow(PSI, errors.length);

  return {
    valid: cslGate(overallConfidence, CSL_THRESHOLDS.MEDIUM).signal === 'PASS',
    confidence: overallConfidence,
    stageCount: PIPELINE_STAGES.length,
    expectedCount: totalStages,
    errors,
    executionLevels: computeExecutionLevels(),
    topologicalOrder: order,
    founder: 'Eric Haywood',
  };
}

// ─── PIPELINE QUERY HELPERS ─────────────────────────────────────────────────────

function getStage(id) {
  return STAGE_MAP.get(id) || null;
}

function getStagesByCategory(category) {
  return PIPELINE_STAGES.filter(s => {
    const gate = cslGate(
      s.category === category ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    return gate.signal === 'PASS';
  });
}

function getStagesByPool(pool) {
  return PIPELINE_STAGES.filter(s => {
    const gate = cslGate(
      s.pool === pool ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    return gate.signal === 'PASS';
  });
}

function getCriticalPath() {
  const levels = computeExecutionLevels();
  const criticalStages = [];
  for (const level of levels) {
    let maxWeight = -Infinity;
    let heaviest = null;
    for (const id of level) {
      const stage = STAGE_MAP.get(id);
      const gate = cslGate(
        stage.phiWeight > maxWeight ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      if (gate.signal === 'PASS') {
        maxWeight = stage.phiWeight;
        heaviest = stage;
      }
    }
    heaviest && criticalStages.push(heaviest);
  }
  return criticalStages;
}

function getPipelineSummary() {
  const categories = {};
  for (const cat of Object.values(STAGE_CATEGORY)) {
    categories[cat] = getStagesByCategory(cat).length;
  }

  const pools = {};
  for (const pool of Object.keys(RESOURCE_POOLS)) {
    pools[pool] = getStagesByPool(pool).length;
  }

  const totalTimeout = PIPELINE_STAGES.reduce((sum, s) => sum + s.timeout, 0);
  const avgThreshold = PIPELINE_STAGES.reduce((sum, s) => sum + s.cslThreshold, 0) / PIPELINE_STAGES.length;

  return {
    totalStages: PIPELINE_STAGES.length,
    categories,
    pools,
    totalTimeoutBudget: totalTimeout,
    averageCSLThreshold: avgThreshold,
    executionLevels: computeExecutionLevels().length,
    criticalPathLength: getCriticalPath().length,
    founder: 'Eric Haywood',
  };
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default PIPELINE_STAGES;

export {
  PIPELINE_STAGES,
  STAGE_MAP,
  STAGE_CATEGORY,
  RESOURCE_POOLS,
  CSL_THRESHOLDS,
  PHI, PSI, PSI2, PSI3,
  FIB,
  DETERMINISTIC_SEED,
  DETERMINISTIC_TEMP,
  cslGate,
  phiThreshold,
  buildDependencyGraph,
  topologicalOrder,
  computeExecutionLevels,
  validatePipeline,
  getStage,
  getStagesByCategory,
  getStagesByPool,
  getCriticalPath,
  getPipelineSummary,
};

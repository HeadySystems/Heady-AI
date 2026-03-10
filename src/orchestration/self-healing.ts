/**
 * Heady™ Self-Healing Lifecycle v5.0.0
 * State machine, drift detection, quarantine, respawn, attestation
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, phiBackoff, TIMING } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('self-healing');

// ═══ Types ═══
export type ComponentState = 'healthy' | 'suspect' | 'quarantined' | 'recovering' | 'restored' | 'dead';
export type ComponentType = 'service' | 'worker' | 'agent' | 'tool' | 'provider' | 'runtime';

export interface HealableComponent {
  id: string;
  name: string;
  type: ComponentType;
  state: ComponentState;
  embedding: number[] | null;
  baselineEmbedding: number[] | null;
  coherenceScore: number;
  failureCount: number;
  lastStateChange: string;
  lastHeartbeat: string;
  quarantineReason: string | null;
  recoveryAttempts: number;
  metadata: Record<string, unknown>;
}

export interface HealingAction {
  componentId: string;
  action: 'retry' | 'respawn' | 'rollback' | 'escalate';
  reason: string;
  timestamp: string;
  success: boolean;
}

export interface DriftReport {
  componentId: string;
  currentCoherence: number;
  threshold: number;
  driftMagnitude: number;
  direction: 'degrading' | 'recovering' | 'stable';
  detectedAt: string;
}

// ═══ State ═══
const components = new Map<string, HealableComponent>();
const healingLog: HealingAction[] = [];
const driftHistory = new Map<string, DriftReport[]>();

// ═══ Drift Thresholds ═══
const DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;          // 0.809 — moderate alignment required
const QUARANTINE_THRESHOLD = CSL_THRESHOLDS.LOW;         // 0.691 — below this = quarantine
const DEAD_THRESHOLD = CSL_THRESHOLDS.MINIMUM;           // 0.500 — below this = dead
const MAX_RECOVERY_ATTEMPTS = FIB[5];                     // 5

// ═══ Register Component ═══
export function registerComponent(
  id: string,
  name: string,
  type: ComponentType,
  baselineEmbedding: number[] | null = null,
): HealableComponent {
  const now = new Date().toISOString();
  const component: HealableComponent = {
    id, name, type,
    state: 'healthy',
    embedding: baselineEmbedding ? [...baselineEmbedding] : null,
    baselineEmbedding,
    coherenceScore: 1.0,
    failureCount: 0,
    lastStateChange: now,
    lastHeartbeat: now,
    quarantineReason: null,
    recoveryAttempts: 0,
    metadata: {},
  };

  components.set(id, component);
  logger.info('Component registered', { id, name, type });
  return component;
}

// ═══ Heartbeat + Drift Detection ═══
export function heartbeat(id: string, currentEmbedding: number[] | null = null): DriftReport | null {
  const component = components.get(id);
  if (!component) return null;

  component.lastHeartbeat = new Date().toISOString();

  // Compute drift if embeddings available
  if (currentEmbedding && component.baselineEmbedding) {
    component.embedding = currentEmbedding;
    const coherence = cosineSimilarity(currentEmbedding, component.baselineEmbedding);
    const previousCoherence = component.coherenceScore;
    component.coherenceScore = coherence;

    const direction = coherence > previousCoherence + 0.01 ? 'recovering'
      : coherence < previousCoherence - 0.01 ? 'degrading'
      : 'stable';

    const driftReport: DriftReport = {
      componentId: id,
      currentCoherence: coherence,
      threshold: DRIFT_THRESHOLD,
      driftMagnitude: Math.abs(1.0 - coherence),
      direction,
      detectedAt: new Date().toISOString(),
    };

    // Store drift history
    if (!driftHistory.has(id)) driftHistory.set(id, []);
    const history = driftHistory.get(id);
    if (history) {
      history.push(driftReport);
      // Keep last FIB[9] entries (34)
      while (history.length > FIB[9]) history.shift();
    }

    // State transitions based on coherence
    if (coherence < DEAD_THRESHOLD && component.state !== 'dead') {
      transitionState(component, 'dead', `Coherence dropped below DEAD threshold (${coherence.toFixed(3)} < ${DEAD_THRESHOLD.toFixed(3)})`);
    } else if (coherence < QUARANTINE_THRESHOLD && component.state === 'healthy') {
      transitionState(component, 'suspect', `Coherence below quarantine threshold (${coherence.toFixed(3)} < ${QUARANTINE_THRESHOLD.toFixed(3)})`);
    } else if (coherence < DRIFT_THRESHOLD && component.state === 'healthy') {
      transitionState(component, 'suspect', `Drift detected (${coherence.toFixed(3)} < ${DRIFT_THRESHOLD.toFixed(3)})`);
    } else if (coherence >= DRIFT_THRESHOLD && component.state === 'suspect') {
      transitionState(component, 'healthy', `Coherence recovered (${coherence.toFixed(3)} >= ${DRIFT_THRESHOLD.toFixed(3)})`);
    }

    return driftReport;
  }

  return null;
}

// ═══ State Transitions ═══
function transitionState(component: HealableComponent, newState: ComponentState, reason: string): void {
  const oldState = component.state;
  component.state = newState;
  component.lastStateChange = new Date().toISOString();

  if (newState === 'quarantined') {
    component.quarantineReason = reason;
  }

  logger.warn('Component state transition', {
    id: component.id,
    name: component.name,
    from: oldState,
    to: newState,
    reason,
    coherence: component.coherenceScore,
  });
}

// ═══ Quarantine ═══
export function quarantine(id: string, reason: string): boolean {
  const component = components.get(id);
  if (!component) return false;

  transitionState(component, 'quarantined', reason);
  return true;
}

// ═══ Recovery ═══
export async function attemptRecovery(id: string): Promise<HealingAction> {
  const component = components.get(id);
  if (!component) throw new Error(`HEADY-7001: Unknown component ${id}`);

  if (component.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    const action: HealingAction = {
      componentId: id,
      action: 'escalate',
      reason: `Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) exceeded`,
      timestamp: new Date().toISOString(),
      success: false,
    };
    healingLog.push(action);
    transitionState(component, 'dead', 'Recovery exhausted');
    return action;
  }

  component.recoveryAttempts++;
  transitionState(component, 'recovering', `Recovery attempt ${component.recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);

  // φ-backoff between recovery attempts
  const backoffMs = phiBackoff(component.recoveryAttempts);
  await new Promise(resolve => setTimeout(resolve, Math.min(backoffMs, FIB[9] * 1000)));

  // Determine recovery strategy
  const strategy = component.recoveryAttempts <= FIB[2] ? 'retry'
    : component.recoveryAttempts <= FIB[4] ? 'respawn'
    : 'rollback';

  const action: HealingAction = {
    componentId: id,
    action: strategy,
    reason: `Recovery attempt ${component.recoveryAttempts} via ${strategy}`,
    timestamp: new Date().toISOString(),
    success: false, // Will be updated by caller
  };

  healingLog.push(action);
  logger.info('Recovery attempted', { id: component.id, strategy, attempt: component.recoveryAttempts });

  return action;
}

// ═══ Attestation (confirm recovery) ═══
export function attest(id: string, newEmbedding: number[] | null = null): boolean {
  const component = components.get(id);
  if (!component) return false;

  if (newEmbedding && component.baselineEmbedding) {
    const coherence = cosineSimilarity(newEmbedding, component.baselineEmbedding);
    component.coherenceScore = coherence;
    component.embedding = newEmbedding;

    if (coherence >= DRIFT_THRESHOLD) {
      transitionState(component, 'restored', `Attestation passed (coherence: ${coherence.toFixed(3)})`);
      component.failureCount = 0;
      component.recoveryAttempts = 0;
      component.quarantineReason = null;

      // Promote to healthy after successful attestation
      setTimeout(() => {
        if (component.state === 'restored') {
          transitionState(component, 'healthy', 'Post-attestation promotion');
        }
      }, TIMING.HEARTBEAT_MS);

      return true;
    } else {
      logger.warn('Attestation failed', { id, coherence, threshold: DRIFT_THRESHOLD });
      return false;
    }
  }

  // If no embedding, trust-based attestation
  transitionState(component, 'restored', 'Trust-based attestation');
  component.recoveryAttempts = 0;
  return true;
}

// ═══ Record Failure ═══
export function recordComponentFailure(id: string): void {
  const component = components.get(id);
  if (!component) return;

  component.failureCount++;
  component.coherenceScore = Math.max(0, component.coherenceScore - Math.pow(PSI, 3));

  if (component.failureCount >= FIB[4]) { // 3 failures = suspect
    if (component.state === 'healthy') {
      transitionState(component, 'suspect', `Failure count ${component.failureCount} >= ${FIB[4]}`);
    }
  }

  if (component.failureCount >= FIB[5]) { // 5 failures = quarantine
    quarantine(id, `Failure count ${component.failureCount} >= ${FIB[5]}`);
  }
}

// ═══ Stale Detection ═══
export function detectStaleComponents(): HealableComponent[] {
  const now = Date.now();
  const staleThreshold = TIMING.HEARTBEAT_MS * FIB[3]; // 102s
  const stale: HealableComponent[] = [];

  for (const component of components.values()) {
    if (component.state === 'dead') continue;
    const lastHB = new Date(component.lastHeartbeat).getTime();
    if (now - lastHB > staleThreshold) {
      transitionState(component, 'suspect', `No heartbeat for ${Math.round((now - lastHB) / 1000)}s`);
      stale.push(component);
    }
  }

  return stale;
}

// ═══ Get Component ═══
export function getComponent(id: string): HealableComponent | undefined {
  return components.get(id);
}

// ═══ Get All Components ═══
export function getAllComponents(): HealableComponent[] {
  return Array.from(components.values());
}

// ═══ Healing Log ═══
export function getHealingLog(limit: number = FIB[8]): HealingAction[] {
  return healingLog.slice(-limit);
}

// ═══ Drift History ═══
export function getDriftHistory(componentId: string): DriftReport[] {
  return driftHistory.get(componentId) || [];
}

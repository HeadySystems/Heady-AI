// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: tests/core/circuit-breaker.test.js                                                    ║
// ║  LAYER: tests                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../../src/core/circuit-breaker.js';

const mockLog = { info: vi.fn(), warn: vi.fn() };

describe('CircuitBreaker', () => {
  it('should start CLOSED', () => {
    const cb = new CircuitBreaker({ log: mockLog });
    expect(cb.isOpen('test-service')).toBe(false);
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker({ log: mockLog });
    for (let i = 0; i < 5; i++) cb.recordFailure('flaky');
    expect(cb.isOpen('flaky')).toBe(true);
  });

  it('should close on success', () => {
    const cb = new CircuitBreaker({ log: mockLog });
    for (let i = 0; i < 5; i++) cb.recordFailure('flaky');
    // Simulate time passing for half-open transition
    cb.recordSuccess('flaky');
    expect(cb.status().flaky.state).toBe('CLOSED');
  });
});

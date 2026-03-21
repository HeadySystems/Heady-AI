/**
 * Vitest global setup — provides jest API compatibility.
 * Many test files use `jest.fn()`, `jest.spyOn()`, etc.
 * Vitest provides `vi` as the equivalent; this shim maps jest → vi.
 */
import { vi } from 'vitest';

// Make jest available globally as an alias for vi
globalThis.jest = vi;

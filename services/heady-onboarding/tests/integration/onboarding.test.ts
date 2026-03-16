import { describe, it, expect } from '@jest/globals'
import {
  validateStageData,
  getNextStage,
  getStage,
  calculateProgress,
  ONBOARDING_STAGES,
  EmailMode,
  RuntimeMode,
} from '../../src/lib/onboarding-stages'

// ── Stage Definitions ───────────────────────────────────

describe('ONBOARDING_STAGES', () => {
  it('should define exactly 5 stages in order', () => {
    expect(ONBOARDING_STAGES).toHaveLength(5)
    expect(ONBOARDING_STAGES.map(s => s.id)).toEqual([
      'create-account',
      'email-config',
      'permissions',
      'buddy-setup',
      'complete',
    ])
  })

  it('should have sequential indices', () => {
    ONBOARDING_STAGES.forEach((stage, i) => {
      expect(stage.index).toBe(i)
    })
  })

  it('should only allow going back on stages 1-3', () => {
    expect(ONBOARDING_STAGES[0].canGoBack).toBe(false)  // create-account
    expect(ONBOARDING_STAGES[1].canGoBack).toBe(true)   // email-config
    expect(ONBOARDING_STAGES[2].canGoBack).toBe(true)   // permissions
    expect(ONBOARDING_STAGES[3].canGoBack).toBe(true)   // buddy-setup
    expect(ONBOARDING_STAGES[4].canGoBack).toBe(false)  // complete
  })
})

// ── Stage Validation ────────────────────────────────────

describe('validateStageData', () => {
  it('should validate create-account with username', () => {
    const result = validateStageData('create-account', { username: 'testuser' })
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('should reject create-account without username', () => {
    const result = validateStageData('create-account', {})
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('username')
  })

  it('should reject create-account with empty username', () => {
    const result = validateStageData('create-account', { username: '  ' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('username')
  })

  it('should validate email-config with only emailMode (secure-client)', () => {
    const result = validateStageData('email-config', {
      emailMode: EmailMode.SECURE_CLIENT,
    })
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('should validate email-config with forward mode and forwardTo', () => {
    const result = validateStageData('email-config', {
      emailMode: EmailMode.FORWARD_CUSTOM,
      forwardTo: 'user@example.com',
    })
    expect(result.valid).toBe(true)
  })

  it('should NOT require forwardTo at the stage level (API handles it)', () => {
    // forwardTo validation is conditional in the API route, not in requiredFields
    const result = validateStageData('email-config', {
      emailMode: EmailMode.FORWARD_PROVIDER,
    })
    expect(result.valid).toBe(true)
  })

  it('should validate permissions with runtimeMode', () => {
    const result = validateStageData('permissions', {
      runtimeMode: RuntimeMode.CLOUD_ONLY,
    })
    expect(result.valid).toBe(true)
  })

  it('should reject permissions without runtimeMode', () => {
    const result = validateStageData('permissions', {})
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('runtimeMode')
  })

  it('should validate buddy-setup with required fields', () => {
    const result = validateStageData('buddy-setup', {
      buddyName: 'Buddy',
      theme: 'sacred-geometry',
    })
    expect(result.valid).toBe(true)
  })

  it('should reject buddy-setup without buddyName', () => {
    const result = validateStageData('buddy-setup', { theme: 'midnight' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('buddyName')
  })

  it('should reject buddy-setup without theme', () => {
    const result = validateStageData('buddy-setup', { buddyName: 'Buddy' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('theme')
  })

  it('should validate complete with no required fields', () => {
    const result = validateStageData('complete', {})
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('should reject unknown stage', () => {
    const result = validateStageData('nonexistent', { foo: 'bar' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('UNKNOWN_STAGE')
  })
})

// ── Stage Progression ───────────────────────────────────

describe('getNextStage', () => {
  it('should advance create-account → email-config', () => {
    const next = getNextStage('create-account')
    expect(next?.id).toBe('email-config')
  })

  it('should advance email-config → permissions', () => {
    const next = getNextStage('email-config')
    expect(next?.id).toBe('permissions')
  })

  it('should advance permissions → buddy-setup', () => {
    const next = getNextStage('permissions')
    expect(next?.id).toBe('buddy-setup')
  })

  it('should advance buddy-setup → complete', () => {
    const next = getNextStage('buddy-setup')
    expect(next?.id).toBe('complete')
  })

  it('should return null after complete (final stage)', () => {
    const next = getNextStage('complete')
    expect(next).toBeNull()
  })

  it('should return null for unknown stage', () => {
    const next = getNextStage('nonexistent')
    expect(next).toBeNull()
  })
})

describe('getStage', () => {
  it('should find stage by id', () => {
    const stage = getStage('buddy-setup')
    expect(stage).not.toBeNull()
    expect(stage?.title).toBe('Customize HeadyBuddy')
    expect(stage?.index).toBe(3)
  })

  it('should return null for unknown id', () => {
    expect(getStage('invalid')).toBeNull()
  })
})

// ── Progress Calculation ────────────────────────────────

describe('calculateProgress', () => {
  it('should return 0-100 range', () => {
    for (let i = 0; i < ONBOARDING_STAGES.length; i++) {
      const progress = calculateProgress(i)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(100)
    }
  })

  it('should increase monotonically', () => {
    let prev = -1
    for (let i = 0; i < ONBOARDING_STAGES.length; i++) {
      const progress = calculateProgress(i)
      expect(progress).toBeGreaterThan(prev)
      prev = progress
    }
  })

  it('should return 100 at the last stage', () => {
    const progress = calculateProgress(ONBOARDING_STAGES.length - 1)
    expect(progress).toBe(100)
  })

  it('should use phi-weighting (first stage > 20% linear)', () => {
    // Linear would be 20% for stage 0 (1/5), phi-weighted should be higher
    const progress = calculateProgress(0)
    expect(progress).toBeGreaterThan(20)
  })
})

// ── Username Validation (regex from API route) ──────────

describe('Username validation', () => {
  const usernameRegex = /^[a-z0-9][a-z0-9._-]{2,29}$/

  it('should accept valid usernames', () => {
    expect(usernameRegex.test('eric')).toBe(true)
    expect(usernameRegex.test('heady-user')).toBe(true)
    expect(usernameRegex.test('test.user.name')).toBe(true)
    expect(usernameRegex.test('user_123')).toBe(true)
    expect(usernameRegex.test('abc')).toBe(true)  // min 3 chars
  })

  it('should reject usernames starting with special char', () => {
    expect(usernameRegex.test('.hidden')).toBe(false)
    expect(usernameRegex.test('-dash')).toBe(false)
    expect(usernameRegex.test('_under')).toBe(false)
  })

  it('should reject too-short usernames', () => {
    expect(usernameRegex.test('ab')).toBe(false)
    expect(usernameRegex.test('a')).toBe(false)
  })

  it('should reject uppercase', () => {
    expect(usernameRegex.test('UPPER')).toBe(false)
    expect(usernameRegex.test('Mixed')).toBe(false)
  })

  it('should reject spaces and special chars', () => {
    expect(usernameRegex.test('has space')).toBe(false)
    expect(usernameRegex.test('has@symbol')).toBe(false)
    expect(usernameRegex.test('has!bang')).toBe(false)
  })
})

/**
 * @file onboarding-adapter.js
 * @description CJS adapter for the Heady onboarding flow.
 *   Provides Express routes that mirror the ESM onboarding-routes.js API
 *   using in-memory state (falls back gracefully when Redis is unavailable).
 *
 * Mounted at /api/onboarding in heady-manager.js
 */
'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const Steps = Object.freeze({
  WELCOME:          'WELCOME',
  AUTH:             'AUTH',
  PERMISSIONS:      'PERMISSIONS',
  ACCOUNT_SETUP:    'ACCOUNT_SETUP',
  EMAIL_SETUP:      'EMAIL_SETUP',
  UI_CUSTOMIZATION: 'UI_CUSTOMIZATION',
  COMPANION_CONFIG: 'COMPANION_CONFIG',
  COMPLETE:         'COMPLETE',
});

const STEP_ORDER = [
  Steps.WELCOME,
  Steps.AUTH,
  Steps.PERMISSIONS,
  Steps.ACCOUNT_SETUP,
  Steps.EMAIL_SETUP,
  Steps.UI_CUSTOMIZATION,
  Steps.COMPANION_CONFIG,
  Steps.COMPLETE,
];

const SKIPPABLE_STEPS = new Set([
  Steps.EMAIL_SETUP,
  Steps.COMPANION_CONFIG,
]);

const STEP_PREREQUISITES = new Map([
  [Steps.PERMISSIONS,      Steps.AUTH],
  [Steps.ACCOUNT_SETUP,    Steps.PERMISSIONS],
  [Steps.EMAIL_SETUP,      Steps.ACCOUNT_SETUP],
  [Steps.UI_CUSTOMIZATION, Steps.ACCOUNT_SETUP],
  [Steps.COMPANION_CONFIG, Steps.UI_CUSTOMIZATION],
  [Steps.COMPLETE,         Steps.COMPANION_CONFIG],
]);

// In-memory progress store (production would use Redis)
const progressStore = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = () => Date.now();

const extractUserId = (req) =>
  req.user?.id || req.user?.sub || req.headers['x-heady-user-id'] || null;

function seedProgress(userId) {
  const ts = now();
  return {
    userId,
    sessionId: crypto.randomUUID(),
    currentStep:     Steps.WELCOME,
    status:          'in_progress',
    completedSteps:  {},
    skippedSteps:    {},
    stepData:        {},
    stepTimestamps:  { [Steps.WELCOME]: { entered: ts } },
    analytics:       {},
    startedAt:       ts,
    updatedAt:       ts,
    completedAt:     null,
  };
}

function resolveNextStep(progress, completedStep) {
  const currentIdx = STEP_ORDER.indexOf(completedStep);
  for (let i = currentIdx + 1; i < STEP_ORDER.length; i++) {
    const candidate = STEP_ORDER[i];
    if (progress.skippedSteps[candidate]) continue;
    return candidate;
  }
  return Steps.COMPLETE;
}

function computePercentComplete(progress) {
  if (progress.status === 'complete') return 100;
  const totalSteps = STEP_ORDER.length - 1;
  const completedCount = Object.keys(progress.completedSteps || {}).length;
  return Math.round((completedCount / totalSteps) * 100);
}

function buildNextAction(progress) {
  const stepMeta = {
    [Steps.WELCOME]:          { title: 'Welcome to HeadyBuddy', action: 'Continue to sign-in', route: '/onboarding/start' },
    [Steps.AUTH]:              { title: 'Sign In or Register', action: 'Authenticate with OAuth or email/password', route: '/auth/login' },
    [Steps.PERMISSIONS]:      { title: 'Configure Permissions', action: 'Set access levels', route: '/onboarding/permissions' },
    [Steps.ACCOUNT_SETUP]:    { title: 'Create Your Account', action: 'Choose your @headyme.com username', route: '/onboarding/account' },
    [Steps.EMAIL_SETUP]:      { title: 'Set Up Secure Email', action: 'Activate encrypted mailbox (optional)', route: '/onboarding/email-setup' },
    [Steps.UI_CUSTOMIZATION]: { title: 'Customise Your Workspace', action: 'Pick a dashboard template', route: '/onboarding/ui-config' },
    [Steps.COMPANION_CONFIG]: { title: 'Configure HeadyBuddy', action: 'Personalise your AI companion (optional)', route: '/onboarding/companion' },
    [Steps.COMPLETE]:         { title: 'All Set!', action: 'Go to your dashboard', route: '/dashboard' },
  };

  return {
    step: progress.currentStep,
    percentComplete: computePercentComplete(progress),
    ...(stepMeta[progress.currentStep] || {}),
  };
}

const success = (data, message) => ({
  success: true, message: message || null, data, timestamp: now(),
});

const failure = (error, details) => ({
  success: false, error, details: details || null, timestamp: now(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /start — Begin or resume an onboarding session
 */
router.get('/start', (req, res) => {
  const userId = extractUserId(req);
  const referrer = req.query.referrer || req.headers.referer || null;

  if (!userId) {
    return res.json(success({
      step: Steps.WELCOME,
      message: 'Welcome to HeadyBuddy! Please sign in or create an account.',
      authMethods: ['oauth_google', 'oauth_github', 'email_password'],
      headybuddyIntro: {
        greeting: "Hi! I'm HeadyBuddy, your intelligent workspace companion.",
        description: "I'll help you set up your personalised headyme.com workspace.",
        features: [
          { icon: 'brain', label: 'AI-Powered', description: 'Multi-LLM routing via Heady™Bee workers' },
          { icon: 'lock', label: 'Secure Email', description: 'End-to-end encrypted @headyme.com address' },
          { icon: 'layout', label: 'Custom UI', description: 'Sacred-Geometry-optimised dashboard layouts' },
          { icon: 'zap', label: 'HeadySwarm', description: 'Fibonacci-allocated worker swarms' },
          { icon: 'heart', label: 'Open Source', description: 'Built on HeadyConnection nonprofit values' },
        ],
        estimatedMinutes: 3,
      },
    }, 'Welcome to headyme.com'));
  }

  let progress = progressStore.get(userId);
  if (!progress || progress.status === 'complete') {
    progress = seedProgress(userId);
    progressStore.set(userId, progress);
  }

  res.json(success({
    progress,
    currentStep: progress.currentStep,
    nextAction: buildNextAction(progress),
  }, progress.status === 'complete'
    ? 'Onboarding already complete!'
    : `Resuming at step: ${progress.currentStep}`));
});

/**
 * GET /progress — Current onboarding state
 */
router.get('/progress', (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json(failure('Authentication required.'));

  const progress = progressStore.get(userId);
  if (!progress) return res.status(404).json(failure('No onboarding session found. Call /start first.'));

  res.json(success({
    progress,
    percentComplete: computePercentComplete(progress),
    nextAction: buildNextAction(progress),
  }));
});

/**
 * POST /step/:stepName — Advance past a step
 */
router.post('/step/:stepName', (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json(failure('Authentication required.'));

  const stepName = (req.params.stepName || '').toUpperCase();
  if (!Object.values(Steps).includes(stepName)) {
    return res.status(400).json(failure(`Unknown step "${req.params.stepName}".`));
  }

  let progress = progressStore.get(userId);
  if (!progress) {
    progress = seedProgress(userId);
    progressStore.set(userId, progress);
  }

  // Check prerequisite
  const prereq = STEP_PREREQUISITES.get(stepName);
  if (prereq && !progress.completedSteps[prereq]) {
    return res.status(422).json(failure(`Step "${stepName}" requires "${prereq}" to be completed first.`));
  }

  const stepData = req.body || {};
  progress.stepData[stepName] = stepData;
  progress.completedSteps[stepName] = true;
  progress.stepTimestamps[stepName] = {
    ...(progress.stepTimestamps[stepName] || {}),
    completed: now(),
  };

  const nextStep = resolveNextStep(progress, stepName);
  progress.currentStep = nextStep;
  progress.updatedAt = now();

  if (nextStep === Steps.COMPLETE) {
    progress.status = 'complete';
    progress.completedAt = now();
  }

  progressStore.set(userId, progress);

  res.json(success({
    progress,
    completedStep: stepName,
    nextStep: progress.currentStep,
    nextAction: buildNextAction(progress),
  }, `Step "${stepName}" completed successfully.`));
});

/**
 * POST /skip/:stepName — Skip an optional step
 */
router.post('/skip/:stepName', (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json(failure('Authentication required.'));

  const stepName = (req.params.stepName || '').toUpperCase();
  if (!SKIPPABLE_STEPS.has(stepName)) {
    return res.status(422).json(failure(`Step "${stepName}" cannot be skipped.`));
  }

  let progress = progressStore.get(userId);
  if (!progress) return res.status(404).json(failure('No onboarding session found.'));

  progress.skippedSteps[stepName] = true;
  progress.completedSteps[stepName] = true;
  const nextStep = resolveNextStep(progress, stepName);
  progress.currentStep = nextStep;
  progress.updatedAt = now();

  if (nextStep === Steps.COMPLETE) {
    progress.status = 'complete';
    progress.completedAt = now();
  }

  progressStore.set(userId, progress);

  res.json(success({
    progress,
    skippedStep: stepName,
    nextStep: progress.currentStep,
    nextAction: buildNextAction(progress),
  }, `Step "${stepName}" skipped.`));
});

/**
 * POST /complete — Finalise onboarding
 */
router.post('/complete', (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json(failure('Authentication required.'));

  let progress = progressStore.get(userId);
  if (!progress) return res.status(404).json(failure('No onboarding session found.'));

  progress.status = 'complete';
  progress.currentStep = Steps.COMPLETE;
  progress.completedAt = now();
  progress.updatedAt = now();
  progressStore.set(userId, progress);

  res.json(success({
    progress,
    dashboardUrl: '/dashboard',
    message: 'Welcome to HeadyBuddy! Your workspace is ready.',
  }, 'Onboarding complete!'));
});

/**
 * GET /templates — List UI templates
 */
router.get('/templates', (req, res) => {
  const templates = [
    { id: 'heady-onboarding-lite', name: 'Heady Lite', description: 'Clean, minimal dashboard', category: 'minimal', recommendedTiers: ['free', 'pro'], recommendedRoles: ['developer', 'designer'] },
    { id: 'heady-enterprise-pro', name: 'Enterprise Pro', description: 'Full-featured enterprise dashboard', category: 'enterprise', recommendedTiers: ['pro', 'enterprise'], recommendedRoles: ['admin', 'ops'] },
    { id: 'heady-sacred-geometry', name: 'Sacred Geometry', description: 'Phi-optimised sacred geometry layout', category: 'creative', recommendedTiers: ['free', 'pro', 'enterprise'], recommendedRoles: ['developer', 'creative'] },
    { id: 'heady-command-center', name: 'Command Center', description: 'Operations and monitoring focus', category: 'ops', recommendedTiers: ['pro', 'enterprise'], recommendedRoles: ['ops', 'admin'] },
  ];

  res.json(success({ templates, total: templates.length }));
});

/**
 * POST /reset — Reset onboarding (admin use)
 */
router.post('/reset', (req, res) => {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json(failure('Authentication required.'));

  progressStore.delete(userId);
  res.json(success(null, 'Onboarding reset successfully.'));
});

/**
 * GET /steps — List all onboarding steps with metadata
 */
router.get('/steps', (req, res) => {
  res.json(success({
    steps: STEP_ORDER,
    skippable: Array.from(SKIPPABLE_STEPS),
    prerequisites: Object.fromEntries(STEP_PREREQUISITES),
    total: STEP_ORDER.length,
  }));
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
router.use((err, req, res, _next) => {
  console.error('[OnboardingAdapter] Error:', err.message);
  res.status(500).json(failure('An internal error occurred. Please try again.'));
});

module.exports = router;

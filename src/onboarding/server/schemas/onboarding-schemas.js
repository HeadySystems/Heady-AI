/**
 * @file onboarding-schemas.js
 * @description Zod schemas for every onboarding endpoint — request bodies,
 *   query params, and shared enums. Zero runtime imports beyond Zod.
 *
 * Providers follow the ARCHITECTURE.md tiering:
 *   Tier 1: Firebase native (google.com, github.com, facebook.com, twitter.com, microsoft.com, apple.com)
 *   Tier 2: OIDC custom (oidc.huggingface, oidc.discord, oidc.slack, oidc.linkedin, oidc.spotify)
 *   Plus: email/phone/anonymous
 */

import { z } from 'zod';

// ─── Shared Constants ───────────────────────────────────────────────────────

/** Ordered onboarding stages — the canonical progression. */
export const ONBOARDING_STAGES = [
  'auth',
  'identity',
  'email',
  'permissions',
  'buddy',
  'complete',
];

export const OnboardingStageEnum = z.enum(/** @type {[string,...string[]]} */ (ONBOARDING_STAGES));

/** Firebase auth provider IDs — Tier 1 native + Tier 2 OIDC + email/phone/anonymous. */
export const AUTH_PROVIDERS = [
  // Tier 1: Firebase Native
  'google.com',
  'github.com',
  'facebook.com',
  'twitter.com',
  'microsoft.com',
  'apple.com',
  // Tier 2: OIDC Custom (Identity Platform)
  'oidc.huggingface',
  'oidc.discord',
  'oidc.slack',
  'oidc.linkedin',
  'oidc.spotify',
  // Standard
  'password',
  'phone',
  'anonymous',
];

export const AuthProviderEnum = z.enum(/** @type {[string,...string[]]} */ (AUTH_PROVIDERS));

/** Reserved words that cannot be used as usernames. */
export const RESERVED_USERNAMES = new Set([
  'admin', 'heady', 'headyme', 'system', 'root', 'null', 'undefined',
  'api', 'www', 'app', 'mail', 'support', 'help', 'info', 'contact',
  'billing', 'security', 'abuse', 'postmaster', 'webmaster', 'noreply',
  'bot', 'daemon', 'cron', 'operator', 'nobody', 'anonymous',
  'buddy', 'kernel', 'swarm', 'bee', 'hive', 'arena', 'distiller',
]);

/** 7 cognitive archetypes for HeadyBuddy configuration. */
export const COGNITIVE_ARCHETYPES = ['OWL', 'EAGLE', 'DOLPHIN', 'RABBIT', 'ANT', 'ELEPHANT', 'BEAVER'];

export const ArchetypeEnum = z.enum(/** @type {[string,...string[]]} */ (COGNITIVE_ARCHETYPES));

// ─── Reusable Field Schemas ─────────────────────────────────────────────────

const usernameField = z
  .string()
  .min(3)
  .max(34)
  .regex(
    /^[a-z][a-z0-9._-]{2,33}$/,
    'Username must start with a lowercase letter and contain only a-z, 0-9, dots, hyphens, underscores',
  )
  .refine((v) => !RESERVED_USERNAMES.has(v.toLowerCase()), {
    message: 'This username is reserved',
  });

const displayNameField = z
  .string()
  .min(1)
  .max(89)
  .trim();

const emailField = z
  .string()
  .email()
  .max(254);

const firebaseIdTokenField = z
  .string()
  .min(100)
  .max(4096);

// ─── Auth Callback ──────────────────────────────────────────────────────────

export const AuthCallbackBodySchema = z.object({
  idToken: firebaseIdTokenField,
  provider: AuthProviderEnum,
});

// ─── Create Identity ────────────────────────────────────────────────────────

export const CreateIdentityBodySchema = z.object({
  username: usernameField,
  displayName: displayNameField,
  password: z.string().min(8).max(128).optional(),
});

// ─── Configure Email ────────────────────────────────────────────────────────

export const ConfigureEmailBodySchema = z.object({
  /** The user's primary contact email (may differ from auth email). */
  contactEmail: emailField,
  /** Whether to provision a @headyme.com forwarding address. */
  provisionHeadyEmail: z.boolean().default(false),
  /** Optional preferred prefix for @headyme.com address. */
  headyEmailPrefix: z
    .string()
    .min(3)
    .max(34)
    .regex(/^[a-z][a-z0-9._-]+$/)
    .optional(),
});

// ─── Set Permissions ────────────────────────────────────────────────────────

export const SetPermissionsBodySchema = z.object({
  /** Cloud Only vs Hybrid mode. */
  mode: z.enum(['cloud', 'hybrid']),
  /** Device name (required for hybrid mode). */
  deviceName: z
    .string()
    .min(1)
    .max(128)
    .trim()
    .optional(),
  /** Share anonymous usage analytics. */
  analyticsOptIn: z.boolean().default(true),
  /** Allow buddy to access browsing context. */
  buddyBrowsingAccess: z.boolean().default(false),
  /** Allow buddy to execute code in sandbox. */
  buddyCodeExecution: z.boolean().default(false),
  /** Allow buddy to access connected tools. */
  buddyToolAccess: z.boolean().default(false),
  /** Preferred data residency region. */
  dataRegion: z.enum(['us-east', 'us-west', 'eu-west', 'ap-south', 'ap-northeast']).default('us-east'),
}).refine(
  (data) => data.mode !== 'hybrid' || (data.deviceName && data.deviceName.length > 0),
  { message: 'Device name is required for hybrid mode', path: ['deviceName'] },
);

// ─── Configure Buddy ────────────────────────────────────────────────────────

export const ConfigureBuddyBodySchema = z.object({
  /** Primary cognitive archetype. */
  archetype: ArchetypeEnum,
  /** Display name for the buddy. */
  buddyName: z
    .string()
    .min(1)
    .max(55)
    .trim(),
  /** Voice/tone preference. */
  tone: z.enum(['professional', 'casual', 'mentor', 'peer', 'concise']).default('casual'),
  /** Initial interest domains (up to 8). */
  domains: z
    .array(z.string().min(1).max(89))
    .min(1)
    .max(8),
  /** Selected interfaces. */
  interfaces: z
    .array(z.enum(['web', 'cli', 'ide', 'mobile', 'api', 'slack', 'discord']))
    .min(1)
    .default(['web']),
  /** Optional AI provider API keys (Tier 3). */
  aiKeys: z.record(z.string().min(1), z.string().min(1)).optional(),
});

// ─── Complete ───────────────────────────────────────────────────────────────

export const CompleteBodySchema = z.object({
  /** Client-side acknowledgement that onboarding is finished. */
  acknowledged: z.literal(true),
});

// ─── Skip-to-Essentials ─────────────────────────────────────────────────────

export const SkipToEssentialsBodySchema = z.object({
  /** Quick-start archetype defaults to RABBIT. */
  archetype: ArchetypeEnum.default('RABBIT'),
});

// ─── Shared Response Envelope ───────────────────────────────────────────────

/**
 * Build a structured JSON error body.
 * @param {string} code  Machine-readable error code (SCREAMING_SNAKE).
 * @param {string} message  Human-readable message.
 * @param {Record<string,unknown>} [details]  Optional validation details.
 */
export function errorBody(code, message, details) {
  return { ok: false, error: { code, message, ...(details && { details }) } };
}

/**
 * Build a structured JSON success body.
 * @param {Record<string,unknown>} data  Payload.
 */
export function successBody(data) {
  return { ok: true, data };
}

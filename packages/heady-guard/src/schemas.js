// packages/heady-guard/src/schemas.js
// §9 — Zod Validation Schemas for All API Routes
import { z } from 'zod';

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  siteId: z.enum([
    'headyme', 'headysystems', 'headybuddy', 'headyai', 'headybrain',
    'headyconnection', 'headymcp', 'headyio', 'headyfinance', 'headylens', 'headybot'
  ]).optional()
});

export const MemoryBootstrapSchema = z.object({
  userId: z.string().min(1),
  siteId: z.string().optional(),
  cslThreshold: z.number().min(0).max(1).default(0.618),
  topK: z.number().int().positive().max(55).default(21)
});

export const WisdomCommitSchema = z.object({
  patterns: z.array(z.object({
    id: z.string(),
    score: z.number(),
    content: z.string()
  })).max(21),
  sessionId: z.string().uuid(),
  userId: z.string()
});

export const OnboardingStepSchema = z.object({
  userId: z.string(),
  siteId: z.string(),
  step: z.number().int().min(0).max(8),
  data: z.record(z.unknown()).optional()
});

export const DeviceRegistrationSchema = z.object({
  deviceId: z.string().min(1),
  publicKey: z.string().min(10),
  platform: z.enum(['windows', 'linux', 'android', 'colab', 'web', 'ios'])
});

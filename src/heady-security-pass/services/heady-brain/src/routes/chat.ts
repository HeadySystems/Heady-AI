import { Router, type Router as RouterType } from 'express';
import { HeadyLogger, validateRequest } from '@heady-ai/core';
import { z } from 'zod';

export const chatRouter: RouterType = Router();
const logger = new HeadyLogger('heady-brain:chat');

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  model: z.enum(['gpt-4', 'claude-3', 'gemini-pro']).optional(),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })).optional()
});

chatRouter.post('/', async (req, res, next) => {
  try {
    const data = validateRequest(ChatRequestSchema, req.body);

    logger.info('Chat request received', {
      messageLength: data.message.length,
      model: data.model
    });

    // Chat logic not yet wired to LLM provider — return 501 so callers
    // can distinguish "not implemented" from a real failure.
    logger.warn('Chat endpoint called but LLM integration is not yet wired', {
      model: data.model,
    });
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Chat LLM integration is pending — this endpoint is not yet functional.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

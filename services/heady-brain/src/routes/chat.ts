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

    const llmEndpoint = process.env.HEADY_LLM_ENDPOINT;
    if (!llmEndpoint) {
      return res.status(503).json({
        error: 'LLM service not configured',
        message: 'Set HEADY_LLM_ENDPOINT environment variable',
        fallback: true
      });
    }

    const llmResponse = await fetch(llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HEADY_LLM_API_KEY && { 'Authorization': `Bearer ${process.env.HEADY_LLM_API_KEY}` }),
      },
      body: JSON.stringify({
        message: data.message,
        model: data.model || 'gpt-4',
        context: data.context || [],
      }),
    });

    if (!llmResponse.ok) {
      logger.error('LLM request failed', { status: llmResponse.status });
      return res.status(502).json({
        error: 'LLM service error',
        message: `Upstream returned ${llmResponse.status}`,
      });
    }

    const llmData = await llmResponse.json();
    res.json({
      response: llmData.response ?? llmData.choices?.[0]?.message?.content ?? '',
      model: data.model || 'gpt-4',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

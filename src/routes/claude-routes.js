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
// ║  FILE: src/routes/claude-routes.js                                ║
// ║  LAYER: routing                                                 ║
// ║  PURPOSE: Express routes for Claude AI integration               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const express = require('express');
const crypto = require('crypto');
const { createLogger } = require('../../packages/structured-logger');

const router = express.Router();
const log = createLogger('claude', 'claude-routes');

// ─────────────────────────────────────────────────────────────────────────
// LOAD CLAUDE MODULES (with graceful fallback)
// ─────────────────────────────────────────────────────────────────────────

let claudeAgent = null;
let hcClaudeAgent = null;

try {
  const { ClaudeCodeAgent } = require('../agents/claude-code-agent');
  claudeAgent = new ClaudeCodeAgent();
} catch (err) {
  log.warn('Failed to load claude-code-agent', { errorMessage: err.message });
  claudeAgent = null;
}

try {
  hcClaudeAgent = require('../hc_claude_agent');
} catch (err) {
  log.warn('Failed to load hc_claude_agent', { errorMessage: err.message });
  hcClaudeAgent = null;
}

// ─────────────────────────────────────────────────────────────────────────
// TIMING-SAFE API KEY VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Timing-safe comparison to prevent timing attacks.
 * Always compares full length regardless of match.
 */
function timingSafeCompare(a, b) {
  const aBuffer = Buffer.from(a || '');
  const bBuffer = Buffer.from(b || '');

  if (aBuffer.length !== bBuffer.length) {
    // Still compare to avoid timing leak
    crypto.timingSafeEqual(aBuffer, Buffer.alloc(aBuffer.length));
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Validate API key from Authorization header or env.
 * Supports both ANTHROPIC_API_KEY and HEADY_API_KEY.
 */
function validateApiKey(authHeader) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const headyKey = process.env.HEADY_API_KEY || '';

  if (!authHeader) {
    return false;
  }

  // Extract Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return false;
  }

  const token = parts[1];

  // Check against both keys (timing-safe)
  const isAnthropicValid = anthropicKey && timingSafeCompare(token, anthropicKey);
  const isHeadyValid = headyKey && timingSafeCompare(token, headyKey);

  return isAnthropicValid || isHeadyValid;
}

/**
 * Middleware to verify API key on protected routes.
 */
function requireApiKey(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!validateApiKey(authHeader)) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: missing or invalid API key',
      code: 'INVALID_API_KEY',
    });
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH / STATUS
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /status
 * Returns Claude integration status and agent availability.
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      service: 'claude-routes',
      timestamp: new Date().toISOString(),
      agents: {
        claudeCode: {
          available: claudeAgent !== null,
          id: claudeAgent?.id || null,
          skills: claudeAgent?.skills || [],
          description: claudeAgent?.describe?.() || 'Claude Code agent (unavailable)',
        },
        hcClaude: {
          available: hcClaudeAgent !== null,
          functions: hcClaudeAgent ? Object.keys(hcClaudeAgent) : [],
        },
      },
      environment: {
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasHeadyKey: !!process.env.HEADY_API_KEY,
        claudeCodeAvailable: claudeAgent !== null,
      },
    };

    res.json(status);
  } catch (error) {
    log.error('GET /status error', { errorMessage: error.message, errorStack: error.stack });
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// CLAUDE CODE ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /
 * Execute an ad-hoc prompt via Claude Code.
 *
 * Body:
 *   {
 *     "prompt": "Your instruction here",
 *     "model": "opus" | "sonnet" (optional),
 *     "outputFormat": "text" | "json" (optional, default: "text"),
 *     "allowedTools": ["Read", "Grep", "Glob"] (optional),
 *     "maxBudgetUsd": 0.25 (optional),
 *     "timeoutMs": 120000 (optional)
 *   }
 */
router.post('/', requireApiKey, async (req, res) => {
  try {
    const {
      prompt,
      model,
      outputFormat,
      allowedTools,
      maxBudgetUsd,
      timeoutMs,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: prompt',
      });
    }

    if (!hcClaudeAgent) {
      return res.status(503).json({
        status: 'error',
        message: 'Claude agent not available',
        code: 'CLAUDE_UNAVAILABLE',
      });
    }

    const options = {
      model: model || undefined,
      outputFormat: outputFormat || 'text',
      allowedTools: allowedTools || ['Read', 'Grep', 'Glob'],
      maxBudgetUsd: maxBudgetUsd || 0.25,
      timeoutMs: timeoutMs || 120000,
    };

    const result = await hcClaudeAgent.runClaude(prompt, options);

    res.json({
      status: result.ok ? 'success' : 'failed',
      request: {
        prompt: prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''),
        options,
      },
      result: {
        ok: result.ok,
        output: result.output,
        parsed: result.parsed,
        durationMs: result.durationMs,
        exitCode: result.exitCode,
      },
    });
  } catch (error) {
    log.error('POST / error', { errorMessage: error.message, errorStack: error.stack });
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'CLAUDE_EXECUTION_ERROR',
    });
  }
});

/**
 * POST /analyze
 * Analyze code quality, performance, and architecture.
 *
 * Body:
 *   {
 *     "paths": ["src/", "heady-manager.js"],
 *     "focus": "security|performance|quality|all" (optional, default: "all")
 *   }
 */
router.post('/analyze', requireApiKey, async (req, res) => {
  try {
    const { paths, focus } = req.body;

    const targetPaths = paths || ['src/', 'heady-manager.js'];

    if (!hcClaudeAgent) {
      return res.status(503).json({
        status: 'error',
        message: 'Claude agent not available',
      });
    }

    const result = await hcClaudeAgent.claudeAnalyzeCode(targetPaths);

    res.json({
      status: result.ok ? 'success' : 'failed',
      request: {
        paths: targetPaths,
        focus: focus || 'all',
      },
      result: {
        ok: result.ok,
        output: result.output,
        parsed: result.parsed,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    log.error('POST /analyze error', { errorMessage: error.message, errorStack: error.stack });
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'ANALYSIS_ERROR',
    });
  }
});

/**
 * POST /security
 * Run a security audit on the project.
 *
 * Body: {} (no required fields)
 */
router.post('/security', requireApiKey, async (req, res) => {
  try {
    if (!hcClaudeAgent) {
      return res.status(503).json({
        status: 'error',
        message: 'Claude agent not available',
      });
    }

    const result = await hcClaudeAgent.claudeSecurityAudit();

    res.json({
      status: result.ok ? 'success' : 'failed',
      request: {
        task: 'security-audit',
      },
      result: {
        ok: result.ok,
        output: result.output,
        parsed: result.parsed,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    log.error('POST /security error', { errorMessage: error.message, errorStack: error.stack });
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'SECURITY_AUDIT_ERROR',
    });
  }
});

/**
 * POST /refactor
 * Refactor code for clarity, performance, or maintainability.
 *
 * Body:
 *   {
 *     "target": "file or directory path",
 *     "goal": "improve clarity|reduce complexity|modernize|other" (optional),
 *     "constraints": "preserve tests|no functional changes|other" (optional)
 *   }
 */
router.post('/refactor', requireApiKey, async (req, res) => {
  try {
    const { target, goal, constraints } = req.body;

    if (!target) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: target',
      });
    }

    if (!claudeAgent) {
      return res.status(503).json({
        status: 'error',
        message: 'Claude Code agent not available',
      });
    }

    const request = {
      taskType: 'refactoring',
      target,
      goal: goal || 'improve clarity, reduce complexity, maintain behavior',
      prompt: `Refactor ${target}. Goal: ${goal || 'improve clarity and performance'}. Constraints: ${constraints || 'maintain existing behavior'}`,
    };

    const result = await claudeAgent.handle({
      request,
      metadata: { requestType: 'refactoring' },
    });

    res.json({
      status: result.status === 'completed' ? 'success' : 'failed',
      request: {
        taskType: request.taskType,
        target,
        goal,
        constraints,
      },
      result: {
        status: result.status,
        output: result.output,
        files: result.files || [],
        durationMs: result.durationMs,
        error: result.error,
      },
    });
  } catch (error) {
    log.error('POST /refactor error', { errorMessage: error.message, errorStack: error.stack });
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'REFACTOR_ERROR',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Catch-all 404 for unknown routes under /claude
 */
router.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET /status',
      'POST / (ad-hoc execution)',
      'POST /analyze (code analysis)',
      'POST /security (security audit)',
      'POST /refactor (code refactoring)',
    ],
  });
});

module.exports = router;

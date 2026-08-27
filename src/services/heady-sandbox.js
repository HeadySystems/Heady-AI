// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sandbox Service v9.0.0                                ║
// ║  Native terminal execution bounded by Heady Governance         ║
// ║  Made with ❤️ by HeadySystems Inc.                             ║
// ╚══════════════════════════════════════════════════════════════════╝

import { exec } from 'child_process';
import { promisify } from 'util';
import { headyEventBus } from '../core/event-bus.js';
import { logger } from '../core/logger.js';
import { cslGate } from '../core/csl-engine.js';
import { z } from 'zod';

const execAsync = promisify(exec);

const sandboxIntentSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  traceId: z.string().uuid(),
});

export async function executeSandboxCommand(intent) {
  const validated = sandboxIntentSchema.parse(intent);
  
  // CSL Gate: Structural Governance and Threat Detection
  if (!cslGate(validated.command, 0.90, 'sandbox-safety-check')) {
    throw new Error('CSL Gate Failed: Command violates Heady Governance or safety thresholds.');
  }

  logger.info({ traceId: validated.traceId, command: validated.command }, 'Executing native sandbox command');
  
  headyEventBus.publish('agent.coder.action.sandbox', {
    status: 'starting',
    command: validated.command,
    traceId: validated.traceId
  });

  try {
    const { stdout, stderr } = await execAsync(validated.command, {
      cwd: validated.cwd || process.cwd(),
      timeout: 30000 // Fixed timeout to prevent runaway processes
    });

    headyEventBus.publish('agent.coder.action.sandbox', {
      status: 'completed',
      stdout,
      stderr,
      traceId: validated.traceId
    });

    return { success: true, stdout, stderr };

  } catch (err) {
    logger.error({ traceId: validated.traceId, err }, 'Sandbox execution failed');
    headyEventBus.publish('agent.coder.error.sandbox', {
      error: err.message,
      traceId: validated.traceId
    });
    throw err;
  }
}

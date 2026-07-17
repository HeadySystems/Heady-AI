// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Browser Service v9.0.0                                ║
// ║  Native Puppeteer-based browser automation via CSL gates       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import puppeteer from 'puppeteer-core';
import { headyEventBus } from '../core/event-bus.js';
import { logger } from '../core/logger.js';
import { cslGate } from '../core/csl-engine.js';
import { PHI_7, FIB } from '../core/phi-constants.js';
import { z } from 'zod';

const browserIntentSchema = z.object({
  url: z.string().url(),
  task: z.string(),
  traceId: z.string().uuid(),
});

export async function executeBrowserSubagent(intent) {
  const validated = browserIntentSchema.parse(intent);
  
  // CSL Gate: Ensure the task meets the minimum cognitive confidence score
  if (!cslGate(validated.task, 0.85, 'browser-task-confidence')) {
    throw new Error('CSL Gate Failed: Browser task ambiguity is too high. Require higher confidence input.');
  }

  logger.info({ traceId: validated.traceId, url: validated.url }, 'Initializing HeadyBrowser');
  
  headyEventBus.publish('agent.coder.action.browser', {
    status: 'starting',
    url: validated.url,
    traceId: validated.traceId
  });

  let browser;
  try {
    // Launch native Node.js browser connection
    // Extreme Lightweight Mode: Connects to a remote browserless instance to save container weight
    if (process.env.BROWSERLESS_WSS_URL) {
      browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSERLESS_WSS_URL });
    } else {
      browser = await puppeteer.launch({
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }

    const page = await browser.newPage();
    
    // φ-Scaled timeout for navigation
    await page.goto(validated.url, { waitUntil: 'networkidle2', timeout: PHI_7 * 1000 });
    
    // Extract required data (Mock implementation of intelligent parsing)
    const content = await page.evaluate(() => {
      return document.title + '\n' + document.body.innerText.substring(0, 1000);
    });

    headyEventBus.publish('agent.coder.action.browser', {
      status: 'completed',
      contentSnapshot: content,
      traceId: validated.traceId
    });

    return { success: true, content };

  } catch (err) {
    logger.error({ traceId: validated.traceId, err }, 'HeadyBrowser execution failed');
    headyEventBus.publish('agent.coder.error.browser', {
      error: err.message,
      traceId: validated.traceId
    });
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const { createLogger } = require('../../../../utils/logger');
const logger = createLogger('auto-fixed');
/**
 * Heady™ IDE — Webpack Remote Entry Bootstrap
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
import('./mount').then(({
  mount
}) => {
  mount(document.getElementById('heady-root') || document.body, {
    autoMount: true
  });
}).catch(err => logger.error('[HeadyIDE] Bootstrap failed:', err));
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
// ║  FILE: src/services/shared/errors.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';
// Stub errors module
class HeadyError extends Error {
  constructor(message, code = 'HEADY_ERROR', status = 500) {
    super(message);
    this.name = 'HeadyError';
    this.code = code;
    this.status = status;
  }
}
const AuthErrors = { UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', TOKEN_EXPIRED: 'TOKEN_EXPIRED' };
const PipelineErrors = { INVALID: 'INVALID_PIPELINE', TIMEOUT: 'PIPELINE_TIMEOUT', FAILED: 'PIPELINE_FAILED' };
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message, code: err.code || 'INTERNAL_ERROR' });
};
module.exports = { HeadyError, AuthErrors, PipelineErrors, errorHandler };

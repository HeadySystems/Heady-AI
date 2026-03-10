/**
 * Heady Structured Logger — JSON output with correlation IDs
 * @module shared/logger
 */

function createLogger(service) {
  const _log = (level, data, msg) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level, service,
      correlationId: data?.correlationId || null,
      msg: msg || data?.message || '',
    };
    if (data && typeof data === 'object') {
      const { correlationId, message, ...rest } = data;
      Object.assign(entry, rest);
    }
    const out = level === 'error' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
  };
  return {
    info:  (data, msg) => _log('info', data, msg),
    warn:  (data, msg) => _log('warn', data, msg),
    error: (data, msg) => _log('error', data, msg),
    debug: (data, msg) => _log('debug', data, msg),
  };
}

module.exports = { createLogger };

'use strict';
// Stub structured-logger package
const createLogger = (name = 'app') => ({
  info: (...a) => console.log(JSON.stringify({ level: 'info', name, msg: a.join(' '), t: Date.now() })),
  warn: (...a) => console.warn(JSON.stringify({ level: 'warn', name, msg: a.join(' '), t: Date.now() })),
  error: (...a) => console.error(JSON.stringify({ level: 'error', name, msg: a.join(' '), t: Date.now() })),
  debug: (...a) => console.debug(JSON.stringify({ level: 'debug', name, msg: a.join(' '), t: Date.now() })),
  child: (sub) => createLogger(typeof sub === 'string' ? `${name}:${sub}` : name),
});
module.exports = { createLogger };
module.exports.default = { createLogger };

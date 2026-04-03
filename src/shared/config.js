'use strict';
// Stub config module
const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
module.exports = config;
module.exports.validateEnvironment = () => config;

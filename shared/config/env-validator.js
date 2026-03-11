/**
 * Heady™ Environment Validator
 * Validates required environment variables on service startup
 *
 * Required variables:
 *   - HEADY_SERVICE_HOST
 *   - HEADY_LOG_LEVEL
 *   - NODE_ENV
 *
 * Optional variables with defaults:
 *   - HEADY_SERVICE_PORT (default: 3000)
 *   - HEADY_LOG_DIR (default: ./logs)
 *   - NODE_ENV (default: development)
 */

/**
 * Validate environment variables
 * @param {Object} options - Validation options
 * @param {Array<string>} options.required - Required variable names
 * @param {Object} options.defaults - Default values for optional vars
 * @param {boolean} options.throwOnMissing - Throw error if required vars missing (default: true)
 * @returns {Object} Validated environment with defaults applied
 * @throws {Error} If required variables are missing and throwOnMissing is true
 */
function validateEnv(options = {}) {
  const {
    required = [
      'HEADY_SERVICE_HOST',
      'HEADY_LOG_LEVEL',
      'NODE_ENV',
    ],
    defaults = {
      HEADY_SERVICE_PORT: '3000',
      HEADY_LOG_DIR: './logs',
      NODE_ENV: 'development',
      HEADY_LOG_LEVEL: 'info',
    },
    throwOnMissing = true,
  } = options;

  const env = { ...process.env };
  const missing = [];
  const validated = {};

  // Check required variables
  for (const variable of required) {
    if (!env[variable]) {
      missing.push(variable);
    } else {
      validated[variable] = env[variable];
    }
  }

  // Apply defaults for optional variables
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (env[key]) {
      validated[key] = env[key];
    } else if (!required.includes(key)) {
      validated[key] = defaultValue;
    }
  }

  // Handle missing required variables
  if (missing.length > 0) {
    const errorMessage = [
      'Missing required environment variables:',
      ...missing.map((v) => `  - ${v}`),
      '',
      'Please set these variables and try again.',
    ].join('\n');

    if (throwOnMissing) {
      throw new Error(errorMessage);
    } else {
      console.warn(`[WARN] ${errorMessage}`);
    }
  }

  // Validate NODE_ENV is valid
  const validNodeEnvs = ['development', 'production', 'staging', 'test'];
  if (validated.NODE_ENV && !validNodeEnvs.includes(validated.NODE_ENV)) {
    const warning = `[WARN] NODE_ENV='${validated.NODE_ENV}' is not standard. Expected one of: ${validNodeEnvs.join(', ')}`;
    console.warn(warning);
  }

  // Validate HEADY_LOG_LEVEL
  const validLogLevels = ['debug', 'info', 'warn', 'error', 'silent'];
  if (validated.HEADY_LOG_LEVEL && !validLogLevels.includes(validated.HEADY_LOG_LEVEL)) {
    const warning = `[WARN] HEADY_LOG_LEVEL='${validated.HEADY_LOG_LEVEL}' is invalid. Expected one of: ${validLogLevels.join(', ')}`;
    console.warn(warning);
  }

  // Validate HEADY_SERVICE_PORT is numeric
  if (validated.HEADY_SERVICE_PORT) {
    const port = parseInt(validated.HEADY_SERVICE_PORT, 10);
    if (isNaN(port) || port < 0 || port > 65535) {
      throw new Error(
        `Invalid HEADY_SERVICE_PORT='${validated.HEADY_SERVICE_PORT}'. Must be a number between 0 and 65535.`
      );
    }
    validated.HEADY_SERVICE_PORT = port;
  }

  return validated;
}

/**
 * Bootstrap environment validation at application startup
 * Designed to be called early in application initialization
 *
 * @param {Object} options - Validation options (same as validateEnv)
 * @returns {Object} Validated environment
 * @throws {Error} If validation fails
 */
function bootstrapEnv(options = {}) {
  console.log('[BOOTSTRAP] Validating environment variables...');

  try {
    const validated = validateEnv(options);
    console.log('[BOOTSTRAP] Environment validation passed');
    console.log(`[BOOTSTRAP] Service: ${validated.HEADY_SERVICE_HOST}`);
    console.log(`[BOOTSTRAP] Port: ${validated.HEADY_SERVICE_PORT}`);
    console.log(`[BOOTSTRAP] Environment: ${validated.NODE_ENV}`);
    console.log(`[BOOTSTRAP] Log Level: ${validated.HEADY_LOG_LEVEL}`);

    return validated;
  } catch (error) {
    console.error('[ERROR] Environment validation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Get environment variable with type coercion
 * @param {string} key - Environment variable key
 * @param {string} type - Type to coerce to ('string', 'number', 'boolean')
 * @param {*} defaultValue - Default if not set
 * @returns {*} Typed environment variable value
 */
function getEnvVar(key, type = 'string', defaultValue = null) {
  const value = process.env[key];

  if (value === undefined) {
    return defaultValue;
  }

  switch (type.toLowerCase()) {
    case 'number':
      return parseInt(value, 10);
    case 'boolean':
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    case 'string':
    default:
      return value;
  }
}

/**
 * Assert that an environment variable exists
 * @param {string} key - Variable key
 * @param {string} message - Custom error message
 * @throws {Error} If variable is not set
 * @returns {string} The environment variable value
 */
function requireEnvVar(key, message = null) {
  const value = process.env[key];
  if (!value) {
    const error = message || `Required environment variable '${key}' is not set`;
    throw new Error(error);
  }
  return value;
}

module.exports = {
  validateEnv,
  bootstrapEnv,
  getEnvVar,
  requireEnvVar,
};

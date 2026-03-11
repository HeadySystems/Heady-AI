/**
 * Heady™ Request Validator
 * Validates tool calls and JSON-RPC requests
 */
'use strict';

/**
 * Validate a tool call request
 * @param {object} params — tool call parameters
 * @returns {{valid: boolean, error: string|null}}
 */
function validateToolCall(params) {
  if (!params || typeof params !== 'object') {
    return {
      valid: false,
      error: 'Tool call parameters must be an object',
    };
  }

  // Validate 'name' field
  if (!('name' in params)) {
    return {
      valid: false,
      error: 'Tool call must have a "name" field',
    };
  }

  if (typeof params.name !== 'string') {
    return {
      valid: false,
      error: `Tool "name" must be a string, got ${typeof params.name}`,
    };
  }

  if (params.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Tool "name" cannot be empty',
    };
  }

  // Validate 'arguments' field
  if (!('arguments' in params)) {
    return {
      valid: false,
      error: 'Tool call must have an "arguments" field',
    };
  }

  if (typeof params.arguments !== 'object' || Array.isArray(params.arguments)) {
    return {
      valid: false,
      error: `Tool "arguments" must be an object, got ${typeof params.arguments}`,
    };
  }

  return {
    valid: true,
    error: null,
  };
}

/**
 * Validate a JSON-RPC 2.0 request
 * @param {object} request — JSON-RPC request object
 * @returns {{valid: boolean, error: string|null}}
 */
function validateJsonRpc(request) {
  if (!request || typeof request !== 'object') {
    return {
      valid: false,
      error: 'Request must be an object',
    };
  }

  // Validate 'jsonrpc' field
  if (request.jsonrpc !== '2.0') {
    return {
      valid: false,
      error: `JSON-RPC "jsonrpc" must be "2.0", got "${request.jsonrpc}"`,
    };
  }

  // Validate 'method' field
  if (!('method' in request)) {
    return {
      valid: false,
      error: 'JSON-RPC request must have a "method" field',
    };
  }

  if (typeof request.method !== 'string') {
    return {
      valid: false,
      error: `JSON-RPC "method" must be a string, got ${typeof request.method}`,
    };
  }

  if (request.method.trim().length === 0) {
    return {
      valid: false,
      error: 'JSON-RPC "method" cannot be empty',
    };
  }

  // Validate 'id' field (required for request/response pairs)
  if (!('id' in request)) {
    return {
      valid: false,
      error: 'JSON-RPC request must have an "id" field',
    };
  }

  // ID can be string, number, or NULL, but must be present
  if (request.id === undefined) {
    return {
      valid: false,
      error: 'JSON-RPC "id" cannot be undefined',
    };
  }

  return {
    valid: true,
    error: null,
  };
}

module.exports = {
  validateToolCall,
  validateJsonRpc,
};

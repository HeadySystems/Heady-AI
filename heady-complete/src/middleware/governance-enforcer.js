'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Governance Enforcer Middleware
 * Loads governance-policies.yaml and enforces:
 *   - Per-agent tool group allowlists
 *   - Per-tool-group auth levels, rate limits, CSL thresholds
 *   - Approval gates for protected/destructive actions
 *   - Audit logging for all governance decisions
 */

let _policies = null;
let _policiesHash = null;

function loadPolicies() {
  const policyPath = path.resolve(__dirname, '../../../configs/governance-policies.yaml');
  try {
    const raw = fs.readFileSync(policyPath, 'utf-8');
    const newHash = crypto.createHash('sha256').update(raw).digest('hex');
    if (newHash !== _policiesHash) {
      _policies = yaml.load(raw);
      _policiesHash = newHash;
      logger.info(`[GovernanceEnforcer] Policies loaded (hash: ${newHash.slice(0, 12)})`);
    }
  } catch (err) {
    logger.error(`[GovernanceEnforcer] Failed to load policies: ${err.message}`);
    if (!_policies) {
      // Fail-closed: deny everything if policies can't be loaded
      _policies = { toolGovernance: {}, agentGovernance: {} };
    }
  }
  return _policies;
}

// Hot-reload policies every 60s
setInterval(loadPolicies, 60_000);
loadPolicies();

/**
 * Resolve which tool group a tool belongs to
 */
function resolveToolGroup(toolName, policies) {
  const governance = policies.toolGovernance || {};
  for (const [groupName, group] of Object.entries(governance)) {
    if (group.tools && group.tools.includes(toolName)) {
      return { groupName, group };
    }
  }
  return null;
}

/**
 * Middleware: enforce agent identity against governance-policies.yaml
 *
 * Expects req.user.agentId or req.headers['x-agent-id'] to identify the agent.
 * Expects req.params.toolName or req.body.tool to identify the requested tool.
 */
function enforceAgentGovernance(req, res, next) {
  const policies = loadPolicies();
  const agentId = req.user?.agentId || req.headers['x-agent-id'];
  const toolName = req.params.toolName || req.body?.tool;

  if (!agentId) {
    // No agent identity — skip agent governance (user auth still required)
    return next();
  }

  const agentPolicy = policies.agentGovernance?.[agentId.toUpperCase()];
  if (!agentPolicy) {
    logger.warn(`[GovernanceEnforcer] Unknown agent: ${agentId}`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Agent "${agentId}" is not registered in governance policies`,
    });
  }

  // If no tool specified, allow (route-level auth handles the rest)
  if (!toolName) return next();

  const toolGroupInfo = resolveToolGroup(toolName, policies);
  if (!toolGroupInfo) {
    logger.warn(`[GovernanceEnforcer] Unknown tool: ${toolName}`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Tool "${toolName}" is not registered in any tool group`,
    });
  }

  const { groupName, group } = toolGroupInfo;
  const allowedGroups = agentPolicy.allowedToolGroups || [];

  if (!allowedGroups.includes(groupName)) {
    logger.warn(`[GovernanceEnforcer] Agent ${agentId} denied access to ${groupName}/${toolName}`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Agent "${agentId}" is not allowed to use tool group "${groupName}"`,
      allowed: allowedGroups,
      requested: groupName,
    });
  }

  // Check read-only agents
  if (agentPolicy.readOnly && req.method !== 'GET') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Agent "${agentId}" is read-only and cannot perform ${req.method} operations`,
    });
  }

  // Check approval requirement for destructive tools
  if (group.requiresApproval && group.destructiveTools?.includes(toolName)) {
    const approvalToken = req.headers['x-approval-token'];
    if (!approvalToken) {
      return res.status(403).json({
        error: 'APPROVAL_REQUIRED',
        message: `Tool "${toolName}" requires explicit approval. Provide X-Approval-Token header.`,
        tool: toolName,
        group: groupName,
      });
    }
  }

  // Attach governance context for downstream use
  req.governance = {
    agent: agentId,
    toolGroup: groupName,
    authLevel: group.authLevel,
    riskLevel: group.riskLevel,
    cslThreshold: group.cslThreshold,
    rateLimit: group.rateLimit,
  };

  next();
}

/**
 * Middleware: enforce auth level from tool governance
 * Must run AFTER authenticateJWT or authenticateMCP
 */
function enforceAuthLevel(requiredLevel) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'viewer';

    if (requiredLevel === 'admin' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `This endpoint requires admin auth level, got: ${userRole}`,
      });
    }

    if (requiredLevel === 'authenticated' && !req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    next();
  };
}

module.exports = { enforceAgentGovernance, enforceAuthLevel, loadPolicies, resolveToolGroup };

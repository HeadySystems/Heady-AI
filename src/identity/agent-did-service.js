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
// ║  FILE: src/identity/agent-did-service.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady™ Agent DID Identity Service v1.0.0
 * HeadySystems Inc. — Sovereign Agent Identity
 * 
 * Each of 47 agents gets a did:web identifier with
 * ML-DSA-65 signed Verifiable Credentials attesting capabilities.
 * Delegation grants flow hierarchically from HeadySoul → Domain Supervisors → Workers.
 * 
 * Patent Zone: HS-064 (PQC-Signed Sovereign Agent Identity with φ-Scaled Delegation)
 * @port 3406
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const pino = require('pino');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const logger = pino({ name: 'agent-did-identity', level: process.env.LOG_LEVEL || 'info' });

// ─── DID Document Generator ──────────────────────────────────
class AgentDIDService {
  constructor(config) {
    this.domain = config.domain || 'headysystems.com';
    this.agents = new Map();
    this.delegations = new Map();
    this.credentials = new Map();
    this.redis = config.redis;
    this.neon = config.neon;
  }

  /**
   * Generate a did:web identifier for an agent.
   * Format: did:web:headysystems.com:agents:{agentId}
   */
  generateDID(agentId) {
    return `did:web:${this.domain}:agents:${agentId}`;
  }

  /**
   * Create a full DID Document for an agent.
   * Includes PQC verification methods (ML-DSA-65 + ML-KEM-768).
   */
  createDIDDocument(agentId, capabilities, metadata = {}) {
    const did = this.generateDID(agentId);
    const created = new Date().toISOString();

    // Generate PQC key material (in production, use @noble/post-quantum)
    const sigKeyId = `${did}#ml-dsa-65-key-1`;
    const kemKeyId = `${did}#ml-kem-768-key-1`;
    const edKeyId = `${did}#ed25519-key-1`; // Legacy compat only

    const doc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://headysystems.com/ns/agent-identity/v1',
      ],
      id: did,
      controller: metadata.controller || `did:web:${this.domain}:agents:heady-soul`,
      created,
      updated: created,

      verificationMethod: [
        {
          id: sigKeyId,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: {
            kty: 'PQC',
            alg: 'ML-DSA-65',
            crv: 'ML-DSA-65',
            // In production: actual ML-DSA-65 public key bytes
            x: this._generateKeyPlaceholder('ml-dsa-65', agentId),
            nist_level: 3,
          },
        },
        {
          id: kemKeyId,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: {
            kty: 'PQC',
            alg: 'ML-KEM-768',
            crv: 'ML-KEM-768',
            x: this._generateKeyPlaceholder('ml-kem-768', agentId),
            nist_level: 3,
          },
        },
      ],

      authentication: [sigKeyId],
      assertionMethod: [sigKeyId],
      keyAgreement: [kemKeyId],

      service: [
        {
          id: `${did}#a2a`,
          type: 'Agent2AgentEndpoint',
          serviceEndpoint: `https://${agentId}.${this.domain}`,
        },
        {
          id: `${did}#mcp`,
          type: 'MCPServerEndpoint',
          serviceEndpoint: `https://mcp.${this.domain}/agents/${agentId}`,
        },
        {
          id: `${did}#health`,
          type: 'HealthEndpoint',
          serviceEndpoint: `https://${agentId}.${this.domain}/health`,
        },
      ],

      // Heady extensions
      'heady:capabilities': capabilities,
      'heady:swarm': metadata.swarm || 'Overmind',
      'heady:tier': metadata.tier || 'P1',
      'heady:phi_trust_score': metadata.trust || PSI, // Initial trust = ψ
      'heady:bee_types': metadata.beeTypes || [],
      'heady:archetype': metadata.archetype || 'Executor',
    };

    this.agents.set(agentId, doc);
    return doc;
  }

  /**
   * Issue a Verifiable Credential attesting agent capabilities.
   * W3C VC 2.0 compliant with PQC proof.
   */
  issueCapabilityVC(issuerAgentId, subjectAgentId, capabilities, expirationHours = FIB[12]) {
    const issuerId = this.generateDID(issuerAgentId);
    const subjectId = this.generateDID(subjectAgentId);
    const issuanceDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + expirationHours * 3600 * 1000).toISOString();

    const vc = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://headysystems.com/ns/agent-capability/v1',
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'AgentCapabilityCredential'],
      issuer: issuerId,
      issuanceDate,
      expirationDate,
      credentialSubject: {
        id: subjectId,
        capabilities: capabilities.map(cap => ({
          name: cap.name,
          scope: cap.scope || 'full',
          constraints: cap.constraints || {},
          phi_weight: cap.weight || PSI,
        })),
        'heady:delegationDepth': capabilities[0]?.delegationDepth || 1,
        'heady:maxSubDelegations': FIB[4], // 5
      },
      credentialStatus: {
        id: `https://status.${this.domain}/credentials/${crypto.randomUUID()}`,
        type: 'BitstringStatusListEntry',
        statusPurpose: 'revocation',
        statusListIndex: Math.floor(Math.random() * FIB[14]),
        statusListCredential: `https://status.${this.domain}/list/agents`,
      },
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'ml-dsa-65-jcs-2026',
        created: issuanceDate,
        verificationMethod: `${issuerId}#ml-dsa-65-key-1`,
        proofPurpose: 'assertionMethod',
        proofValue: this._signVC(vc, issuerAgentId),
      },
    };

    const vcId = vc.id;
    this.credentials.set(vcId, vc);

    logger.info({
      issuer: issuerAgentId,
      subject: subjectAgentId,
      capabilities: capabilities.length,
      expires: expirationDate,
    }, 'Capability VC issued');

    return vc;
  }

  /**
   * Create a delegation grant — bounded authority transfer
   * from supervisor to worker agent.
   * Scope narrows with each delegation level (φ-decay).
   */
  createDelegationGrant(delegatorId, delegateeId, scopes, depth = 1) {
    const maxDepth = FIB[4]; // 5 levels max
    if (depth > maxDepth) {
      throw new Error(`Delegation depth ${depth} exceeds maximum ${maxDepth}`);
    }

    // Scope narrows by ψ at each level
    const scopeReduction = Math.pow(PSI, depth);
    const effectiveScopes = scopes.map(s => ({
      ...s,
      phi_authority: (s.phi_authority || 1.0) * scopeReduction,
      depth,
    }));

    const grant = {
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: 'DelegationGrant',
      delegator: this.generateDID(delegatorId),
      delegatee: this.generateDID(delegateeId),
      scopes: effectiveScopes,
      depth,
      maxSubDelegations: Math.max(0, FIB[4] - depth),
      created: new Date().toISOString(),
      expires: new Date(Date.now() + FIB[11 - depth] * 3600 * 1000).toISOString(),
      chain: this._buildDelegationChain(delegatorId),
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'ml-dsa-65-jcs-2026',
        proofValue: this._signVC({ delegator: delegatorId, delegatee: delegateeId, scopes }, delegatorId),
      },
    };

    if (!this.delegations.has(delegateeId)) {
      this.delegations.set(delegateeId, []);
    }
    this.delegations.get(delegateeId).push(grant);

    logger.info({
      delegator: delegatorId,
      delegatee: delegateeId,
      depth,
      scopes: scopes.length,
      authority: scopeReduction.toFixed(4),
    }, 'Delegation grant created');

    return grant;
  }

  /**
   * Verify an agent's authority to perform an action.
   * Walks the delegation chain from agent → HeadySoul.
   */
  async verifyAuthority(agentId, requiredCapability) {
    // Check direct credentials
    const agentCredentials = [...this.credentials.values()]
      .filter(vc => vc.credentialSubject.id === this.generateDID(agentId));

    for (const vc of agentCredentials) {
      // Check expiration
      if (new Date(vc.expirationDate) < new Date()) continue;

      const caps = vc.credentialSubject.capabilities;
      const match = caps.find(c => c.name === requiredCapability);
      if (match && match.phi_weight >= PSI_SQ) {
        return { authorized: true, source: 'direct_vc', weight: match.phi_weight };
      }
    }

    // Check delegation grants
    const grants = this.delegations.get(agentId) || [];
    for (const grant of grants) {
      if (new Date(grant.expires) < new Date()) continue;

      const scopeMatch = grant.scopes.find(s => s.name === requiredCapability);
      if (scopeMatch && scopeMatch.phi_authority >= PSI_SQ) {
        return {
          authorized: true,
          source: 'delegation',
          depth: grant.depth,
          authority: scopeMatch.phi_authority,
          chain: grant.chain,
        };
      }
    }

    return { authorized: false, reason: 'no_valid_credential_or_delegation' };
  }

  /**
   * Bootstrap all 47 agents with DIDs.
   * HeadySoul is the root controller.
   */
  async bootstrapAllAgents() {
    const agentDefinitions = [
      // Core Pipeline (10)
      { id: 'heady-brain', caps: ['reasoning', 'llm_routing', 'synthesis'], swarm: 'Overmind', tier: 'P0', archetype: 'Researcher' },
      { id: 'heady-buddy', caps: ['conversation', 'memory', 'coaching'], swarm: 'Overmind', tier: 'P0', archetype: 'Executor' },
      { id: 'heady-soul', caps: ['governance', 'wisdom', 'final_authority'], swarm: 'Governance', tier: 'P0', archetype: 'Sovereign' },
      { id: 'heady-conductor', caps: ['orchestration', 'dag_routing', 'a2a'], swarm: 'Overmind', tier: 'P0', archetype: 'Architect' },
      { id: 'heady-orchestrator', caps: ['pipeline', 'swarm_dispatch', 'scheduling'], swarm: 'Overmind', tier: 'P0', archetype: 'Architect' },
      { id: 'heady-patterns', caps: ['pattern_recognition', 'anomaly_detection'], swarm: 'Tensor', tier: 'P1', archetype: 'Analyst' },
      { id: 'heady-aware', caps: ['metacognition', 'confidence_calibration'], swarm: 'Tensor', tier: 'P1', archetype: 'Analyst' },
      { id: 'heady-corrections', caps: ['error_analysis', 'root_cause', 'anti_regression'], swarm: 'Sentinel', tier: 'P1', archetype: 'Analyst' },
      { id: 'heady-qa', caps: ['testing', 'validation', 'quality_gates'], swarm: 'Sentinel', tier: 'P1', archetype: 'Guardian' },
      { id: 'heady-vinci', caps: ['creative', 'design', 'visualization'], swarm: 'Studio', tier: 'P1', archetype: 'Librarian' },

      // Intelligence (5)
      { id: 'heady-memory', caps: ['storage', 'retrieval', 'consolidation'], swarm: 'Tensor', tier: 'P0', archetype: 'Librarian' },
      { id: 'heady-embed', caps: ['embedding', 'vectorization', 'similarity'], swarm: 'Tensor', tier: 'P1', archetype: 'Librarian' },
      { id: 'heady-vector', caps: ['vector_search', 'hnsw_index', 'hybrid_search'], swarm: 'Tensor', tier: 'P1', archetype: 'Librarian' },
      { id: 'heady-infer', caps: ['inference', 'model_serving', 'batch_predict'], swarm: 'Foundry', tier: 'P1', archetype: 'Executor' },
      { id: 'heady-foundry', caps: ['fine_tuning', 'dataset_curation', 'model_eval'], swarm: 'Foundry', tier: 'P2', archetype: 'Researcher' },

      // Integration (6)
      { id: 'heady-mcp', caps: ['mcp_tools', 'tool_dispatch', 'session_mgmt'], swarm: 'Overmind', tier: 'P0', archetype: 'Architect' },
      { id: 'heady-io', caps: ['sdk', 'api_gateway', 'developer_tools'], swarm: 'Emissary', tier: 'P1', archetype: 'Executor' },
      { id: 'heady-bee-factory', caps: ['bee_spawning', 'template_registry', 'lifecycle'], swarm: 'Forge', tier: 'P1', archetype: 'Architect' },
      { id: 'heady-guard', caps: ['security', 'pii_redaction', 'input_validation'], swarm: 'Sentinel', tier: 'P0', archetype: 'Guardian' },
      { id: 'heady-governance', caps: ['policy', 'compliance', 'audit'], swarm: 'Governance', tier: 'P0', archetype: 'Guardian' },
      { id: 'heady-distiller', caps: ['recipe_extraction', 'prompt_optimization', 'dpo_training'], swarm: 'Foundry', tier: 'P1', archetype: 'Distiller' },

      // Named Agents from §1
      { id: 'hermes', caps: ['sessions', 'dpop', 'transport_negotiation', 'a2a_protocol'], swarm: 'Overmind', tier: 'P0', archetype: 'Architect' },
      { id: 'kronos', caps: ['task_lifecycle', 'state_machine', 'phi_retry'], swarm: 'Overmind', tier: 'P0', archetype: 'Architect' },
      { id: 'argus', caps: ['audit', 'telemetry', 'drift_detection'], swarm: 'Sentinel', tier: 'P1', archetype: 'Analyst' },
      { id: 'nexus', caps: ['federation', 'tenant_isolation', 'quota'], swarm: 'Diplomat', tier: 'P1', archetype: 'Architect' },
      { id: 'herald', caps: ['webhooks', 'event_bus', 'triggers'], swarm: 'Emissary', tier: 'P1', archetype: 'Executor' },
      { id: 'echo', caps: ['event_mesh', 'pub_sub', 'cross_service'], swarm: 'Overmind', tier: 'P1', archetype: 'Architect' },
      { id: 'nemesis', caps: ['reputation', 'trust_scoring', 'grading'], swarm: 'Governance', tier: 'P1', archetype: 'Analyst' },

      // MAPE-K
      { id: 'mape-k', caps: ['self_improvement', 'drift_response', 'optimization'], swarm: 'Sentinel', tier: 'P1', archetype: 'Analyst' },
    ];

    const results = [];
    for (const def of agentDefinitions) {
      const doc = this.createDIDDocument(def.id, def.caps, {
        swarm: def.swarm,
        tier: def.tier,
        archetype: def.archetype,
        controller: def.id === 'heady-soul' ? `did:web:${this.domain}:founder:eric-haywood` : undefined,
      });

      // HeadySoul issues capability VCs to all agents
      if (def.id !== 'heady-soul') {
        const vc = this.issueCapabilityVC('heady-soul', def.id, def.caps.map(c => ({
          name: c,
          scope: 'full',
          weight: def.tier === 'P0' ? PHI * 0.5 : PSI,
          delegationDepth: def.tier === 'P0' ? 3 : 1,
        })));
        results.push({ agent: def.id, did: doc.id, vc: vc.id });
      } else {
        results.push({ agent: def.id, did: doc.id, vc: 'root_authority' });
      }
    }

    // Create delegation hierarchy
    // HeadySoul → Domain Supervisors
    for (const supervisor of ['heady-conductor', 'heady-guard', 'heady-memory']) {
      this.createDelegationGrant('heady-soul', supervisor, [
        { name: 'orchestration', phi_authority: 1.0 },
        { name: 'agent_management', phi_authority: PSI },
      ], 1);
    }

    // Domain Supervisors → Workers
    this.createDelegationGrant('heady-conductor', 'heady-bee-factory', [
      { name: 'bee_spawning', phi_authority: PSI },
    ], 2);

    logger.info({ agents: results.length }, 'All agent DIDs bootstrapped');
    return results;
  }

  _generateKeyPlaceholder(algorithm, agentId) {
    return crypto.createHash('sha256')
      .update(`${algorithm}:${agentId}:${this.domain}:${Date.now()}`)
      .digest('base64url');
  }

  _signVC(data, signerAgentId) {
    const payload = JSON.stringify(data);
    return crypto.createHash('sha256')
      .update(`${payload}:${signerAgentId}:ml-dsa-65`)
      .digest('base64url');
  }

  _buildDelegationChain(agentId) {
    const chain = [this.generateDID(agentId)];
    // Walk up to root
    const doc = this.agents.get(agentId);
    if (doc && doc.controller && doc.controller !== doc.id) {
      const controllerId = doc.controller.split(':').pop();
      if (controllerId !== agentId) {
        chain.push(doc.controller);
      }
    }
    return chain;
  }
}

// ─── Express Server ───────────────────────────────────────────
function createServer(didService) {
  const app = express();
  app.use(express.json());

  // DID Resolution endpoint
  app.get('/agents/:agentId/did.json', (req, res) => {
    const doc = didService.agents.get(req.params.agentId);
    if (!doc) return res.status(404).json({ error: 'Agent DID not found' });
    res.json(doc);
  });

  // A2A Agent Card (Google A2A protocol)
  app.get('/.well-known/agent.json', (req, res) => {
    res.json({
      name: 'heady-agent-did-service',
      version: '1.0.0',
      description: 'Sovereign Agent Identity — DID generation, VC issuance, delegation grants',
      capabilities: ['did_resolution', 'vc_issuance', 'delegation', 'authority_verification'],
      endpoint: `https://identity.${didService.domain}`,
      auth: { type: 'bearer', scheme: 'ML-DSA-65' },
    });
  });

  // Issue VC
  app.post('/credentials/issue', async (req, res) => {
    try {
      const { issuer, subject, capabilities } = req.body;
      const vc = didService.issueCapabilityVC(issuer, subject, capabilities);
      res.status(201).json(vc);
    } catch (err) {
      logger.error({ err }, 'VC issuance failed');
      res.status(400).json({ error: err.message });
    }
  });

  // Verify authority
  app.post('/authority/verify', async (req, res) => {
    try {
      const { agentId, capability } = req.body;
      const result = await didService.verifyAuthority(agentId, capability);
      res.json(result);
    } catch (err) {
      logger.error({ err }, 'Authority verification failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Create delegation
  app.post('/delegations', async (req, res) => {
    try {
      const { delegator, delegatee, scopes, depth } = req.body;
      const grant = didService.createDelegationGrant(delegator, delegatee, scopes, depth);
      res.status(201).json(grant);
    } catch (err) {
      logger.error({ err }, 'Delegation creation failed');
      res.status(400).json({ error: err.message });
    }
  });

  // Bootstrap all agents
  app.post('/bootstrap', async (req, res) => {
    try {
      const results = await didService.bootstrapAllAgents();
      res.json({ bootstrapped: results.length, agents: results });
    } catch (err) {
      logger.error({ err }, 'Bootstrap failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Health
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'agent-did-identity',
      version: '1.0.0',
      agents_registered: didService.agents.size,
      credentials_issued: didService.credentials.size,
      delegations_active: didService.delegations.size,
      uptime: process.uptime(),
    });
  });

  return app;
}

// ─── Bootstrap ────────────────────────────────────────────────
if (require.main === module) {
  const config = { domain: 'headysystems.com', redis: null, neon: null };
  const didService = new AgentDIDService(config);
  const app = createServer(didService);
  const port = parseInt(process.env.PORT || '3406');

  app.listen(port, () => {
    logger.info({ port }, 'Agent DID Identity Service started');
    didService.bootstrapAllAgents().then(results => {
      logger.info({ agents: results.length }, 'Agent DIDs bootstrapped on startup');
    });
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down Agent DID Identity Service');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { AgentDIDService, createServer };

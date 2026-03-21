const { createLogger } = require('../../utils/logger');
const logger = createLogger('auto-fixed');
/**
 * CHRONICLE Node — Immutable history node (Governance layer)
 * Maintains cryptographic audit trail of all system decisions,
 * actions, and state changes. OracleChain integration.
 * Sacred Geometry: Governance layer.
 * @module CHRONICLE
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const crypto = require('crypto');
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972
};
class ChronicleNode {
  constructor(config = {}) {
    this.ring = 'governance';
    this.nodeId = 'CHRONICLE';
    this.chain = [];
    this.maxChainLength = config.maxChainLength || FIB[14]; // 377 entries before rotation
    this.genesisHash = this._hash('HEADY_GENESIS_BLOCK_v1');
    this.lastHash = this.genesisHash;
    this.rotations = 0;
    this.state = 'RECORDING';
    this.stats = {
      recorded: 0,
      verified: 0,
      rotations: 0,
      tamperDetections: 0,
      receiptsIssued: 0
    };
    this._correlationId = `chronicle-${Date.now().toString(36)}`;
    this._initGenesisBlock();
  }
  _initGenesisBlock() {
    const genesis = {
      index: 0,
      timestamp: Date.now(),
      type: 'genesis',
      data: {
        message: 'Chronicle initialized',
        version: '1.0.0',
        phi: PHI
      },
      previousHash: '0'.repeat(64),
      hash: this.genesisHash,
      nonce: 0
    };
    this.chain.push(genesis);
  }

  /**
   * Record an event in the immutable chronicle
   * @param {object} event — { type, actor, action, target, data, severity }
   * @returns {object} — receipt with hash proof
   */
  record(event) {
    const {
      type = 'action',
      actor = 'system',
      action,
      target,
      data = {},
      severity = CSL.MEDIUM
    } = event;
    const index = this.chain.length;
    const timestamp = Date.now();
    const previousHash = this.lastHash;
    const block = {
      index,
      timestamp,
      type,
      actor,
      action,
      target,
      data,
      severity,
      previousHash,
      correlationId: `rec-${timestamp.toString(36)}-${index}`
    };
    block.hash = this._hashBlock(block);
    this.lastHash = block.hash;
    this.chain.push(block);
    this.stats.recorded++;

    // Check if rotation needed (Fibonacci-scaled at FIB[14])
    if (this.chain.length >= this.maxChainLength) {
      this._rotateChain();
    }

    // Generate receipt
    const receipt = this._generateReceipt(block);
    this._log('info', 'event-recorded', {
      index,
      type,
      actor,
      action,
      hash: block.hash.slice(0, 16)
    });
    return receipt;
  }

  /**
   * Verify integrity of the entire chain
   * @returns {object} — verification result
   */
  verify() {
    this.stats.verified++;
    const errors = [];
    for (let i = 1; i < this.chain.length; i++) {
      const block = this.chain[i];
      const prevBlock = this.chain[i - 1];

      // Verify hash chain linkage
      if (block.previousHash !== prevBlock.hash) {
        errors.push({
          index: i,
          error: 'broken-chain-link',
          expected: prevBlock.hash,
          found: block.previousHash
        });
      }

      // Verify block hash integrity
      const computedHash = this._hashBlock(block);
      if (block.hash !== computedHash) {
        errors.push({
          index: i,
          error: 'tampered-block',
          expected: computedHash,
          found: block.hash
        });
      }
    }
    if (errors.length > 0) {
      this.stats.tamperDetections += errors.length;
      this._log('error', 'chain-integrity-violated', {
        errors: errors.length
      });
    }
    return {
      valid: errors.length === 0,
      chainLength: this.chain.length,
      errors,
      genesisHash: this.genesisHash,
      latestHash: this.lastHash,
      rotations: this.rotations,
      coherence: errors.length === 0 ? 1.0 : Math.max(CSL.MINIMUM, 1.0 - errors.length * 0.1),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Query chronicle by various criteria
   * @param {object} query — { actor, action, type, since, until, limit }
   * @returns {Array} — matching blocks
   */
  query(query) {
    const {
      actor,
      action,
      type,
      since,
      until,
      limit = FIB[8]
    } = query;
    let results = [...this.chain];
    if (actor) results = results.filter(b => b.actor === actor);
    if (action) results = results.filter(b => b.action === action);
    if (type) results = results.filter(b => b.type === type);
    if (since) results = results.filter(b => b.timestamp >= since);
    if (until) results = results.filter(b => b.timestamp <= until);
    return results.slice(-limit);
  }

  /** Generate a trust receipt for a recorded block */
  _generateReceipt(block) {
    this.stats.receiptsIssued++;
    const receiptData = `${block.index}:${block.hash}:${block.timestamp}:${this.nodeId}`;
    const receiptHash = this._hash(receiptData);
    return {
      receiptId: `rcpt-${block.index}-${block.timestamp.toString(36)}`,
      blockIndex: block.index,
      blockHash: block.hash,
      receiptHash,
      issuer: this.nodeId,
      issuedAt: Date.now(),
      chainLength: this.chain.length,
      rotations: this.rotations
    };
  }

  /** Rotate chain when it exceeds max length */
  _rotateChain() {
    const summary = {
      rotationIndex: this.rotations,
      chainLength: this.chain.length,
      firstBlockTimestamp: this.chain[0].timestamp,
      lastBlockTimestamp: this.chain[this.chain.length - 1].timestamp,
      lastHash: this.lastHash,
      rotatedAt: Date.now()
    };

    // Keep last FIB[8] blocks as overlap
    const retained = this.chain.slice(-FIB[8]);
    this.chain = retained;
    this.rotations++;
    this.stats.rotations++;

    // Record rotation event
    this.record({
      type: 'rotation',
      actor: 'CHRONICLE',
      action: 'chain-rotated',
      data: summary,
      severity: CSL.MEDIUM
    });
    this._log('info', 'chain-rotated', {
      rotationIndex: this.rotations,
      retainedBlocks: retained.length
    });
  }

  /** SHA-256 hash */
  _hash(data) {
    return crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
  }

  /** Hash a block deterministically */
  _hashBlock(block) {
    const content = `${block.index}:${block.timestamp}:${block.type}:${block.actor}:${block.action}:${JSON.stringify(block.data)}:${block.previousHash}`;
    return this._hash(content);
  }
  _calculateCoherence() {
    const verifyResult = this.chain.length > 1 ? (() => {
      for (let i = 1; i < Math.min(this.chain.length, FIB[8]); i++) {
        if (this.chain[i].previousHash !== this.chain[i - 1].hash) return 0.5;
      }
      return 1.0;
    })() : 1.0;
    return verifyResult;
  }
  async start() {
    this.state = 'RECORDING';
    this._log('info', 'chronicle-started', {
      chainLength: this.chain.length,
      maxLength: this.maxChainLength
    });
    return this;
  }
  async stop() {
    this.state = 'STOPPED';
    this._log('info', 'chronicle-stopped', {
      stats: this.stats,
      chainLength: this.chain.length
    });
  }
  health() {
    return {
      status: 'ok',
      nodeId: this.nodeId,
      ring: this.ring,
      state: this.state,
      coherence: this._calculateCoherence(),
      stats: {
        ...this.stats
      },
      chainLength: this.chain.length,
      latestHash: this.lastHash ? this.lastHash.slice(0, 16) + '...' : null,
      rotations: this.rotations,
      timestamp: new Date().toISOString()
    };
  }
  _log(level, event, data = {}) {
    logger.info(JSON.stringify({
      level,
      event,
      node: this.nodeId,
      ring: this.ring,
      correlationId: this._correlationId,
      ...data,
      ts: new Date().toISOString()
    }));
  }
}
module.exports = {
  ChronicleNode
};
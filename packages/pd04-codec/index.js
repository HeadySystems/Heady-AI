// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  PD04 Codec — 3D Vector Data Encoding/Decoding                  ║
// ║  Hyper-Modular 7-Level Architecture for Spatial Intelligence     ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
// PD04 Codec Constants
// ═══════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// 7-Level Modularity Hierarchy
const LEVELS = Object.freeze({
  GALAXY:     0, // Domain modularity
  HOUSE:      1, // Execution context
  ROOM:       2, // Organizational modularity
  NODE:       3, // Atomic knowledge
  PROCEDURE:  4, // Executable modularity (RPN)
  OPERATION:  5, // Primitive modularity (stack ops)
  PTX_KERNEL: 6, // Execution modularity
});

const LEVEL_NAMES = ['galaxy', 'house', 'room', 'node', 'procedure', 'operation', 'ptx_kernel'];

// Ternary Logic System {-1, 0, +1}
const TERNARY = Object.freeze({
  NEG: -1,
  ZERO: 0,
  POS: 1,
});

// ═══════════════════════════════════════════════════════════════════
// 3D Vector Operations
// ═══════════════════════════════════════════════════════════════════

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  scale(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }
  magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  normalize() {
    const m = this.magnitude();
    return m > 0 ? this.scale(1 / m) : new Vec3();
  }
  distance(v) { return this.sub(v).magnitude(); }
  toArray() { return [this.x, this.y, this.z]; }
  toTernary() {
    return new Vec3(
      Math.sign(this.x) || 0,
      Math.sign(this.y) || 0,
      Math.sign(this.z) || 0,
    );
  }

  static fromArray(arr) { return new Vec3(arr[0] || 0, arr[1] || 0, arr[2] || 0); }
  static random() { return new Vec3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(); }
}

// ═══════════════════════════════════════════════════════════════════
// Ternary Logic Operations (6 GPU-analogous ops)
// ═══════════════════════════════════════════════════════════════════

const TernaryOps = {
  // Ternary addition: clamp to {-1, 0, +1}
  tadd(a, b) { return Math.max(-1, Math.min(1, a + b)); },

  // Ternary multiplication
  tmul(a, b) { return a * b; },

  // Ternary NOT: -a
  tnot(a) { return -a; },

  // Ternary compare: returns ordering
  tcomp(a, b) { return Math.sign(a - b); },

  // Ternary quantize: float → ternary
  tquant(f, threshold = PSI) {
    if (f > threshold) return 1;
    if (f < -threshold) return -1;
    return 0;
  },

  // Pack 16 trits into a single 32-bit integer (16× memory reduction)
  tpack(trits) {
    let packed = 0;
    for (let i = 0; i < Math.min(trits.length, 16); i++) {
      packed |= ((trits[i] + 1) & 0x3) << (i * 2);
    }
    return packed;
  },

  // Unpack 32-bit integer back to trits
  tunpack(packed, count = 16) {
    const trits = [];
    for (let i = 0; i < count; i++) {
      trits.push(((packed >> (i * 2)) & 0x3) - 1);
    }
    return trits;
  },
};

// ═══════════════════════════════════════════════════════════════════
// PD04 Codec: Encode/Decode 3D Vector Data Packets
// ═══════════════════════════════════════════════════════════════════

class PD04Codec {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.resonanceSignature = options.resonanceSignature || [3, 6, 9, 1, 5, 7, 2, 4, 8];
  }

  // Encode a data payload into a PD04 vector packet
  encode(payload) {
    const {
      level = LEVELS.NODE,
      position = new Vec3(),
      intent = '',
      data = {},
      domain = 'general',
    } = payload;

    const timestamp = Date.now();
    const hash = this._hashPayload(intent, data, timestamp);

    // Compute ternary intent vector from content hash
    const intentVector = this._intentToTernaryVector(intent);

    // Embed resonance watermark (369-157-248)
    const watermark = this._embedWatermark(hash);

    return {
      pd04: this.version,
      timestamp,
      level,
      levelName: LEVEL_NAMES[level],
      domain,
      position: position.toArray(),
      intentVector: intentVector.toArray(),
      ternaryPacked: TernaryOps.tpack(intentVector.toArray().map(v => TernaryOps.tquant(v))),
      watermark,
      hash,
      data,
      intent,
    };
  }

  // Decode a PD04 packet back to structured data
  decode(packet) {
    if (!packet.pd04) throw new Error('Not a PD04 packet');

    return {
      level: packet.level,
      levelName: packet.levelName,
      domain: packet.domain,
      position: Vec3.fromArray(packet.position),
      intentVector: Vec3.fromArray(packet.intentVector),
      ternaryIntent: TernaryOps.tunpack(packet.ternaryPacked, 3),
      watermarkValid: this._verifyWatermark(packet.hash, packet.watermark),
      data: packet.data,
      intent: packet.intent,
      timestamp: packet.timestamp,
    };
  }

  // Compute spatial distance between two packets
  distance(packetA, packetB) {
    const posA = Vec3.fromArray(packetA.position);
    const posB = Vec3.fromArray(packetB.position);
    return posA.distance(posB);
  }

  // Find nearest packet in a collection
  nearest(target, packets) {
    let best = null;
    let bestDist = Infinity;
    for (const p of packets) {
      const d = this.distance(target, p);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return { packet: best, distance: bestDist };
  }

  // ─── Internal Methods ────────────────────────────────────────────

  _hashPayload(intent, data, timestamp) {
    return crypto
      .createHash('sha256')
      .update(`${intent}:${JSON.stringify(data)}:${timestamp}`)
      .digest('hex')
      .substring(0, 16);
  }

  _intentToTernaryVector(intent) {
    if (!intent) return new Vec3();
    const hash = crypto.createHash('md5').update(intent).digest();
    return new Vec3(
      (hash[0] / 128) - 1,
      (hash[1] / 128) - 1,
      (hash[2] / 128) - 1,
    );
  }

  _embedWatermark(hash) {
    // 369-157-248 resonance watermark
    const sig = this.resonanceSignature;
    let watermark = 0;
    for (let i = 0; i < sig.length && i < hash.length; i++) {
      watermark ^= parseInt(hash[i], 16) * sig[i];
    }
    return watermark & 0xFFFFFF;
  }

  _verifyWatermark(hash, watermark) {
    return this._embedWatermark(hash) === watermark;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  PD04Codec,
  Vec3,
  TernaryOps,
  LEVELS,
  LEVEL_NAMES,
  TERNARY,
};

'use strict';
// Stub phi-scales for VSA
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const scales = (n) => Array(n).fill(0).map((_, i) => Math.pow(PSI, i));
module.exports = { PHI, PSI, scales, phiScales: scales };

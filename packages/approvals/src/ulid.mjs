// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval ULID v1.0.0                                    ║
// ║  Dependency-free Crockford ULIDs with injectable clock/entropy.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_CHARS = 10;
const RANDOM_BYTES = 10;
const RANDOM_CHARS = 16;
const MAX_TIME = 281_474_976_710_655;

function encodeTime(time) {
  if (!Number.isSafeInteger(time) || time < 0 || time > MAX_TIME) {
    throw new RangeError("ULID timestamp must be a non-negative 48-bit integer");
  }
  let value = time;
  let output = "";
  for (let index = 0; index < TIME_CHARS; index += 1) {
    output = ALPHABET[value % ALPHABET.length] + output;
    value = Math.floor(value / ALPHABET.length);
  }
  return output;
}

function encodeRandom(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== RANDOM_BYTES) {
    throw new TypeError(`ULID entropy must be exactly ${RANDOM_BYTES} bytes`);
  }
  let value = BigInt(`0x${bytes.toString("hex")}`);
  let output = "";
  const radix = BigInt(ALPHABET.length);
  for (let index = 0; index < RANDOM_CHARS; index += 1) {
    output = ALPHABET[Number(value % radix)] + output;
    value /= radix;
  }
  return output;
}

export function createUlid({
  now = () => Date.now(),
  entropy = () => randomBytes(RANDOM_BYTES),
} = {}) {
  return `${encodeTime(now())}${encodeRandom(entropy())}`;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Steganography Packer v2.0.0                              ║
// ║  Variable Bit/Nibble Length MIDI Data Slicer                     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Converts a string into an array of 7-bit MIDI-safe bytes using 
 * variable bit-length slicing based on a repeating sequence key.
 */
export function pack(dataString, keySequence) {
  // Convert string to continuous binary string (8 bits per char)
  let binaryStr = '';
  for (let i = 0; i < dataString.length; i++) {
    binaryStr += dataString.charCodeAt(i).toString(2).padStart(8, '0');
  }

  const midiBytes = [];
  let keyIndex = 0;
  let bitIndex = 0;

  while (bitIndex < binaryStr.length) {
    const k = keySequence[keyIndex % keySequence.length];
    // Take up to K bits
    let chunk = binaryStr.slice(bitIndex, bitIndex + k);
    // If chunk is smaller than K (end of string), pad right with 0s
    if (chunk.length < k) {
      chunk = chunk.padEnd(k, '0');
    }
    // Parse the binary chunk to an integer. Will always be <= 127 because max K is 7.
    midiBytes.push(parseInt(chunk, 2));
    bitIndex += k;
    keyIndex++;
  }

  return midiBytes;
}

/**
 * Converts an array of 7-bit MIDI bytes back into the original string 
 * using the same variable bit-length key.
 */
export function unpack(midiBytes, keySequence) {
  let binaryStr = '';
  let keyIndex = 0;

  for (const byte of midiBytes) {
    const k = keySequence[keyIndex % keySequence.length];
    binaryStr += byte.toString(2).padStart(k, '0');
    keyIndex++;
  }

  let resultStr = '';
  for (let i = 0; i < binaryStr.length; i += 8) {
    const charBin = binaryStr.slice(i, i + 8);
    if (charBin.length === 8) {
      resultStr += String.fromCharCode(parseInt(charBin, 2));
    }
  }

  // Trim trailing nulls padding
  return resultStr.replace(/\0+$/, '');
}

// In-file verification self-test
const testStr = "HEADY-OS-SECRET";
const testKey = [3, 5, 2, 7, 4];
const packed = pack(testStr, testKey);
const unpacked = unpack(packed, testKey);

if (unpacked !== testStr) {
  throw new Error(`Steganography Packer verification failed. Expected ${testStr}, got ${unpacked}`);
}

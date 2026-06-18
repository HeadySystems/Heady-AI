// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MIDI-Bus — Frame Codec v1.0.0                             ║
// ║  Encodes/decodes Heady internal messages as real MIDI byte frames. ║
// ║  Channel-voice messages (note/control/program) carry control       ║
// ║  signals; SysEx carries bulk data injection (decomposed file/doc    ║
// ║  payloads, 7-bit-safe so arbitrary bytes survive). Output is a      ║
// ║  Uint8Array — wire-ready for ANY transport (in-process today,       ║
// ║  UDP/QUIC later) without changing producers or consumers.          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { ValidationError } from "@heady/shared";

// MIDI status high-nibbles (channel-voice) + system bytes. Real MIDI values.
export const MSG = Object.freeze({
  NOTE_OFF: 0x8, // deactivate a unit (bee/swarm)
  NOTE_ON: 0x9, // activate / inject a unit; data2 = priority (velocity)
  CONTROL: 0xb, // operating-parameter update; data1 = param, data2 = value
  PROGRAM: 0xc, // switch active mode/config; data1 = program
});
export const SYSTEM = Object.freeze({
  SYSEX_START: 0xf0,
  SYSEX_END: 0xf7,
  CLOCK: 0xf8, // heartbeat
});
// Real MIDI "non-commercial / educational" manufacturer id — the sanctioned
// SysEx namespace for in-house use. Tags every Heady bulk frame.
export const HEADY_SYSEX_ID = 0x7d;

const MAX_CHANNEL = 0x0f; // 16 channels, like MIDI
const MAX_7BIT = 0x7f;

function assert7bit(name, v) {
  if (!Number.isInteger(v) || v < 0 || v > MAX_7BIT)
    throw new ValidationError(`${name} must be a 7-bit integer (0..127)`, { value: v });
}
function assertChannel(ch) {
  if (!Number.isInteger(ch) || ch < 0 || ch > MAX_CHANNEL)
    throw new ValidationError("channel must be 0..15", { value: ch });
}

/** Pack arbitrary 8-bit bytes into 7-bit-safe groups (canonical MIDI SysEx 8→7). */
export function to7bit(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 7) {
    const group = bytes.slice(i, i + 7);
    let msb = 0;
    for (let j = 0; j < group.length; j += 1) msb |= ((group[j] >> 7) & 1) << j;
    out.push(msb & MAX_7BIT);
    for (let j = 0; j < group.length; j += 1) out.push(group[j] & MAX_7BIT);
  }
  return out;
}

/** Inverse of to7bit — recover the original 8-bit bytes. */
export function from7bit(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    const msb = bytes[i];
    i += 1;
    for (let j = 0; j < 7 && i < bytes.length; j += 1) {
      out.push((bytes[i] & MAX_7BIT) | (((msb >> j) & 1) << 7));
      i += 1;
    }
  }
  return out;
}

/**
 * Encode a frame object into a MIDI byte sequence (Uint8Array).
 * Frame shapes:
 *  { type:'note-on'|'note-off', channel, data1, data2 }
 *  { type:'control', channel, data1, data2 }
 *  { type:'program', channel, data1 }
 *  { type:'clock' }
 *  { type:'sysex', channel, payload:Uint8Array|number[] }
 */
export function encodeFrame(frame) {
  if (!frame || typeof frame !== "object") throw new ValidationError("frame object required");
  switch (frame.type) {
    case "note-on":
    case "note-off": {
      assertChannel(frame.channel);
      assert7bit("data1", frame.data1);
      assert7bit("data2", frame.data2 ?? 0);
      const hi = frame.type === "note-on" ? MSG.NOTE_ON : MSG.NOTE_OFF;
      return Uint8Array.from([(hi << 4) | frame.channel, frame.data1, frame.data2 ?? 0]);
    }
    case "control": {
      assertChannel(frame.channel);
      assert7bit("data1", frame.data1);
      assert7bit("data2", frame.data2);
      return Uint8Array.from([(MSG.CONTROL << 4) | frame.channel, frame.data1, frame.data2]);
    }
    case "program": {
      assertChannel(frame.channel);
      assert7bit("data1", frame.data1);
      return Uint8Array.from([(MSG.PROGRAM << 4) | frame.channel, frame.data1]);
    }
    case "clock":
      return Uint8Array.from([SYSTEM.CLOCK]);
    case "sysex": {
      assertChannel(frame.channel);
      const payload = frame.payload instanceof Uint8Array ? Array.from(frame.payload) : (frame.payload ?? []);
      return Uint8Array.from([SYSTEM.SYSEX_START, HEADY_SYSEX_ID, frame.channel, ...to7bit(payload), SYSTEM.SYSEX_END]);
    }
    default:
      throw new ValidationError("unknown frame type", { type: frame.type });
  }
}

/** Decode a MIDI byte sequence back into a frame object. */
export function decodeFrame(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (b.length === 0) throw new ValidationError("empty frame");
  const status = b[0];

  if (status === SYSTEM.CLOCK) return { type: "clock" };
  if (status === SYSTEM.SYSEX_START) {
    if (b[1] !== HEADY_SYSEX_ID) throw new ValidationError("foreign SysEx id", { id: b[1] });
    const end = b[b.length - 1] === SYSTEM.SYSEX_END ? b.length - 1 : b.length;
    const channel = b[2];
    const payload = Uint8Array.from(from7bit(Array.from(b.slice(3, end))));
    return { type: "sysex", channel, payload };
  }

  const hi = status >> 4;
  const channel = status & 0x0f;
  switch (hi) {
    case MSG.NOTE_ON:
      return { type: "note-on", channel, data1: b[1], data2: b[2] };
    case MSG.NOTE_OFF:
      return { type: "note-off", channel, data1: b[1], data2: b[2] };
    case MSG.CONTROL:
      return { type: "control", channel, data1: b[1], data2: b[2] };
    case MSG.PROGRAM:
      return { type: "program", channel, data1: b[1] };
    default:
      throw new ValidationError("unknown status byte", { status });
  }
}

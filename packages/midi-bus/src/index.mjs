// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MIDI-Bus v1.0.0 — internal messaging façade               ║
// ║  The "instantaneous data injection" channel: HeadyBee/HeadySwarm   ║
// ║  units and subsystems exchange compact MIDI frames over a          ║
// ║  swappable transport. inject() fires a unit, control() pushes an   ║
// ║  operating-parameter update, injectData() streams a decomposed     ║
// ║  file/doc payload via SysEx — all transport-agnostic.              ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { ValidationError } from "@heady/shared";
import { encodeFrame, decodeFrame, to7bit, from7bit, MSG, SYSTEM, HEADY_SYSEX_ID } from "./codec.mjs";
import { InProcessTransport, EventBusTransport } from "./transport.mjs";

export { encodeFrame, decodeFrame, to7bit, from7bit, MSG, SYSTEM, HEADY_SYSEX_ID };
export { InProcessTransport, EventBusTransport };

// Subsystem → channel map (extensible, 0..15). Names the MIDI channels so a
// frame's channel is self-describing across the system.
export const CHANNEL = Object.freeze({
  EMBED: 0,
  AWARENESS: 1,
  CONSISTENCY: 2,
  DECOMPOSITION: 3,
  PROJECTION: 4,
  SWARM: 5,
  GOVERNANCE: 6,
});

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * High-level MIDI bus over any transport. Defaults to in-process loopback.
 * Every send is a real MIDI byte frame; onFrame decodes inbound bytes.
 */
export class MidiBus {
  constructor(transport = new InProcessTransport()) {
    if (!transport || typeof transport.send !== "function" || typeof transport.onMessage !== "function")
      throw new ValidationError("transport must implement { send, onMessage }");
    this.transport = transport;
  }

  /** Activate / inject a unit (bee/swarm). priority 0..127 (velocity). */
  inject(channel, unit, priority = 64) {
    return this.transport.send(encodeFrame({ type: "note-on", channel, data1: unit, data2: priority }));
  }

  /** Deactivate a unit. */
  release(channel, unit) {
    return this.transport.send(encodeFrame({ type: "note-off", channel, data1: unit, data2: 0 }));
  }

  /** Push an operating-parameter update. param/value 0..127. */
  control(channel, param, value) {
    return this.transport.send(encodeFrame({ type: "control", channel, data1: param, data2: value }));
  }

  /** Switch active mode/config on a channel. */
  program(channel, mode) {
    return this.transport.send(encodeFrame({ type: "program", channel, data1: mode }));
  }

  /** Heartbeat. */
  clock() {
    return this.transport.send(encodeFrame({ type: "clock" }));
  }

  /** Stream a bulk binary payload (decomposed file/doc chunk) via SysEx. */
  injectData(channel, payloadBytes) {
    return this.transport.send(encodeFrame({ type: "sysex", channel, payload: payloadBytes }));
  }

  /** Convenience: inject a JSON object as a SysEx payload (decompose → inject). */
  injectJson(channel, obj) {
    return this.injectData(channel, enc.encode(JSON.stringify(obj)));
  }

  /** Subscribe to decoded inbound frames. Returns an unsubscribe function. */
  onFrame(handler) {
    if (typeof handler !== "function") throw new ValidationError("handler must be a function");
    return this.transport.onMessage((bytes) => handler(decodeFrame(bytes)));
  }

  /** Subscribe to SysEx payloads decoded back into JSON objects. */
  onJson(handler) {
    return this.onFrame((frame) => {
      if (frame.type === "sysex") handler(JSON.parse(dec.decode(frame.payload)), frame);
    });
  }
}

/** Factory: MIDI bus riding the @heady/events spine. */
export function eventBusMidi(bus, subject) {
  return new MidiBus(new EventBusTransport({ bus, subject }));
}

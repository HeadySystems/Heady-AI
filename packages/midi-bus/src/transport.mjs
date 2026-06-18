// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MIDI-Bus — Transports v1.0.0                              ║
// ║  The transport seam that makes "MIDI now, UDP later" real: every   ║
// ║  transport is { send(bytes), onMessage(handler) }. Producers and   ║
// ║  consumers speak MIDI frames; swapping the wire changes nothing.    ║
// ║                                                                    ║
// ║   • InProcessTransport — loopback, zero-dependency (works today).   ║
// ║   • EventBusTransport  — rides @heady/events (works today, joins    ║
// ║     the existing in-memory/NATS spine).                             ║
// ║   • UDP/QUIC transport — a future adapter implementing the SAME     ║
// ║     interface; it is NOT stubbed here (a non-functional stub would  ║
// ║     violate AGENTS.md #3). Build it as its own module when the      ║
// ║     edge/datagram target is chosen; nothing above it changes.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { ValidationError } from "@heady/shared";

/**
 * Loopback transport: delivers each sent frame to every registered handler.
 * Delivery is async (microtask) so a sender never re-enters a handler inline.
 */
export class InProcessTransport {
  constructor() { this.handlers = new Set(); }
  send(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    for (const h of this.handlers) queueMicrotask(() => h(b));
    return { delivered: this.handlers.size };
  }
  onMessage(handler) {
    if (typeof handler !== "function") throw new ValidationError("handler must be a function");
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

/**
 * Event-bus transport: carries MIDI frames as payloads on a single subject of
 * the @heady/events bus, so MIDI traffic shares the existing observable spine.
 * Bytes travel as a plain number[] in the envelope payload (JSON-safe).
 */
export class EventBusTransport {
  constructor({ bus, subject = "heady.midi.frame" } = {}) {
    if (!bus || typeof bus.publish !== "function" || typeof bus.subscribe !== "function")
      throw new ValidationError("EventBusTransport requires a @heady/events bus");
    this.bus = bus;
    this.subject = subject;
  }
  send(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    return this.bus.publish(this.subject, { midi: Array.from(b) });
  }
  onMessage(handler) {
    if (typeof handler !== "function") throw new ValidationError("handler must be a function");
    return this.bus.subscribe(this.subject, (event) => {
      const arr = event?.payload?.midi;
      if (Array.isArray(arr)) handler(Uint8Array.from(arr));
    });
  }
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MIDI-Bus — unit tests. `node --test`                     ║
// ║  Proves codec round-trips (incl. arbitrary bytes via 7-bit SysEx), ║
// ║  and that the bus delivers over BOTH transports identically.       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryBus } from "@heady/events";
import {
  encodeFrame, decodeFrame, to7bit, from7bit, CHANNEL, MidiBus, EventBusTransport, InProcessTransport, eventBusMidi,
} from "../src/index.mjs";

test("channel-voice frames round-trip through bytes", () => {
  for (const f of [
    { type: "note-on", channel: CHANNEL.SWARM, data1: 60, data2: 100 },
    { type: "note-off", channel: CHANNEL.SWARM, data1: 60, data2: 0 },
    { type: "control", channel: CHANNEL.EMBED, data1: 7, data2: 127 },
    { type: "program", channel: CHANNEL.PROJECTION, data1: 3 },
    { type: "clock" },
  ]) {
    const bytes = encodeFrame(f);
    assert.ok(bytes instanceof Uint8Array, "encodes to bytes (wire-ready)");
    assert.deepEqual(decodeFrame(bytes), f.type === "program"
      ? { type: "program", channel: f.channel, data1: f.data1 }
      : f.type === "clock" ? { type: "clock" }
      : { type: f.type, channel: f.channel, data1: f.data1, data2: f.data2 });
  }
});

test("7-bit packing round-trips ARBITRARY 8-bit bytes (high bits survive)", () => {
  const raw = Uint8Array.from([0, 1, 127, 128, 200, 255, 0xde, 0xad, 0xbe, 0xef]);
  const packed = to7bit(Array.from(raw));
  assert.ok(packed.every((b) => b <= 0x7f), "packed bytes are all 7-bit safe");
  assert.deepEqual(Uint8Array.from(from7bit(packed)), raw);
});

test("SysEx carries an arbitrary binary payload intact", () => {
  const payload = Uint8Array.from([0xf0, 0x00, 0xff, 0x7f, 0x80, 42]); // includes bytes >127 and a fake status byte
  const bytes = encodeFrame({ type: "sysex", channel: CHANNEL.DECOMPOSITION, payload });
  assert.equal(bytes[0], 0xf0, "starts with SysEx");
  assert.equal(bytes[bytes.length - 1], 0xf7, "ends with SysEx-end");
  const frame = decodeFrame(bytes);
  assert.equal(frame.type, "sysex");
  assert.equal(frame.channel, CHANNEL.DECOMPOSITION);
  assert.deepEqual(frame.payload, payload);
});

test("invalid frames fail closed", () => {
  assert.throws(() => encodeFrame({ type: "note-on", channel: 99, data1: 1, data2: 1 }), /channel/);
  assert.throws(() => encodeFrame({ type: "control", channel: 0, data1: 200, data2: 0 }), /7-bit/);
  assert.throws(() => encodeFrame({ type: "bogus" }), /unknown frame/);
  assert.throws(() => decodeFrame(Uint8Array.from([0xf0, 0x01, 0x00])), /foreign SysEx/);
});

test("MidiBus delivers control frames over InProcessTransport", async () => {
  const bus = new MidiBus(new InProcessTransport());
  const seen = [];
  bus.onFrame((f) => seen.push(f));
  bus.control(CHANNEL.EMBED, 10, 99);
  await new Promise((r) => queueMicrotask(r));
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { type: "control", channel: CHANNEL.EMBED, data1: 10, data2: 99 });
});

test("MidiBus injects a decomposed JSON doc over the @heady/events spine", async () => {
  const eventBus = new InMemoryBus();
  const midi = eventBusMidi(eventBus, "heady.midi.test");
  const received = [];
  midi.onJson((obj) => received.push(obj));
  await midi.injectJson(CHANNEL.DECOMPOSITION, { docId: "compendium/01", chunk: 3, text: "φ=1.618…" });
  assert.equal(received.length, 1);
  assert.equal(received[0].docId, "compendium/01");
  assert.equal(received[0].text, "φ=1.618…", "unicode payload survived the 7-bit SysEx round-trip");
});

test("the same producer code works on a different transport (swap proof)", async () => {
  // Identical MidiBus calls, two different wires → identical decoded result.
  const out = {};
  for (const [label, t] of [["inproc", new InProcessTransport()], ["eventbus", new EventBusTransport({ bus: new InMemoryBus() })]]) {
    const midi = new MidiBus(t);
    const got = [];
    midi.onFrame((f) => got.push(f));
    midi.inject(CHANNEL.SWARM, 64, 120);
    await new Promise((r) => queueMicrotask(r));
    out[label] = got;
  }
  assert.deepEqual(out.inproc, out.eventbus, "transport swap does not change producer/consumer behavior");
});

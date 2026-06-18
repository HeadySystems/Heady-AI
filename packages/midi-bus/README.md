# @heady/midi-bus

Heady's internal **MIDI-style messaging** layer — compact, typed, low-latency frames for
HeadyBee/HeadySwarm units and subsystems to exchange control signals and **inject data
instantaneously**, over a **swappable transport**.

The design answer to *"do the internal protocol in MIDI now, move it to UDP later"*: the
**protocol** (MIDI byte frames) and the **transport** (the wire) are separate. Producers and
consumers only ever speak MIDI frames. Changing the wire changes nothing above it.

## Why MIDI

MIDI is a real, battle-tested, compact event protocol: a status byte (message type + channel)
plus data bytes, and **SysEx** for variable-length bulk payloads. It maps cleanly onto Heady's
internal traffic and is just bytes — so it is wire-ready for any transport.

| MIDI message | Heady meaning |
|---|---|
| `NOTE_ON` / `NOTE_OFF` | activate / deactivate a unit (bee/swarm); velocity = priority |
| `CONTROL_CHANGE` | operating-parameter update (`param`, `value`) |
| `PROGRAM_CHANGE` | switch active mode/config |
| `CLOCK` | heartbeat |
| `SYSEX` | **bulk data injection** — a decomposed file/doc chunk (7-bit-safe, so arbitrary bytes/UTF-8 survive) |

Channels (0–15) name subsystems: `EMBED, AWARENESS, CONSISTENCY, DECOMPOSITION, PROJECTION, SWARM, GOVERNANCE`.

## Transports (the swap seam)

Every transport implements the same interface: `{ send(bytes), onMessage(handler) }`.

- **`InProcessTransport`** — loopback, zero-dependency. Works today.
- **`EventBusTransport`** — rides `@heady/events`, joining the existing in-memory/NATS spine
  (and therefore HeadyLens observability). Works today.
- **UDP / QUIC transport** — a *future* adapter implementing the same interface. It is
  deliberately **not stubbed** here: a non-functional placeholder would violate AGENTS.md #3
  (no dead-end code). When the edge/datagram target is chosen, add it as its own module — every
  `MidiBus` caller keeps working unchanged. (Cloud-deployed only; the transport reads its
  endpoint from env/secret-manager, never a hardcoded host.)

## Usage

```js
import { MidiBus, eventBusMidi, CHANNEL } from "@heady/midi-bus";
import { InMemoryBus } from "@heady/events";

// in-process
const midi = new MidiBus();
midi.onJson((doc) => applyDecomposedChunk(doc));
midi.injectJson(CHANNEL.DECOMPOSITION, { docId: "compendium/01", chunk: 3, text: "…" });

// over the event spine (observable via HeadyLens)
const wired = eventBusMidi(new InMemoryBus());
wired.control(CHANNEL.EMBED, /* param */ 7, /* value */ 127);
```

## Tests

`pnpm --filter @heady/midi-bus test` — codec round-trips (incl. arbitrary 8-bit bytes through
7-bit SysEx), fail-closed validation, and a **transport-swap proof** (identical producer code on
two wires yields identical decoded frames).

© 2026 HeadySystems Inc. — Eric Haywood, Founder

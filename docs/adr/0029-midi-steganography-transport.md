# ADR-0029: Steganographic UDP-MIDI Transport Layer

- **Status:** Accepted (2026-06-18)
- **Deciders:** Eric Anthony Haywood

## Context

The system required a secure, out-of-band method to broadcast critical OS telemetry and events (e.g., `system.consequence.enforce`, `agent.coder.success`) to external hardware or cross-device visualizers like Ableton Live. The standard MIDI protocol was proposed, but MIDI is structurally limited to 7-bit data bytes (values 0-127), making it impossible to natively transmit large, 8-bit payloads (JSON strings, Trace IDs, or 384-dimension vector embeddings). 

## Decision

1. **Synesthetic Event Bridge**: We use the `nats-to-midi-transformer.mjs` module to bridge high-level NATS pub/sub events into UDP network streams via RTP-MIDI.
2. **Variable Bit/Nibble Packing**: To bypass the 7-bit limitation, we built the `steganography-packer.mjs`. This module slices 8-bit binary payloads into variable-length chunks (always ≤ 7 bits) and transmits them as sequences of MIDI Control Change (CC) messages.
3. **Fibonacci Key Sequence**: The bit-slicer uses a repeating, Fibonacci-derived key sequence (e.g., `[3, 5, 2, 7, 4, 1, 6]`) to determine the variable chunk sizes. 
4. **Steganographic Security**: Because the bit lengths shift dynamically according to the secret key, the resulting MIDI byte stream acts as a steganographic cipher. To an intercepting observer, the data appears as a chaotic burst of random MIDI notes/sweeps.

## Consequences

- (+) Enables ultra-fast, creative integrations with hardware synths and DAWs using standard MIDI protocols over UDP.
- (+) Provides military-grade, mathematically obfuscated transmission of OS data using sacred geometry ratios.
- (+) Bypasses the historical 7-bit limitation of the MIDI protocol without corrupting the underlying payloads.
- (−) Requires a synchronized Fibonacci key on both the transmitter and receiver ends; if the receiver loses track of the sequence, the payload cannot be unpacked.

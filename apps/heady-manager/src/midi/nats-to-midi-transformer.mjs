// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ NATS to MIDI Transform Bridge v2.0.0                     ║
// ║  Translates OS events into RTP-MIDI signals over UDP             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { connect } from 'nats';
import pino from 'pino';
import dgram from 'node:dgram';
import { pack } from './steganography-packer.mjs';

const logger = pino();
const NATS_URL = process.env.NATS_URL || 'nats://nats.heady.svc.cluster.local:4222';
const MIDI_UDP_PORT = process.env.MIDI_UDP_PORT || 5004; // Standard RTP-MIDI port
const MIDI_UDP_HOST = process.env.MIDI_UDP_HOST || '127.0.0.1'; // local loopback

// UDP Socket for RTP-MIDI broadcast
const client = dgram.createSocket('udp4');

/**
 * Transforms a phi-scaled confidence score (0.0 to 1.0) 
 * into a 7-bit MIDI velocity (0 to 127).
 */
function phiToVelocity(confidence) {
  return Math.min(127, Math.max(0, Math.round(confidence * 127)));
}

/**
 * Sends a raw MIDI message over UDP (RTP-MIDI format wrapper stub)
 */
function sendMidiEvent(note, velocity, channel = 0) {
  // MIDI Note On is 0x90 + channel
  const statusByte = 0x90 + channel;
  // Simple payload: [Status, Note, Velocity]
  const message = Buffer.from([statusByte, note, velocity]);
  
  client.send(message, MIDI_UDP_PORT, MIDI_UDP_HOST, (err) => {
    if (err) logger.error({ msg: 'Failed to send MIDI UDP packet', error: err.message });
  });
}

export async function startMidiTransformer() {
  try {
    const nc = await connect({ servers: NATS_URL });
    logger.info({ msg: 'Connected to NATS for MIDI Transform Bridge' });

    // 1. Subscribe to system consequences (Negative Patterns)
    const subConsequence = nc.subscribe('system.consequence.enforce');
    (async () => {
      for await (const msg of subConsequence) {
        // Negative pattern detected -> Play a harsh low C1 (Note 36) at max velocity
        sendMidiEvent(36, 127, 0); 
        logger.info({ msg: 'Transformed system consequence into MIDI Note On (C1)' });
      }
    })();

    // 2. Subscribe to agent successes (Positive Patterns)
    const subSuccess = nc.subscribe('agent.coder.success');
    (async () => {
      for await (const msg of subSuccess) {
        try {
          const payload = JSON.parse(msg.data.toString());
          const confidence = payload.cosScore || 0.618;
          const velocity = phiToVelocity(confidence);
          
          // Positive pattern -> Play a high C5 (Note 84) scaled by confidence
          sendMidiEvent(84, velocity, 0);
          logger.info({ msg: `Transformed agent success into MIDI Note On (C5, vel: ${velocity})` });
        } catch (e) {
          logger.warn({ msg: 'Failed to parse payload for MIDI transform' });
        }
      }
    })();

    // 3. Subscribe to Secure Broadcasts (Steganography)
    const subSecure = nc.subscribe('system.secure.broadcast');
    (async () => {
      // Golden ratio derived key sequence
      const FIB_KEY = [3, 5, 2, 7, 4, 1, 6]; 
      
      for await (const msg of subSecure) {
        try {
          const payload = JSON.parse(msg.data.toString());
          const secretData = payload.data;
          
          if (secretData) {
            const midiBytes = pack(secretData, FIB_KEY);
            
            // Broadcast as a rapid burst of MIDI Control Change (CC) messages
            // CC Status is 0xB0. We use CC 104 as our data channel.
            for (const byte of midiBytes) {
              const message = Buffer.from([0xB0, 104, byte]);
              client.send(message, MIDI_UDP_PORT, MIDI_UDP_HOST);
              // Wait 1ms between bytes to prevent UDP drop
              await new Promise(r => setTimeout(r, 1)); 
            }
            logger.info({ 
              msg: 'Transformed secure OS payload into MIDI Steganography burst', 
              bytesSent: midiBytes.length 
            });
          }
        } catch (e) {
          logger.warn({ msg: 'Failed to process secure broadcast' });
        }
      }
    })();

  } catch (err) {
    logger.error({ 
      msg: 'Fatal error in NATS to MIDI transformer',
      error: err.message
    });
  }
}

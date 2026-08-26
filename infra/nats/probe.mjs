// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Private NATS Protocol Probe v1.0.0                     ║
// ║  Proves TLS, token rejection, pub/sub, restart, and reconnect.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import tls from "node:tls";

const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = Object.freeze([0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]);
const CONNECT_TIMEOUT_MS = Math.round((PHI ** FIB[5]) * 1000);
const PROTOCOL_TIMEOUT_MS = FIB[8] * 1000;
const RESTART_WINDOW_MS = FIB[12] * 1000;
const MAX_RECONNECT_ATTEMPTS = FIB[8];
const DISCONNECT_HEARTBEAT_MS = Math.round(PHI * 1000);
const CA_PATH = process.env.NATS_CA_PATH ?? "/var/run/secrets/nats/ca.pem";

function writeEvent(event) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), service: "heady-nats-probe", ...event })}\n`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function firstServer(value) {
  const server = value.split(",").map((item) => item.trim()).filter(Boolean)[0];
  const parsed = new URL(server);
  if (parsed.protocol !== "tls:") throw new Error("NATS_SERVERS must use tls://");
  if (parsed.username || parsed.password) throw new Error("NATS_SERVERS must not embed credentials");
  return { host: parsed.hostname, port: Number(parsed.port || "4222"), display: `${parsed.protocol}//${parsed.host}` };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phiBackoffMs(attempt) {
  return Math.round(1000 * (PHI ** attempt));
}

class NatsProtocolClient {
  constructor({ endpoint, token, ca, name }) {
    this.endpoint = endpoint;
    this.token = token;
    this.ca = ca;
    this.name = name;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pendingMessage = null;
    this.waiters = [];
  }

  emit(frame) {
    if (frame.kind === "ping") this.socket?.write("PONG\r\n");
    const retained = [];
    for (const waiter of this.waiters) {
      if (waiter.predicate(frame)) {
        clearTimeout(waiter.timer);
        waiter.resolve(frame);
      } else {
        retained.push(waiter);
      }
    }
    this.waiters = retained;
  }

  parse() {
    for (;;) {
      if (this.pendingMessage) {
        const expected = this.pendingMessage.bytes;
        if (this.buffer.length < expected + 2) return;
        const payload = this.buffer.subarray(0, expected);
        this.buffer = this.buffer.subarray(expected + 2);
        this.emit({ kind: "message", ...this.pendingMessage, payload });
        this.pendingMessage = null;
        continue;
      }
      const boundary = this.buffer.indexOf("\r\n");
      if (boundary < 0) return;
      const line = this.buffer.subarray(0, boundary).toString("utf8");
      this.buffer = this.buffer.subarray(boundary + 2);
      if (line.startsWith("MSG ")) {
        const fields = line.split(" ");
        this.pendingMessage = {
          subject: fields[1],
          sid: fields[2],
          bytes: Number(fields.at(-1)),
        };
      } else if (line.startsWith("INFO ")) {
        this.emit({ kind: "info" });
      } else if (line === "PING") {
        this.emit({ kind: "ping" });
      } else if (line === "PONG") {
        this.emit({ kind: "pong" });
      } else if (line.startsWith("-ERR")) {
        this.emit({ kind: "error", message: line.slice(4).trim() });
      } else if (line === "+OK") {
        this.emit({ kind: "ok" });
      }
    }
  }

  waitFor(predicate, timeoutMs = PROTOCOL_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error(`NATS protocol timeout for ${this.name}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  async connect() {
    const info = this.waitFor((frame) => frame.kind === "info");
    this.socket = tls.connect({
      host: this.endpoint.host,
      port: this.endpoint.port,
      ca: this.ca,
      rejectUnauthorized: true,
      timeout: CONNECT_TIMEOUT_MS,
    });
    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parse();
    });
    this.socket.on("error", (error) => this.emit({ kind: "socket_error", message: error.message }));
    this.socket.on("close", () => this.emit({ kind: "close" }));
    await new Promise((resolve, reject) => {
      this.socket.once("secureConnect", resolve);
      this.socket.once("error", reject);
      this.socket.once("timeout", () => reject(new Error(`TLS connect timeout for ${this.name}`)));
    });
    await info;
    const pong = this.waitFor((frame) => frame.kind === "pong" || frame.kind === "error" || frame.kind === "close");
    this.socket.write(`CONNECT ${JSON.stringify({ verbose: false, pedantic: true, tls_required: true, auth_token: this.token, name: this.name })}\r\nPING\r\n`);
    const frame = await pong;
    if (frame.kind !== "pong") throw new Error(`NATS authentication failed for ${this.name}`);
    return this;
  }

  async subscribe(subject) {
    const pong = this.waitFor((frame) => frame.kind === "pong");
    this.socket.write(`SUB ${subject} 1\r\nPING\r\n`);
    await pong;
  }

  async publish(subject, payload) {
    const data = Buffer.from(payload, "utf8");
    const pong = this.waitFor((frame) => frame.kind === "pong");
    this.socket.write(Buffer.concat([
      Buffer.from(`PUB ${subject} ${data.length}\r\n`, "utf8"),
      data,
      Buffer.from("\r\nPING\r\n", "utf8"),
    ]));
    await pong;
  }

  waitForMessage(subject) {
    return this.waitFor((frame) => frame.kind === "message" && frame.subject === subject);
  }

  async waitForDisconnect() {
    if (!this.socket || this.socket.destroyed) return;
    const deadline = Date.now() + RESTART_WINDOW_MS;
    while (Date.now() < deadline) {
      const frame = this.waitFor(
        (candidate) => candidate.kind === "pong" || candidate.kind === "close" || candidate.kind === "socket_error",
        CONNECT_TIMEOUT_MS,
      );
      this.socket.write("PING\r\n");
      try {
        const observed = await frame;
        if (observed.kind !== "pong") return;
      } catch (error) {
        if (!String(error?.message ?? error).startsWith("NATS protocol timeout for")) throw error;
        return;
      }
      await wait(DISCONNECT_HEARTBEAT_MS);
    }
    throw new Error(`NATS restart was not observed for ${this.name}`);
  }

  cancelWaiters() {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve({ kind: "cancelled" });
    }
    this.waiters = [];
  }

  close() {
    this.cancelWaiters();
    this.socket?.end();
  }
}

async function connectWithRetry(options) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt += 1) {
    const client = new NatsProtocolClient(options);
    try {
      return await client.connect();
    } catch (error) {
      lastError = error;
      client.close();
      await wait(phiBackoffMs(attempt));
    }
  }
  throw lastError;
}

async function assertRejected(endpoint, token, ca) {
  const client = new NatsProtocolClient({ endpoint, token: `${token}-rejected`, ca, name: "heady-nats-rejected-auth" });
  let authRejected = false;
  try {
    await client.connect();
  } catch (error) {
    if (!String(error?.message ?? error).startsWith("NATS authentication failed for")) throw error;
    authRejected = true;
  } finally {
    client.close();
  }
  if (!authRejected) throw new Error("NATS accepted an invalid token");
}

async function roundTrip({ endpoint, token, ca, subject, phase }) {
  const subscriber = await connectWithRetry({ endpoint, token, ca, name: `heady-nats-subscriber-${phase}` });
  await subscriber.subscribe(subject);
  const message = subscriber.waitForMessage(subject);
  const publisher = await connectWithRetry({ endpoint, token, ca, name: `heady-nats-publisher-${phase}` });
  await publisher.publish(subject, JSON.stringify({ phase, traceId: randomUUID() }));
  const received = await message;
  publisher.close();
  const payload = JSON.parse(received.payload.toString("utf8"));
  if (payload.phase !== phase) throw new Error(`unexpected NATS payload phase: ${payload.phase}`);
  return subscriber;
}

async function main() {
  const endpoint = firstServer(requiredEnv("NATS_SERVERS"));
  const token = requiredEnv("NATS_TOKEN");
  const ca = await readFile(CA_PATH);
  const subject = `heady.system.nats.probe.${randomUUID().replaceAll("-", "")}`;

  await assertRejected(endpoint, token, ca);
  writeEvent({ status: "invalid_auth_rejected", endpoint: endpoint.display });

  const subscriber = await roundTrip({ endpoint, token, ca, subject, phase: "before_restart" });
  writeEvent({ status: "round_trip_ok", phase: "before_restart", endpoint: endpoint.display });
  writeEvent({ status: "ready_for_restart", endpoint: endpoint.display });

  await subscriber.waitForDisconnect();
  subscriber.close();
  writeEvent({ status: "disconnect_observed", endpoint: endpoint.display });

  const reconnected = await roundTrip({ endpoint, token, ca, subject, phase: "after_restart" });
  reconnected.close();
  writeEvent({ status: "pass", checks: ["tls", "invalid_auth_rejection", "publish", "subscribe", "disconnect", "reconnect"] });
}

main().catch((error) => {
  writeEvent({ status: "fail", error: String(error?.message ?? error) });
  process.exitCode = 1;
});

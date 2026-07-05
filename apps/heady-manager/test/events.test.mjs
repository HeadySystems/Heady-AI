// heady-manager — SSE event fabric tests. node:test, no extra deps, real HTTP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEALTH } from "@heady/shared";
import { createApp } from "../src/app.mjs";

/**
 * Open /api/events with fetch and collect SSE frames until `predicate(frames)`
 * is satisfied or `timeoutMs` elapses. Frames are returned raw (string per
 * `\n\n`-terminated block) so tests can assert ids, event names, and comments.
 */
async function collectFrames(url, { headers = {}, predicate, timeoutMs = 5000 } = {}) {
  const ctrl = new AbortController();
  const frames = [];
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "text/event-stream", ...headers }, signal: ctrl.signal });
    assert.equal(res.status, 200, "SSE endpoint should answer 200");
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        frames.push(buf.slice(0, nl));
        buf = buf.slice(nl + 2);
      }
      if (predicate && predicate(frames)) {
        ctrl.abort();
        break;
      }
    }
  } catch (err) {
    if (err?.name !== "AbortError" && !ctrl.signal.aborted) throw err;
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
  return frames;
}

const dataOf = (frame) => {
  const m = frame.match(/^data:\s*([\s\S]+)$/m);
  return m ? JSON.parse(m[1]) : null;
};
const eventName = (frame) => frame.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? null;

test("publish → receive live over a real HTTP SSE connection (+ hello bootstrap)", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  const { port } = a.address();
  try {
    const streaming = collectFrames(`http://127.0.0.1:${port}/api/events`, {
      predicate: (frames) => frames.some((f) => eventName(f) === "heady.system.test.ping"),
    });
    // Give the connection a beat to register before publishing the live event.
    await new Promise((r) => setTimeout(r, 200));
    await a.events.publish("heady.system.test.ping", { n: 1 });
    const frames = await streaming;

    const hello = frames.find((f) => eventName(f) === "heady.system.stream.hello");
    assert.ok(hello, "stream opens with a hello bootstrap frame");
    const helloData = dataOf(hello);
    assert.ok(helloData.payload.connections >= 1, "hello reports the live connection count");
    assert.ok(helloData.payload.origin, "hello carries the origin health snapshot");
    assert.equal(typeof helloData.payload.origin.consistencyBus?.loaded, "boolean", "hello carries consistency-bus state");

    const ping = frames.find((f) => eventName(f) === "heady.system.test.ping");
    assert.ok(ping, "live published event is delivered over the open connection");
    const pingData = dataOf(ping);
    assert.equal(pingData.type, "heady.system.test.ping");
    assert.deepEqual(pingData.payload, { n: 1 });
    assert.ok(Number.isInteger(pingData.id) && pingData.id >= 1, "live event carries a ring id");
  } finally {
    await a.stop();
  }
});

test("Last-Event-ID replays buffered events from the ring, in order", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  const { port } = a.address();
  try {
    await a.events.publish("heady.system.test.a", { seq: 1 });
    await a.events.publish("heady.system.test.b", { seq: 2 });
    await a.events.publish("heady.system.test.c", { seq: 3 });

    // Replay everything after id 0 — the whole buffered history.
    const frames = await collectFrames(`http://127.0.0.1:${port}/api/events`, {
      headers: { "last-event-id": "0" },
      predicate: (frames) => frames.some((f) => eventName(f) === "heady.system.stream.hello"),
    });
    const replayed = frames.map(dataOf).filter((d) => d && String(d.type).startsWith("heady.system.test."));
    assert.equal(replayed.length, 3, "all three buffered events replay");
    assert.deepEqual(replayed.map((d) => d.payload.seq), [1, 2, 3], "replay preserves publish order");

    // Replay after the second event's id — only the third comes back.
    const sinceId = replayed[1].id;
    const tail = await collectFrames(`http://127.0.0.1:${port}/api/events?lastEventId=${sinceId}`, {
      predicate: (frames) => frames.some((f) => eventName(f) === "heady.system.stream.hello"),
    });
    const tailReplayed = tail.map(dataOf).filter((d) => d && String(d.type).startsWith("heady.system.test."));
    assert.deepEqual(tailReplayed.map((d) => d.payload.seq), [3], "only events after Last-Event-ID replay");
  } finally {
    await a.stop();
  }
});

test("ring buffer evicts oldest events beyond capacity", async () => {
  const a = createApp({ port: 0, events: { bufferSize: 5 } });
  await a.start();
  const { port } = a.address();
  try {
    for (let seq = 1; seq <= 8; seq += 1) {
      await a.events.publish("heady.system.test.fill", { seq });
    }
    const frames = await collectFrames(`http://127.0.0.1:${port}/api/events?lastEventId=0`, {
      predicate: (frames) => frames.some((f) => eventName(f) === "heady.system.stream.hello"),
    });
    const replayed = frames.map(dataOf).filter((d) => d && d.type === "heady.system.test.fill");
    assert.equal(replayed.length, 5, "only the ring capacity is retained");
    assert.deepEqual(replayed.map((d) => d.payload.seq), [4, 5, 6, 7, 8], "oldest events evicted first");
  } finally {
    await a.stop();
  }
});

test("heartbeat comment frames arrive on the φ-derived beat", async () => {
  const a = createApp({ port: 0, events: { heartbeatMs: 80 } });
  await a.start();
  const { port } = a.address();
  try {
    const frames = await collectFrames(`http://127.0.0.1:${port}/api/events`, {
      predicate: (frames) => frames.some((f) => /^: hb \d+/.test(f)),
      timeoutMs: 3000,
    });
    assert.ok(frames.some((f) => /^: hb \d+/.test(f)), "keep-alive comment frame observed");
  } finally {
    await a.stop();
  }
});

test("/health and /metrics report the fabric; connection cap answers 503", async () => {
  const a = createApp({ port: 0, events: { maxConnections: 1 } });
  await a.start();
  const { port } = a.address();
  const ctrl = new AbortController();
  try {
    // Occupy the single slot.
    const first = await fetch(`http://127.0.0.1:${port}/api/events`, {
      headers: { accept: "text/event-stream" },
      signal: ctrl.signal,
    });
    assert.equal(first.status, 200);
    await new Promise((r) => setTimeout(r, 100));

    const m = await (await fetch(`http://127.0.0.1:${port}/metrics`)).json();
    assert.equal(m.events.connections, 1, "connection-count metric tracks the open stream");
    assert.equal(m.events.maxConnections, 1);
    assert.ok(m.events.bufferSize > 0);

    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(h.checks.events, HEALTH.DEGRADED, "fabric at capacity reports degraded — honestly");

    const second = await fetch(`http://127.0.0.1:${port}/api/events`, { headers: { accept: "text/event-stream" } });
    assert.equal(second.status, 503, "capacity cap refuses the next connection");
    const body = await second.json();
    assert.equal(body.error, "sse_capacity");
  } finally {
    ctrl.abort();
    await a.stop();
  }
});

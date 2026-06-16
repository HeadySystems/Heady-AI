# @heady/events

Typed event bus — subject taxonomy + NATS-style wildcard routing. Transport-agnostic: an in-memory bus now, a NATS adapter (`heady-event-bus`) on the same interface once `nats` installs.

```js
import { SUBJECT, subjectMatches, buildEvent, InMemoryBus, projectOutbox } from "@heady/events";

SUBJECT.observation("task.done");                    // "heady.observation.task.done"
subjectMatches("agent.coder.*", "agent.coder.plan"); // true  (* = one token, > = tail)

const bus = new InMemoryBus();
bus.subscribe("heady.observation.>", (e) => handle(e));
await bus.publish("heady.observation.task.done", { ok: true }, { traceId });
await projectOutbox(rows, bus);                       // publish @heady/db outbox rows by topic
```

Depends on `@heady/shared`. `pnpm --filter @heady/events test`.

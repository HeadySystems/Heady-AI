# @heady/events

Typed event bus — subject taxonomy + NATS-style wildcard routing. `InMemoryBus` is the deterministic test transport; `NatsBus` uses the official NATS v3 Node transport and mirrors received events onto the same local subscription interface for SSE projection.

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

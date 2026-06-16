# @heady/observability

Vendor-neutral metrics + spans. OpenTelemetry (OTLP), Sentry, and Langfuse adapters implement the `exporter` interface on top; the default is a no-op. Trace ids come from `@heady/logger`'s async context.

```js
import { metrics, startSpan, captureError } from "@heady/observability";

metrics.counter("tasks.enqueued").inc();
metrics.gauge("queue.depth").set(12);

const span = startSpan("embed", { kind: "doc" });
// … work …
span.end({ ok: true });            // records span.embed.ms histogram + forwards to exporter
captureError(err, { route: "/tasks" });
metrics.snapshot();                 // { counters, gauges, histograms }
```

Depends on `@heady/logger`. `pnpm --filter @heady/observability test`.

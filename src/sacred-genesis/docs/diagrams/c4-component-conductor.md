# C4 Component Diagram — HeadyConductor

```mermaid
C4Component
    title HeadyConductor — Component View

    Container_Boundary(conductor, "HeadyConductor :3312") {
        Component(classifier, "Intent Classifier", "CSL Engine", "Classifies request domain via cosine similarity")
        Component(router, "Task Router", "Routing Table", "Maps domains to node pools")
        Component(scheduler, "Pool Scheduler", "Fibonacci Pools", "Hot/Warm/Cold resource allocation")
        Component(pipeline, "HCFP Engine", "Pipeline Core", "8-stage full pipeline orchestration")
        Component(saga, "Saga Orchestrator", "Compensation", "Multi-service transaction management")
        Component(health, "Health Probe", "HTTP", "/healthz, /readyz, /metrics")
    }

    Container(soul, "HeadySoul :3310")
    Container(brains, "HeadyBrains :3311")
    Container(vinci, "HeadyVinci :3313")
    Container(nodes, "Execution Nodes", "30+ AI nodes")
    Container(check, "HeadyCheck :3320")
    Container(patterns, "HeadyPatterns :3323")

    Rel(classifier, router, "Classification result")
    Rel(router, scheduler, "Route decision")
    Rel(scheduler, nodes, "Dispatch to pool")
    Rel(pipeline, brains, "Stage 1: Context assembly")
    Rel(pipeline, classifier, "Stage 2: Classification")
    Rel(pipeline, router, "Stage 3: Node selection")
    Rel(pipeline, nodes, "Stage 4: Execution")
    Rel(pipeline, check, "Stage 5: Quality gate")
    Rel(pipeline, patterns, "Stage 7: Pattern capture")
    Rel(saga, nodes, "Compensating actions")
    Rel(classifier, soul, "Values check")
    Rel(router, vinci, "Complex session planning")
```

## Component Descriptions

- **Intent Classifier**: Uses CSL cosine similarity to measure request vectors against domain gate vectors. Threshold levels: CRITICAL (0.927), HIGH (0.882), MEDIUM (0.809), LOW (0.691), MINIMUM (0.500).
- **Task Router**: Maintains a routing table mapping classified domains to node pools. Supports concurrent-equals routing where multiple nodes can handle the same domain.
- **Pool Scheduler**: Allocates requests to Hot (34%), Warm (21%), Cold (13%), Reserve (8%) pools based on urgency and resource availability.
- **HCFP Engine**: Orchestrates the 8-stage HCFullPipeline from context assembly through pattern capture.
- **Saga Orchestrator**: Manages distributed transactions with compensating actions for rollback.
- **Health Probe**: Exposes Kubernetes-compatible health endpoints with circuit breaker state and coherence metrics.

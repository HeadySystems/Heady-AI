/*
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Auto-Success Task Catalog — 598 tasks across 33 categories.
 * Extracted from hc_auto_success.js for maintainability.
 * Categories: learning, optimization, integration, monitoring, maintenance,
 *   discovery, verification, creative, deep-intel, hive-integration,
 *   mop-security, mop-architecture, mop-docs, mop-infrastructure, mop-cicd,
 *   mop-mcp, mop-ai-gateway, mop-performance, mop-auth, mop-sites,
 *   monetization-iaas, monetization-agent, monetization-b2b, dev-acceleration,
 *   subscription-optimization, architecture-fix, autocontext-integration,
 *   autonomy-enhancement, beneficial-bundle, unimplemented-arch, module-health,
 *   event-bus-pipeline, competitive-intel, perpetual-optimization,
 *   coding-mastery, intelligence-training,
 *   devops, trading, documentation, testing, deployment
 */

// ─── EXTERNAL TASK SOURCES ──────────────────────────────────────────────────
let extraTasks = [];
try { extraTasks = require('../auto-flow-tasks.json'); } catch (e) {
  console.warn(`[auto-success-catalog] Failed to load auto-flow-tasks.json: ${e.message}`);
}
let nonprofitTasks = [];
try { nonprofitTasks = require('../nonprofit-tasks.json'); } catch (e) {
  console.warn(`[auto-success-catalog] Failed to load nonprofit-tasks.json: ${e.message}`);
}
let buddyTasks = [];
try { buddyTasks = require('../buddy-tasks.json'); } catch (e) {
  console.warn(`[auto-success-catalog] Failed to load buddy-tasks.json: ${e.message}`);
}
let prodOptTasks = [];
try { prodOptTasks = require('./production-optimization-tasks.json'); } catch (e) {
  console.warn(`[auto-success-catalog] Failed to load production-optimization-tasks.json: ${e.message}`);
}

const TASK_CATALOG = [
    ...extraTasks,
    ...nonprofitTasks,
    ...buddyTasks,
    ...prodOptTasks,
    // ═══ LEARNING (20) — Targeted system learning ═══════════════════════════
    { id: "learn-001", name: "Analyze config drift patterns", cat: "learning", pool: "warm", w: 3, desc: "Compare current configs against historical snapshots to detect drift" },
    { id: "learn-002", name: "Study service dependency graph", cat: "learning", pool: "warm", w: 3, desc: "Map and analyze inter-service dependencies for optimization" },
    { id: "learn-003", name: "Profile API response latencies", cat: "learning", pool: "warm", w: 4, desc: "Collect and analyze response time distributions across endpoints" },
    { id: "learn-004", name: "Review pipeline stage timing", cat: "learning", pool: "warm", w: 3, desc: "Analyze HCFullPipeline stage execution times for bottleneck ID" },
    { id: "learn-005", name: "Index configuration parameters", cat: "learning", pool: "cold", w: 2, desc: "Build searchable index of all YAML config params and relationships" },
    { id: "learn-006", name: "Map node capability matrix", cat: "learning", pool: "warm", w: 3, desc: "Update the capability matrix for all registered Heady nodes" },
    { id: "learn-007", name: "Analyze error frequency distribution", cat: "learning", pool: "warm", w: 4, desc: "Study error patterns to identify systemic vs transient failures" },
    { id: "learn-008", name: "Profile memory allocation patterns", cat: "learning", pool: "warm", w: 3, desc: "Track heap and RSS memory patterns to predict pressure points" },
    { id: "learn-009", name: "Study event bus throughput", cat: "learning", pool: "cold", w: 2, desc: "Measure event emission rates and listener response times" },
    { id: "learn-010", name: "Catalog available integrations", cat: "learning", pool: "cold", w: 2, desc: "Enumerate all integration points and their current utilization" },
    { id: "learn-011", name: "Analyze circuit breaker trip patterns", cat: "learning", pool: "warm", w: 3, desc: "Study which circuit breakers trip most and correlate with conditions" },
    { id: "learn-012", name: "Profile worker pool utilization", cat: "learning", pool: "warm", w: 3, desc: "Measure concurrency saturation across hot/warm/cold pools" },
    { id: "learn-013", name: "Map orchestrator routing decisions", cat: "learning", pool: "cold", w: 2, desc: "Track HCSysOrchestrator routing patterns for optimization paths" },
    { id: "learn-014", name: "Study HeadySims convergence rates", cat: "learning", pool: "warm", w: 3, desc: "Analyze Monte Carlo simulation convergence for strategy tuning" },
    { id: "learn-015", name: "Review self-critique effectiveness", cat: "learning", pool: "cold", w: 2, desc: "Measure if self-critique recommendations lead to improvements" },
    { id: "learn-016", name: "Analyze story driver narrative quality", cat: "learning", pool: "cold", w: 2, desc: "Review generated narratives for coherence and actionability" },
    { id: "learn-017", name: "Profile checkpoint protocol timing", cat: "learning", pool: "warm", w: 3, desc: "Measure checkpoint save/restore times for pipeline resilience" },
    { id: "learn-018", name: "Study task cache hit rates", cat: "learning", pool: "warm", w: 3, desc: "Analyze cache effectiveness and identify wasteful entries" },
    { id: "learn-019", name: "Map brain connector endpoint health", cat: "learning", pool: "warm", w: 4, desc: "Track brain endpoint availability patterns over time" },
    { id: "learn-020", name: "Analyze registry node activation patterns", cat: "learning", pool: "cold", w: 2, desc: "Study which nodes activate together and optimize sequences" },

    // ═══ OPTIMIZATION (20) — Performance tuning ════════════════════════════
    { id: "opt-001", name: "Optimize hot pool task ordering", cat: "optimization", pool: "hot", w: 5, desc: "Reorder hot pool tasks based on learned dependency timing" },
    { id: "opt-002", name: "Tune circuit breaker thresholds", cat: "optimization", pool: "warm", w: 4, desc: "Adjust failure thresholds based on actual error rates" },
    { id: "opt-003", name: "Rebalance worker pool concurrency", cat: "optimization", pool: "warm", w: 4, desc: "Adjust pool sizes based on current resource availability" },
    { id: "opt-004", name: "Compress task cache entries", cat: "optimization", pool: "cold", w: 2, desc: "Remove stale cache entries and compact cache storage" },
    { id: "opt-005", name: "Optimize event listener chains", cat: "optimization", pool: "warm", w: 3, desc: "Profile and streamline eventBus listener execution order" },
    { id: "opt-006", name: "Tune HeadySims cycle parameters", cat: "optimization", pool: "warm", w: 3, desc: "Adjust Monte Carlo parameters based on convergence analysis" },
    { id: "opt-007", name: "Optimize config reload frequency", cat: "optimization", pool: "cold", w: 2, desc: "Balance config freshness against file I/O overhead" },
    { id: "opt-008", name: "Tune pattern engine analysis window", cat: "optimization", pool: "warm", w: 3, desc: "Adjust sliding window sizes for optimal pattern detection" },
    { id: "opt-009", name: "Optimize log rotation schedules", cat: "optimization", pool: "cold", w: 2, desc: "Set rotation based on actual log volume patterns" },
    { id: "opt-010", name: "Tune improvement scheduler interval", cat: "optimization", pool: "warm", w: 3, desc: "Adjust 15-min cycle based on improvement generation rates" },
    { id: "opt-011", name: "Optimize conductor poll frequency", cat: "optimization", pool: "warm", w: 3, desc: "Balance system visibility against poll overhead" },
    { id: "opt-012", name: "Tune brain connector pool size", cat: "optimization", pool: "warm", w: 4, desc: "Adjust connection pool based on brain endpoint patterns" },
    { id: "opt-013", name: "Optimize resource manager poll interval", cat: "optimization", pool: "warm", w: 3, desc: "Balance resource awareness against CPU overhead from polling" },
    { id: "opt-014", name: "Tune safe mode activation thresholds", cat: "optimization", pool: "warm", w: 4, desc: "Prevent premature safe mode while protecting against overload" },
    { id: "opt-015", name: "Optimize pipeline stage parallelism", cat: "optimization", pool: "hot", w: 5, desc: "Increase parallel execution where stages are independent" },
    { id: "opt-016", name: "Tune connectivity pattern retention", cat: "optimization", pool: "cold", w: 2, desc: "Optimize how many connectivity patterns to retain for analysis" },
    { id: "opt-017", name: "Optimize NotebookLM sync batch size", cat: "optimization", pool: "cold", w: 2, desc: "Balance sync completeness against API rate limits" },
    { id: "opt-018", name: "Tune self-critique severity thresholds", cat: "optimization", pool: "warm", w: 3, desc: "Calibrate severity levels to reduce false alarms" },
    { id: "opt-019", name: "Optimize middleware ordering", cat: "optimization", pool: "warm", w: 3, desc: "Profile Express middleware and optimize execution order" },
    { id: "opt-020", name: "Tune rate limiter parameters", cat: "optimization", pool: "warm", w: 3, desc: "Adjust rate limits based on actual traffic patterns" },

    // ═══ INTEGRATION (15) — Cross-system connectivity ═════════════════════
    { id: "int-001", name: "Validate service mesh connectivity", cat: "integration", pool: "warm", w: 4, desc: "Test all inter-service connections and log results" },
    { id: "int-002", name: "Sync registry with active services", cat: "integration", pool: "warm", w: 3, desc: "Ensure heady-registry.json reflects actual availability" },
    { id: "int-003", name: "Verify MCP tool endpoint coverage", cat: "integration", pool: "warm", w: 3, desc: "Confirm all MCP tools have working backend endpoints" },
    { id: "int-004", name: "Test brain API endpoint rotation", cat: "integration", pool: "warm", w: 4, desc: "Verify brain connector failover works correctly" },
    { id: "int-005", name: "Validate Conductor–Lens agreement", cat: "integration", pool: "warm", w: 3, desc: "Compare conductor macro vs lens micro for blind spots" },
    { id: "int-006", name: "Test eventBus producer–consumer chains", cat: "integration", pool: "warm", w: 3, desc: "Verify all eventBus emitters have corresponding listeners" },
    { id: "int-007", name: "Validate pipeline–MC scheduler wiring", cat: "integration", pool: "warm", w: 3, desc: "Confirm pipeline timing data feeds into Monte Carlo" },
    { id: "int-008", name: "Verify pattern engine–self-critique loop", cat: "integration", pool: "warm", w: 3, desc: "Confirm pattern stagnation triggers self-critique" },
    { id: "int-009", name: "Test resource mgr–task scheduler wire", cat: "integration", pool: "warm", w: 3, desc: "Verify safe mode propagates from resource mgr to scheduler" },
    { id: "int-010", name: "Validate story driver event ingestion", cat: "integration", pool: "cold", w: 2, desc: "Confirm all system events route into story narratives" },
    { id: "int-011", name: "Sync HeadyBuddy conversation context", cat: "integration", pool: "cold", w: 2, desc: "Ensure buddy chat has access to current system state" },
    { id: "int-012", name: "Verify NotebookLM audit trail integrity", cat: "integration", pool: "cold", w: 2, desc: "Confirm NotebookLM sync state matches actual operations" },
    { id: "int-013", name: "Test orchestrator multi-brain routing", cat: "integration", pool: "warm", w: 4, desc: "Verify HCSysOrchestrator correctly routes to brain layers" },
    { id: "int-014", name: "Validate HCFP interceptor pipeline", cat: "integration", pool: "warm", w: 4, desc: "Confirm HCFP HeadyBattle interceptor catches events" },
    { id: "int-015", name: "Test auto-task conversion pipeline", cat: "integration", pool: "warm", w: 3, desc: "Verify recommendation events convert to tasks" },

    // ═══ MONITORING (15) — Continuous health tracking ═════════════════════
    { id: "mon-001", name: "Track CPU utilization trend", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor CPU patterns and predict future pressure" },
    { id: "mon-002", name: "Track RAM utilization trend", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor memory patterns and predict OOM risk" },
    { id: "mon-003", name: "Monitor disk usage growth rate", cat: "monitoring", pool: "cold", w: 2, desc: "Track disk consumption and alert on approaching limits" },
    { id: "mon-004", name: "Track service response time SLAs", cat: "monitoring", pool: "hot", w: 5, desc: "Monitor response times against SLA targets" },
    { id: "mon-005", name: "Monitor event bus queue depth", cat: "monitoring", pool: "warm", w: 3, desc: "Track event backlog for early bottleneck detection" },
    { id: "mon-006", name: "Track error rate per service", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor error rates and trigger alerts on anomalies" },
    { id: "mon-007", name: "Monitor node heartbeat freshness", cat: "monitoring", pool: "warm", w: 3, desc: "Track last-seen timestamps for registered nodes" },
    { id: "mon-008", name: "Track pipeline run duration trends", cat: "monitoring", pool: "warm", w: 3, desc: "Monitor pipeline times for degradation detection" },
    { id: "mon-009", name: "Monitor brain endpoint health scores", cat: "monitoring", pool: "warm", w: 4, desc: "Track brain connector health across all endpoints" },
    { id: "mon-010", name: "Track connectivity pattern anomalies", cat: "monitoring", pool: "cold", w: 2, desc: "Detect unusual connectivity patterns in service mesh" },
    { id: "mon-011", name: "Monitor safe mode activation frequency", cat: "monitoring", pool: "warm", w: 3, desc: "Track how often and why safe mode activates" },
    { id: "mon-012", name: "Track pattern engine convergence health", cat: "monitoring", pool: "warm", w: 3, desc: "Monitor whether patterns converge or stagnate" },
    { id: "mon-013", name: "Monitor HeadySims drift frequency", cat: "monitoring", pool: "warm", w: 3, desc: "Track Monte Carlo drift alerts and resolution" },
    { id: "mon-014", name: "Track improvement implementation rate", cat: "monitoring", pool: "cold", w: 2, desc: "Monitor how many improvements get implemented" },
    { id: "mon-015", name: "Monitor continuous pipeline gate health", cat: "monitoring", pool: "warm", w: 3, desc: "Track quality/resource/stability gate pass rates" },

    // ═══ MAINTENANCE (15) — System housekeeping ═══════════════════════════
    { id: "maint-001", name: "Rotate conductor orchestration logs", cat: "maintenance", pool: "cold", w: 2, desc: "Trim conductor log to prevent unbounded memory growth" },
    { id: "maint-002", name: "Clean stale connectivity patterns", cat: "maintenance", pool: "cold", w: 2, desc: "Remove connectivity patterns older than 48 hours" },
    { id: "maint-003", name: "Compact task result cache", cat: "maintenance", pool: "cold", w: 2, desc: "Remove expired and low-value cache entries" },
    { id: "maint-004", name: "Validate registry node consistency", cat: "maintenance", pool: "warm", w: 3, desc: "Ensure heady-registry.json has no orphaned entries" },
    { id: "maint-005", name: "Clean expired circuit breaker states", cat: "maintenance", pool: "cold", w: 2, desc: "Reset circuit breakers past their timeout" },
    { id: "maint-006", name: "Trim service stub activity logs", cat: "maintenance", pool: "cold", w: 2, desc: "Cap service stub logs to prevent memory bloat" },
    { id: "maint-007", name: "Verify data directory integrity", cat: "maintenance", pool: "cold", w: 2, desc: "Ensure data/ files are valid JSON and not corrupted" },
    { id: "maint-008", name: "Update pipeline run history TTL", cat: "maintenance", pool: "cold", w: 2, desc: "Archive old pipeline runs and keep history compact" },
    { id: "maint-009", name: "Clean orphaned event listeners", cat: "maintenance", pool: "warm", w: 3, desc: "Detect and remove listeners for destroyed components" },
    { id: "maint-010", name: "Refresh node capability metadata", cat: "maintenance", pool: "warm", w: 3, desc: "Update node metadata from registry for fresh tracking" },
    { id: "maint-011", name: "Verify config file parse-ability", cat: "maintenance", pool: "cold", w: 2, desc: "Test-parse all YAML configs to catch syntax errors early" },
    { id: "maint-012", name: "Compact auto-success task history", cat: "maintenance", pool: "cold", w: 1, desc: "Trim auto-success history to cap at 2000 entries" },
    { id: "maint-013", name: "Reset stale pattern observations", cat: "maintenance", pool: "cold", w: 2, desc: "Clear pattern engine observations older than window" },
    { id: "maint-014", name: "Validate NotebookLM sync state integrity", cat: "maintenance", pool: "cold", w: 2, desc: "Ensure NotebookLM sync state matches actual sync status" },
    { id: "maint-015", name: "Health-check all mounted routers", cat: "maintenance", pool: "warm", w: 3, desc: "Verify all Express routers respond without errors" },

    // ═══ DISCOVERY (15) — Finding new opportunities ═══════════════════════
    { id: "disc-001", name: "Scan for unused config parameters", cat: "discovery", pool: "cold", w: 2, desc: "Find config params defined but never referenced in code" },
    { id: "disc-002", name: "Identify underutilized node capabilities", cat: "discovery", pool: "warm", w: 3, desc: "Find node capabilities that are rarely exercised" },
    { id: "disc-003", name: "Discover cross-service optimization paths", cat: "discovery", pool: "warm", w: 4, desc: "Identify where services could share data" },
    { id: "disc-004", name: "Map potential parallelization points", cat: "discovery", pool: "warm", w: 3, desc: "Find sequential operations that could run in parallel" },
    { id: "disc-005", name: "Identify recurring error patterns", cat: "discovery", pool: "warm", w: 4, desc: "Discover error patterns suggesting architecture improvements" },
    { id: "disc-006", name: "Scan for caching opportunities", cat: "discovery", pool: "warm", w: 3, desc: "Find repeatedly computed values that benefit from caching" },
    { id: "disc-007", name: "Discover integration gaps", cat: "discovery", pool: "warm", w: 3, desc: "Find services that should be wired together but aren't" },
    { id: "disc-008", name: "Identify resource waste patterns", cat: "discovery", pool: "warm", w: 4, desc: "Find allocated resources not effectively utilized" },
    { id: "disc-009", name: "Map potential automation targets", cat: "discovery", pool: "cold", w: 2, desc: "Identify manual processes that could be automated" },
    { id: "disc-010", name: "Discover latency reduction opportunities", cat: "discovery", pool: "hot", w: 5, desc: "Find top latency contributors and model reduction paths" },
    { id: "disc-011", name: "Scan for missing health endpoints", cat: "discovery", pool: "cold", w: 2, desc: "Find services without health endpoints" },
    { id: "disc-012", name: "Identify event bus dead letter paths", cat: "discovery", pool: "warm", w: 3, desc: "Find events emitted but never consumed" },
    { id: "disc-013", name: "Discover config simplification paths", cat: "discovery", pool: "cold", w: 2, desc: "Find redundant or overlapping configuration entries" },
    { id: "disc-014", name: "Map public domain best practice alignment", cat: "discovery", pool: "cold", w: 2, desc: "Compare architecture against industry best practices" },
    { id: "disc-015", name: "Identify capacity scaling trigger points", cat: "discovery", pool: "warm", w: 3, desc: "Discover thresholds where scaling decisions should trigger" },

    // ═══ VERIFICATION (15) — HeadyVerifier: Liquid Architecture Compliance ══
    { id: "verify-001", name: "Verify component capability definitions", cat: "verification", pool: "warm", w: 5, desc: "Ensure all components define capabilities, not static locations" },
    { id: "verify-002", name: "Verify multi-presence allocation", cat: "verification", pool: "warm", w: 5, desc: "Confirm each component has presences in all sensible locations" },
    { id: "verify-003", name: "Verify context-aware routing active", cat: "verification", pool: "hot", w: 5, desc: "Confirm LiquidAllocator context analysis runs on every flow" },
    { id: "verify-004", name: "Verify affinity scoring accuracy", cat: "verification", pool: "warm", w: 4, desc: "Validate affinity scores correlate with actual component fitness" },
    { id: "verify-005", name: "Verify no static service binding", cat: "verification", pool: "warm", w: 5, desc: "Ensure no service is hardwired — all route through liquid allocator" },
    { id: "verify-006", name: "Verify always-present components active", cat: "verification", pool: "hot", w: 5, desc: "Confirm patterns, auto-success, stream, and cloud are always present" },
    { id: "verify-007", name: "Verify flow decision SSE broadcast", cat: "verification", pool: "warm", w: 3, desc: "Confirm liquid flow decisions broadcast via SSE for real-time visibility" },
    { id: "verify-008", name: "Verify liquid state persistence", cat: "verification", pool: "cold", w: 2, desc: "Confirm liquid allocator state persists to disk every 60s" },
    { id: "verify-009", name: "Verify circuit breaker liquid coverage", cat: "verification", pool: "warm", w: 4, desc: "Ensure all critical liquid components have circuit breaker protection" },
    { id: "verify-010", name: "Verify dynamic allocation under pressure", cat: "verification", pool: "warm", w: 4, desc: "Confirm allocator reduces allocation count under resource pressure" },
    { id: "verify-011", name: "Verify cross-domain component availability", cat: "verification", pool: "warm", w: 4, desc: "Ensure components are available across all 7 Heady domains" },
    { id: "verify-012", name: "Verify HeadyBuddy bridge connectivity", cat: "verification", pool: "warm", w: 3, desc: "Confirm HeadyBuddy can access all services via bridge proxy" },
    { id: "verify-013", name: "Verify registry reflects liquid state", cat: "verification", pool: "warm", w: 4, desc: "Ensure heady-registry.json is updated with liquid allocation data" },
    { id: "verify-014", name: "Verify best-practice scores above threshold", cat: "verification", pool: "warm", w: 5, desc: "Confirm deep-scan best practice scores are >= 0.8 across all evaluators" },
    { id: "verify-015", name: "Verify cloud connector domain completeness", cat: "verification", pool: "cold", w: 3, desc: "Confirm all 7 domains and their subdomains are mapped in cloud status" },

    // ═══ CREATIVE (10) — HeadyCreative Engine Health ════════════════════════
    { id: "create-001", name: "Monitor creative engine job throughput", cat: "creative", pool: "warm", w: 4, desc: "Track jobs per minute and identify throughput bottlenecks" },
    { id: "create-002", name: "Verify model routing accuracy", cat: "creative", pool: "warm", w: 5, desc: "Confirm input→output routes to optimal models" },
    { id: "create-003", name: "Track pipeline completion rates", cat: "creative", pool: "warm", w: 4, desc: "Monitor multi-step pipeline success across all 8 pipelines" },
    { id: "create-004", name: "Monitor creative session persistence", cat: "creative", pool: "cold", w: 2, desc: "Ensure active sessions maintain state correctly" },
    { id: "create-005", name: "Verify input type coverage", cat: "creative", pool: "warm", w: 3, desc: "Confirm all 9 input types are routable to at least one model" },
    { id: "create-006", name: "Track error absorption patterns", cat: "creative", pool: "warm", w: 3, desc: "Monitor which creative operations absorb errors most frequently" },
    { id: "create-007", name: "Verify SSE creative job broadcast", cat: "creative", pool: "warm", w: 3, desc: "Confirm creative job completions broadcast via SSE" },
    { id: "create-008", name: "Monitor model provider availability", cat: "creative", pool: "hot", w: 5, desc: "Track which AI providers are responsive for creative tasks" },
    { id: "create-009", name: "Verify remix multi-input processing", cat: "creative", pool: "warm", w: 4, desc: "Confirm remix endpoint handles 2+ inputs correctly" },
    { id: "create-010", name: "Track creative output quality scores", cat: "creative", pool: "warm", w: 4, desc: "Monitor HeadyVinci's quality evaluation of creative outputs" },

    // ═══ DEEP-INTEL (10) — Deep System Intelligence Protocol ════════════════
    { id: "intel-001", name: "Monitor 3D vector store health", cat: "deep-intel", pool: "warm", w: 4, desc: "Track vector count, clustering quality, and dimension utilization" },
    { id: "intel-002", name: "Verify audit chain integrity", cat: "deep-intel", pool: "hot", w: 5, desc: "Validate SHA-256 hash chain continuity in deterministic behavior audit" },
    { id: "intel-003", name: "Track perspective coverage completeness", cat: "deep-intel", pool: "warm", w: 4, desc: "Ensure all 10 analysis perspectives are contributing findings" },
    { id: "intel-004", name: "Monitor Heady node utilization rates", cat: "deep-intel", pool: "warm", w: 3, desc: "Track which of the 10 Heady nodes are being invoked and their contribution" },
    { id: "intel-005", name: "Verify vector cluster quality", cat: "deep-intel", pool: "cold", w: 3, desc: "Analyze cluster distribution and identify under-connected regions" },
    { id: "intel-006", name: "Track composite scan score trends", cat: "deep-intel", pool: "warm", w: 4, desc: "Monitor project health scores over time for improvement trajectory" },
    { id: "intel-007", name: "Monitor multi-perspective data richness", cat: "deep-intel", pool: "warm", w: 4, desc: "Verify each stored vector has comprehensive perspective coverage" },
    { id: "intel-008", name: "Verify nearest-neighbor query accuracy", cat: "deep-intel", pool: "cold", w: 3, desc: "Test 3D spatial queries return semantically related vectors" },
    { id: "intel-009", name: "Track HeadyResearch recon success rate", cat: "deep-intel", pool: "warm", w: 4, desc: "Monitor best-practice discovery and implementation matching" },
    { id: "intel-010", name: "Monitor HeadyBattle competitive analysis freshness", cat: "deep-intel", pool: "warm", w: 3, desc: "Ensure competitive benchmarks are recent and relevant" },

    // ═══ HIVE-INTEGRATION (20) — External APIs, MCP Aggregation, SDK ════════
    { id: "hive-001", name: "HeadyCompute Assistants API health check", cat: "hive-integration", pool: "warm", w: 4, desc: "Validate HeadyCompute file search / retrieval API endpoint availability" },
    { id: "hive-002", name: "HeadyCompute embeddings endpoint readiness", cat: "hive-integration", pool: "warm", w: 4, desc: "Test text-embedding-3-small endpoint availability and latency" },
    { id: "hive-003", name: "HeadyCompute batch API queue depth", cat: "hive-integration", pool: "cold", w: 2, desc: "Check pending batch job status and completion rate" },
    { id: "hive-004", name: "Google Cloud Vertex AI health", cat: "hive-integration", pool: "warm", w: 3, desc: "Ping Vertex AI prediction endpoint and check quota" },
    { id: "hive-005", name: "Google Cloud Vision API readiness", cat: "hive-integration", pool: "cold", w: 2, desc: "Test Vision API with lightweight probe request" },
    { id: "hive-006", name: "Google Cloud NLP availability", cat: "hive-integration", pool: "cold", w: 2, desc: "Validate Natural Language API entity/sentiment endpoints" },
    { id: "hive-007", name: "Google BigQuery connection test", cat: "hive-integration", pool: "cold", w: 2, desc: "Verify BigQuery dataset access and query capability" },
    { id: "hive-008", name: "GitHub MCP server connectivity", cat: "hive-integration", pool: "warm", w: 4, desc: "Test upstream GitHub MCP server for PR/issue tool availability" },
    { id: "hive-009", name: "Puppeteer MCP server readiness", cat: "hive-integration", pool: "cold", w: 2, desc: "Validate browser automation MCP server connection" },
    { id: "hive-010", name: "Memory MCP knowledge graph sync", cat: "hive-integration", pool: "warm", w: 4, desc: "Check memory MCP server persistence and entity retrieval" },
    { id: "hive-011", name: "LiteLLM gateway model roster check", cat: "hive-integration", pool: "warm", w: 4, desc: "Verify all registered models callable through LiteLLM proxy" },
    { id: "hive-012", name: "Heady Hive SDK package integrity", cat: "hive-integration", pool: "warm", w: 3, desc: "Validate heady-hive-sdk exports, dependencies, and version" },
    { id: "hive-013", name: "SDK authentication flow test", cat: "hive-integration", pool: "warm", w: 4, desc: "Test token issue → verify → refresh lifecycle through SDK" },
    { id: "hive-014", name: "SDK event streaming health", cat: "hive-integration", pool: "warm", w: 3, desc: "Validate SSE client connection, heartbeat, and reconnect" },
    { id: "hive-015", name: "MCP aggregator tool count validation", cat: "hive-integration", pool: "warm", w: 3, desc: "Confirm all upstream MCP tools registered in aggregator" },
    { id: "hive-016", name: "Cloudflare Workers edge latency", cat: "hive-integration", pool: "cold", w: 2, desc: "Measure Cloudflare Worker response time from origin" },
    { id: "hive-017", name: "HeadyCompute Retrieval index freshness", cat: "hive-integration", pool: "cold", w: 2, desc: "Check assistant file upload age and vector store status" },
    { id: "hive-018", name: "Cross-provider model availability sync", cat: "hive-integration", pool: "warm", w: 4, desc: "Ensure model availability consistent across HeadyJules/Codex/HeadyPythia/Grok" },
    { id: "hive-019", name: "SDK client connection pool monitor", cat: "hive-integration", pool: "warm", w: 3, desc: "Track active SDK client connections and pool health" },
    { id: "hive-020", name: "Hive integration compliance audit", cat: "hive-integration", pool: "hot", w: 5, desc: "Full sweep of all external integrations, APIs, and SDK endpoints" },

    // ═══ MOP — MASTER ORCHESTRATION PROTOCOL (45) ════════════════════════════
    // Security Shield Protocol
    { id: "mop-sec-001", name: "Purge .env.hybrid from Git history", cat: "mop-security", pool: "hot", w: 5, desc: "Run git filter-repo/BFG to erase all .env.hybrid commits from history" },
    { id: "mop-sec-002", name: "Rotate leaked DB credentials", cat: "mop-security", pool: "hot", w: 5, desc: "Rotate heady_secret PostgreSQL credentials and update all services" },
    { id: "mop-sec-003", name: "Enable GitHub secret scanning org-wide", cat: "mop-security", pool: "hot", w: 5, desc: "Activate GitHub Advanced Security secret scanning on HeadyMe org" },
    { id: "mop-sec-004", name: "Remove tracked metadata files", cat: "mop-security", pool: "warm", w: 4, desc: "git rm --cached server.pid, *.jsonl, *.bak from index" },
    { id: "mop-sec-005", name: "Cryptographic signing for MCP servers", cat: "mop-security", pool: "warm", w: 4, desc: "Sign all deployed MCP server artifacts with verified checksums" },

    // Architectural Modularization
    { id: "mop-arch-001", name: "Decompose heady-manager.js God class", cat: "mop-architecture", pool: "hot", w: 5, desc: "Split 1158-line heady-manager.js into src/routing, orchestrator, health modules" },
    { id: "mop-arch-002", name: "Decompose site-generator.js", cat: "mop-architecture", pool: "hot", w: 5, desc: "Split 91KB site-generator into factory pattern with template JSON schemas" },
    { id: "mop-arch-003", name: "Separate Python and Node.js codebases", cat: "mop-architecture", pool: "warm", w: 4, desc: "Isolate Python AI logic into /services/py-core with own requirements.txt" },
    { id: "mop-arch-004", name: "Merge duplicate config directories", cat: "mop-architecture", pool: "warm", w: 3, desc: "Audit and consolidate config/ and configs/ into single authoritative dir" },
    { id: "mop-arch-005", name: "Consolidate PowerShell build scripts", cat: "mop-architecture", pool: "warm", w: 3, desc: "Merge 4 hcautobuild*.ps1 scripts into single Build-Heady.ps1 with params" },

    // Documentation & Versioning
    { id: "mop-doc-001", name: "Consolidate README files into /docs portal", cat: "mop-docs", pool: "warm", w: 3, desc: "Merge 7+ README files into single organized /docs/ documentation portal" },
    { id: "mop-doc-002", name: "Sync all version references to registry", cat: "mop-docs", pool: "warm", w: 3, desc: "Make heady-registry.json single source of truth, sync package.json + .env" },
    { id: "mop-doc-003", name: "Formalize Sacred Geometry architecture docs", cat: "mop-docs", pool: "cold", w: 2, desc: "Document Sacred Geometry + Pentagonal Architecture in technical specs" },

    // Structured Logging + Redis + Firestore
    { id: "mop-infra-001", name: "Replace console.log with pino structured logger", cat: "mop-infrastructure", pool: "hot", w: 5, desc: "Deploy pino JSON logger across all services, deprecate console.log" },
    { id: "mop-infra-002", name: "Implement Redis connection pooling", cat: "mop-infrastructure", pool: "hot", w: 5, desc: "Configure aggressive TCP connection pooling for agent state sharing" },
    { id: "mop-infra-003", name: "Add Firestore persistent artifact storage", cat: "mop-infrastructure", pool: "warm", w: 4, desc: "Implement /artifacts/{appId}/ schema in Firestore for persistent data" },
    { id: "mop-infra-004", name: "Schema segregation public vs agent data", cat: "mop-infrastructure", pool: "warm", w: 3, desc: "Enforce strict boundaries between public data and agent operational data" },

    // CI/CD Hardening
    { id: "mop-cicd-001", name: "Add post-deploy smoke tests", cat: "mop-cicd", pool: "warm", w: 4, desc: "Add automated smoke tests that ping /health after every Cloud Run deploy" },
    { id: "mop-cicd-002", name: "Unify build/deploy pipeline", cat: "mop-cicd", pool: "warm", w: 4, desc: "Merge fragmented deploy scripts into single CI/CD pipeline" },
    { id: "mop-cicd-003", name: "Add Cloud Run deploy step to deploy.yml", cat: "mop-cicd", pool: "warm", w: 3, desc: "Automate Cloud Run deployments in GitHub Actions" },
    { id: "mop-cicd-004", name: "Enforce branch protection on main", cat: "mop-cicd", pool: "warm", w: 3, desc: "Require mandatory peer reviews before merge to main" },

    // MCP Production Hardening
    { id: "mop-mcp-001", name: "Implement MCP Tool Search deferred loading", cat: "mop-mcp", pool: "hot", w: 5, desc: "Dynamic tool discovery instead of injecting all schemas — 90%+ token savings" },
    { id: "mop-mcp-002", name: "Design macro-tools for aggregate endpoints", cat: "mop-mcp", pool: "hot", w: 5, desc: "Replace granular CRUD MCP tools with high-level macro-tools (solve N+1)" },
    { id: "mop-mcp-003", name: "OAuth 2.1 for all MCP servers", cat: "mop-mcp", pool: "warm", w: 4, desc: "Implement OAuth 2.1 with .well-known/oauth-protected-resource on all MCP" },
    { id: "mop-mcp-004", name: "Non-deterministic MCP session IDs", cat: "mop-mcp", pool: "warm", w: 3, desc: "Use UUIDv4 session IDs and validate Origin/Host headers for CSRF prevention" },
    { id: "mop-mcp-005", name: "Pydantic/Zod strict data contracts", cat: "mop-mcp", pool: "warm", w: 4, desc: "Enforce strict I/O schemas on all agent communication with Zod validation" },

    // AI Gateway & Liquid Architecture
    { id: "mop-ai-001", name: "Deploy centralized AI Gateway", cat: "mop-ai-gateway", pool: "hot", w: 5, desc: "Central gateway for all outbound LLM traffic with token monitoring" },
    { id: "mop-ai-002", name: "Assign OpenAI Business as Supervisor Swarm", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Route supervisor routing tasks through 2x OpenAI Business seats" },
    { id: "mop-ai-003", name: "Assign Claude Max as MCP Tool Caller", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Deploy Claude Max for Code Execution and MCP Tool interaction" },
    { id: "mop-ai-004", name: "Assign Google AI Ultra for multimodal", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Route multimodal analysis and GCloud integration to AI Ultra" },
    { id: "mop-ai-005", name: "Assign Perplexity Enterprise as Research Oracle", cat: "mop-ai-gateway", pool: "warm", w: 3, desc: "Route external truth grounding through Perplexity Enterprise API" },
    { id: "mop-ai-006", name: "Configure 3x Colab Pro+ compute nodes", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Set up 3 decoupled Colab nodes: data synthesis, fine-tuning, validation" },
    { id: "mop-ai-007", name: "Intelligent model routing by complexity", cat: "mop-ai-gateway", pool: "hot", w: 5, desc: "Route cheap models for simple tasks, heavy models for complex reasoning" },
    { id: "mop-ai-008", name: "Per-agent token budget enforcement", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Monitor and enforce per-agent token consumption budgets" },
    { id: "mop-ai-009", name: "Move model weights to HuggingFace Business", cat: "mop-ai-gateway", pool: "warm", w: 3, desc: "Move Sacred Geometry model weights and embeddings to 2x HF Business seats" },

    // Performance + Auth + Dynamic Sites
    { id: "mop-perf-001", name: "Standardized health endpoint JSON schema", cat: "mop-performance", pool: "warm", w: 4, desc: "Uniform /health response across ALL Cloud Run services" },
    { id: "mop-perf-002", name: "Binary inter-agent communication", cat: "mop-performance", pool: "warm", w: 3, desc: "Implement Protocol Buffers or MessagePack for agent communication" },
    { id: "mop-auth-001", name: "Standardize auth across all Heady surfaces", cat: "mop-auth", pool: "hot", w: 5, desc: "Unified auth middleware for Cloud Run, Workers, MCP, widgets — one template everywhere" },
    { id: "mop-auth-002", name: "Deploy Cloudflare Worker proxy for manager", cat: "mop-auth", pool: "warm", w: 4, desc: "Proxy manager.headysystems.com through Cloudflare Worker to Cloud Run" },
    { id: "mop-site-001", name: "Deploy site-generator as Cloud Run service", cat: "mop-sites", pool: "hot", w: 5, desc: "Interactive on-the-fly site builds tailored per user/audience on Cloud Run" },
    { id: "mop-site-002", name: "Per-user dynamic template rendering", cat: "mop-sites", pool: "warm", w: 4, desc: "Implement audience-aware template rendering for dynamic sites" },
    { id: "mop-site-003", name: "Remove PM2 site entries from ecosystem", cat: "mop-sites", pool: "warm", w: 3, desc: "Remove 40+ site PM2 entries from ecosystem.config.cjs" },

    // ═══ MONETIZATION — IaaS / SaaS PLAY (10) ═══════════════════════════════
    { id: "mon-iaas-001", name: "Package 3D vector storage as API", cat: "monetization-iaas", pool: "hot", w: 5, desc: "Expose octree spatial index as multi-tenant API with rate limiting and auth" },
    { id: "mon-iaas-002", name: "Design multi-tenant data isolation", cat: "monetization-iaas", pool: "hot", w: 5, desc: "Implement tenant-isolated vector namespaces using Neon/Upstash" },
    { id: "mon-iaas-003", name: "Build governance API tier system", cat: "monetization-iaas", pool: "warm", w: 4, desc: "Package GovernanceEngine as tiered API: $49/mo basic, $149/mo pro, enterprise" },
    { id: "mon-iaas-004", name: "Integrate Stripe billing pipeline", cat: "monetization-iaas", pool: "hot", w: 5, desc: "Wire Stripe subscriptions + usage-based billing for API consumption" },
    { id: "mon-iaas-005", name: "Create developer SDK package", cat: "monetization-iaas", pool: "warm", w: 4, desc: "Publish heady-sdk NPM package for external developer integration" },
    { id: "mon-iaas-006", name: "Design API gateway with token monitoring", cat: "monetization-iaas", pool: "hot", w: 5, desc: "Central gateway for all client API traffic with per-tenant token tracking" },
    { id: "mon-iaas-007", name: "Build developer portal and docs", cat: "monetization-iaas", pool: "warm", w: 3, desc: "Create interactive API documentation portal with code examples" },
    { id: "mon-iaas-008", name: "Implement OAuth 2.0 API key issuance", cat: "monetization-iaas", pool: "warm", w: 4, desc: "Secure API key generation and management via Firebase/OAuth 2.0" },
    { id: "mon-iaas-009", name: "Monitor API usage and billing accuracy", cat: "monetization-iaas", pool: "warm", w: 4, desc: "Track per-tenant API calls, token consumption, and billing accuracy" },
    { id: "mon-iaas-010", name: "Design SLA monitoring dashboard", cat: "monetization-iaas", pool: "warm", w: 3, desc: "Build uptime, latency, and throughput monitoring for SaaS customers" },

    // ═══ SOVEREIGN AGENT ALTERNATIVE (10) ════════════════════════════════════
    { id: "mon-agent-001", name: "Package HeadyBuddy as sovereign agent", cat: "monetization-agent", pool: "hot", w: 5, desc: "Position as OS-agnostic, bring-your-own-keys competitor to Jules/Mariner" },
    { id: "mon-agent-002", name: "Build multi-LLM router demo", cat: "monetization-agent", pool: "warm", w: 4, desc: "Create demo showing Claude/OpenAI/HF orchestration without vendor lock-in" },
    { id: "mon-agent-003", name: "Design enterprise licensing model", cat: "monetization-agent", pool: "warm", w: 4, desc: "Annual licensing for on-premise HeadyMe deployment with IP protection" },
    { id: "mon-agent-004", name: "Build data privacy compliance layer", cat: "monetization-agent", pool: "hot", w: 5, desc: "Guarantee proprietary enterprise data never leaves customer infrastructure" },
    { id: "mon-agent-005", name: "Create vendor comparison matrix", cat: "monetization-agent", pool: "cold", w: 2, desc: "Document Heady advantages vs Jules, Mariner, AutoGPT, CrewAI" },
    { id: "mon-agent-006", name: "Design white-label deployment package", cat: "monetization-agent", pool: "warm", w: 4, desc: "Create customizable Heady deployment for enterprise branding" },
    { id: "mon-agent-007", name: "Build on-premise installer", cat: "monetization-agent", pool: "warm", w: 4, desc: "Docker Compose + Helm chart for air-gapped enterprise deployment" },
    { id: "mon-agent-008", name: "Track enterprise prospect pipeline", cat: "monetization-agent", pool: "cold", w: 2, desc: "CRM-style tracking of potential enterprise licensing opportunities" },
    { id: "mon-agent-009", name: "Monitor competitive landscape shifts", cat: "monetization-agent", pool: "cold", w: 2, desc: "Track new agentic AI competitors and feature parity changes" },
    { id: "mon-agent-010", name: "Build agent capability showcase", cat: "monetization-agent", pool: "warm", w: 3, desc: "Interactive demo showing 20-node orchestration, spatial computing, governance" },

    // ═══ B2B ENTITY FORMATION (10) ══════════════════════════════════════════
    { id: "mon-b2b-001", name: "Register HeadySystems LLC/C-Corp", cat: "monetization-b2b", pool: "hot", w: 5, desc: "Formalize business structure with EIN — required for Stripe + enterprise" },
    { id: "mon-b2b-002", name: "Establish corporate bank account", cat: "monetization-b2b", pool: "hot", w: 5, desc: "Open business bank account for Stripe merchant services and revenue" },
    { id: "mon-b2b-003", name: "Configure Stripe merchant account", cat: "monetization-b2b", pool: "hot", w: 5, desc: "Set up Stripe Connect with verified business identity for SaaS billing" },
    { id: "mon-b2b-004", name: "File provisional trademark for Heady™", cat: "monetization-b2b", pool: "warm", w: 4, desc: "Protect Heady, HeadyMe, HeadyBuddy trademarks via USPTO" },
    { id: "mon-b2b-005", name: "Establish IP sovereignty documentation", cat: "monetization-b2b", pool: "warm", w: 4, desc: "Formal documentation asserting Heady has no relation to any existing entity" },
    { id: "mon-b2b-006", name: "Create standard licensing agreement", cat: "monetization-b2b", pool: "warm", w: 3, desc: "Draft enterprise licensing template (SaaS, on-premise, white-label)" },
    { id: "mon-b2b-007", name: "Set up business insurance", cat: "monetization-b2b", pool: "cold", w: 2, desc: "E&O and general liability insurance for SaaS/API services" },
    { id: "mon-b2b-008", name: "Establish vendor compliance checklist", cat: "monetization-b2b", pool: "warm", w: 3, desc: "SOC 2 readiness checklist for enterprise vendor approval processes" },
    { id: "mon-b2b-009", name: "Configure business tax accounts", cat: "monetization-b2b", pool: "warm", w: 3, desc: "Set up state + federal tax accounts for SaaS revenue reporting" },
    { id: "mon-b2b-010", name: "Track revenue and runway metrics", cat: "monetization-b2b", pool: "warm", w: 3, desc: "Dashboard tracking MRR, ARR, CAC, LTV, and runway vs burn rate" },

    // ═══ IDE ACCELERATION (10) ══════════════════════════════════════════════
    { id: "dev-ide-001", name: "Optimize multi-repo workspace context", cat: "dev-acceleration", pool: "warm", w: 4, desc: "Configure IDE to index all 5 HeadyMe repos simultaneously for cross-repo search" },
    { id: "dev-ide-002", name: "Set up Claude Code terminal integration", cat: "dev-acceleration", pool: "warm", w: 4, desc: "Install Claude Code extension for in-IDE agentic coding with full workspace awareness" },
    { id: "dev-ide-003", name: "Configure automated refactoring pipelines", cat: "dev-acceleration", pool: "warm", w: 3, desc: "Set up IDE-driven bulk refactoring for Docker configs and vector algorithms" },
    { id: "dev-ide-004", name: "Build cross-platform dev environment sync", cat: "dev-acceleration", pool: "warm", w: 3, desc: "Sync IDE settings, extensions, and configs across Linux/Windows workstations" },
    { id: "dev-ide-005", name: "Create Heady-specific code snippets library", cat: "dev-acceleration", pool: "cold", w: 2, desc: "Pre-built snippet library for common Heady patterns: Vec3, governance, bee defs" },
    { id: "dev-ide-006", name: "Set up automated PR review pipeline", cat: "dev-acceleration", pool: "warm", w: 4, desc: "Auto-review PRs against governance policies before merge" },
    { id: "dev-ide-007", name: "Configure HeadyMCP IDE integration", cat: "dev-acceleration", pool: "warm", w: 4, desc: "Wire HeadyMCP tools into IDE for in-editor spatial queries and agent management" },
    { id: "dev-ide-008", name: "Build test harness generator", cat: "dev-acceleration", pool: "warm", w: 3, desc: "Auto-generate node:test scaffolding for new service files" },
    { id: "dev-ide-009", name: "Create deployment shortcut commands", cat: "dev-acceleration", pool: "cold", w: 2, desc: "One-command deployment to Cloud Run from IDE terminal" },
    { id: "dev-ide-010", name: "Monitor dev velocity metrics", cat: "dev-acceleration", pool: "cold", w: 2, desc: "Track commits/day, files changed, services deployed for productivity insights" },

    // ═══ SUBSCRIPTION STACK OPTIMIZATION (15) ═══════════════════════════════
    { id: "sub-opt-001", name: "Route training to Colab Pro+ exclusively", cat: "subscription-optimization", pool: "warm", w: 4, desc: "Ensure ALL heavy ML tasks (vectorization, training) run on Colab Pro+, not GCP" },
    { id: "sub-opt-002", name: "Segregate live trading from training compute", cat: "subscription-optimization", pool: "hot", w: 5, desc: "Absolute isolation: GCP Chicago for live trading, Colab for ML — never mix" },
    { id: "sub-opt-003", name: "Optimize Cloudflare Zero Trust routing", cat: "subscription-optimization", pool: "warm", w: 4, desc: "Use Cloudflare Zero Trust for inter-node security instead of custom mTLS" },
    { id: "sub-opt-004", name: "Monitor monthly infrastructure burn rate", cat: "subscription-optimization", pool: "warm", w: 4, desc: "Track actual spend across GCP, Cloudflare, API keys vs $750/mo budget" },
    { id: "sub-opt-005", name: "Deploy GCP instances near Chicago exchange", cat: "subscription-optimization", pool: "hot", w: 5, desc: "Host live trading containers in us-central1 (closest to CME) for sub-ms latency" },
    { id: "sub-opt-006", name: "Route LLMs to end-of-day analysis only", cat: "subscription-optimization", pool: "warm", w: 4, desc: "Keep Claude/OpenAI/Perplexity OUT of live trading path — EOD analysis only" },
    { id: "sub-opt-007", name: "Use Perplexity for morning macro scan", cat: "subscription-optimization", pool: "warm", w: 3, desc: "Daily 6AM Perplexity API call for CPI/FOMC/macro no-trade zone detection" },
    { id: "sub-opt-008", name: "Optimize HuggingFace token rotation", cat: "subscription-optimization", pool: "warm", w: 3, desc: "Implement 3-token round-robin rotation per v9.0 blueprint for HF inference" },
    { id: "sub-opt-009", name: "Track API cost per trade execution", cat: "subscription-optimization", pool: "warm", w: 3, desc: "Calculate exact infrastructure cost per trade to verify profitability margin" },
    { id: "sub-opt-010", name: "Self-sustaining infrastructure validation", cat: "subscription-optimization", pool: "warm", w: 4, desc: "Verify trading revenue covers ALL infrastructure costs (self-sustaining check)" },
    { id: "sub-opt-011", name: "Monitor Upstash Redis memory utilization", cat: "subscription-optimization", pool: "warm", w: 3, desc: "Track Upstash memory usage and optimize for working memory efficiency" },
    { id: "sub-opt-012", name: "Optimize Neon Postgres query patterns", cat: "subscription-optimization", pool: "warm", w: 3, desc: "Analyze and optimize pgvector queries for cost-effective compute units" },
    { id: "sub-opt-013", name: "Track Sentry event quota utilization", cat: "subscription-optimization", pool: "cold", w: 2, desc: "Monitor Sentry event consumption against plan limits" },
    { id: "sub-opt-014", name: "Audit unused API key subscriptions", cat: "subscription-optimization", pool: "cold", w: 2, desc: "Identify and cancel unused or underutilized API subscriptions" },
    { id: "sub-opt-015", name: "Calculate infrastructure ROI per angle", cat: "subscription-optimization", pool: "warm", w: 4, desc: "ROI analysis per strategic angle: trading, IaaS, licensing, consulting" },

    // ─── ARCHITECTURE FIX TASKS (from merged architecture-fix-tasks.json) ──────
    { id: "arch-fix-001", name: "Resolve heady-conductor import gaps", cat: "architecture-fix", pool: "hot", w: 5, desc: "Fix missing module imports in heady-conductor.js discovered during ecosystem audit" },
    { id: "arch-fix-002", name: "Wire engine-wiring.js bootstrap sequence", cat: "architecture-fix", pool: "hot", w: 5, desc: "Ensure engine-wiring.js initializes all engines in correct dependency order" },
    { id: "arch-fix-003", name: "Validate pipeline stage DAG integrity", cat: "architecture-fix", pool: "hot", w: 5, desc: "Run DAG cycle detection on all HCFullPipeline stage dependencies" },
    { id: "arch-fix-004", name: "Fix orphaned event listeners", cat: "architecture-fix", pool: "warm", w: 4, desc: "Detect and clean up event listeners without matching emitters" },
    { id: "arch-fix-005", name: "Resolve circular require() chains", cat: "architecture-fix", pool: "hot", w: 5, desc: "Break circular dependency loops in orchestration/ modules" },
    { id: "arch-fix-006", name: "Standardize error propagation patterns", cat: "architecture-fix", pool: "warm", w: 4, desc: "Ensure all modules use consistent error wrapping with HeadyError" },
    { id: "arch-fix-007", name: "Audit dead code in orchestration/", cat: "architecture-fix", pool: "warm", w: 3, desc: "Identify and remove unreachable code paths across orchestration modules" },
    { id: "arch-fix-008", name: "Validate all module.exports signatures", cat: "architecture-fix", pool: "warm", w: 3, desc: "Check all exports match their documented API surface" },
    { id: "arch-fix-009", name: "Fix stale singleton references", cat: "architecture-fix", pool: "warm", w: 4, desc: "Replace stale singleton references with fresh-init patterns" },
    { id: "arch-fix-010", name: "Harden graceful shutdown hooks", cat: "architecture-fix", pool: "hot", w: 5, desc: "Ensure all new modules register SIGTERM/SIGINT handlers for clean shutdown" },

    // ─── AUTOCONTEXT INTEGRATION (from merged autocontext-integration-tasks.json) ─
    { id: "autoctx-001", name: "Bootstrap autocontext event listeners", cat: "autocontext-integration", pool: "hot", w: 5, desc: "Register autocontext pipeline events on global.eventBus" },
    { id: "autoctx-002", name: "Wire vector-memory.js to pg-vector-adapter", cat: "autocontext-integration", pool: "hot", w: 5, desc: "Connect in-memory vector store to persistent pgvector backend" },
    { id: "autoctx-003", name: "Implement context window rotation", cat: "autocontext-integration", pool: "warm", w: 4, desc: "Auto-rotate context windows based on token budget from budgetMonitor" },
    { id: "autoctx-004", name: "Register CSL benchmark hooks", cat: "autocontext-integration", pool: "warm", w: 4, desc: "Wire cslBenchmark.js into pipeline telemetry for quality tracking" },
    { id: "autoctx-005", name: "Connect change classifier to deploy pipeline", cat: "autocontext-integration", pool: "warm", w: 4, desc: "Feed changeClassifier.js output to auto-commit-deploy.js decisions" },
    { id: "autoctx-006", name: "Wire patent tracker to IP governance", cat: "autocontext-integration", pool: "warm", w: 3, desc: "Connect patentTracker.js claims to governance engine IP checks" },
    { id: "autoctx-007", name: "Register hallucination watchdog monitors", cat: "autocontext-integration", pool: "hot", w: 5, desc: "Activate heady-hallucination-watchdog.js on all LLM response paths" },
    { id: "autoctx-008", name: "Wire webhook dispatcher to event bus", cat: "autocontext-integration", pool: "warm", w: 4, desc: "Connect heady-webhook-dispatcher.js to global event bus for outbound notifications" },
    { id: "autoctx-009", name: "Connect budget monitor to governance engine", cat: "autocontext-integration", pool: "hot", w: 5, desc: "Wire budgetMonitor.js alerts to GovernanceEngine budget policy enforcement" },
    { id: "autoctx-010", name: "Register competitive intel data feeds", cat: "autocontext-integration", pool: "warm", w: 3, desc: "Connect competitive-intelligence-engine.js to scheduled data ingestion" },

    // ─── AUTONOMY ENHANCEMENT (from merged autonomy-enhancement-tasks.json) ──────
    { id: "autonomy-001", name: "Enable self-healing pipeline restarts", cat: "autonomy-enhancement", pool: "hot", w: 5, desc: "Auto-restart failed pipeline stages with exponential backoff" },
    { id: "autonomy-002", name: "Implement autonomous task generation", cat: "autonomy-enhancement", pool: "hot", w: 5, desc: "Generate new tasks from cslBenchmark gaps without human intervention" },
    { id: "autonomy-003", name: "Deploy auto-commit-deploy.js in CI", cat: "autonomy-enhancement", pool: "warm", w: 4, desc: "Enable automatic commit+deploy for passing pipeline runs" },
    { id: "autonomy-004", name: "Wire MAPE-K feedback loop", cat: "autonomy-enhancement", pool: "hot", w: 5, desc: "Connect mape-k.js Monitor-Analyze-Plan-Execute-Knowledge cycle" },
    { id: "autonomy-005", name: "Enable argus-v2 autonomous monitoring", cat: "autonomy-enhancement", pool: "warm", w: 4, desc: "Activate argus-v2.js for continuous system observation" },
    { id: "autonomy-006", name: "Enable hermes-v2 inter-agent messaging", cat: "autonomy-enhancement", pool: "warm", w: 4, desc: "Activate hermes-v2.js for cross-agent communication routing" },
    { id: "autonomy-007", name: "Enable kronos-v2 temporal scheduling", cat: "autonomy-enhancement", pool: "warm", w: 4, desc: "Activate kronos-v2.js for time-aware task scheduling" },
    { id: "autonomy-008", name: "Implement self-correction loop triggers", cat: "autonomy-enhancement", pool: "hot", w: 5, desc: "Wire self-correction-loop.js to auto-detect and fix regressions" },
    { id: "autonomy-009", name: "Enable autonomous dependency updates", cat: "autonomy-enhancement", pool: "warm", w: 3, desc: "Auto-merge safe dependabot PRs after CI passes" },
    { id: "autonomy-010", name: "Deploy sacred geometry topology health", cat: "autonomy-enhancement", pool: "warm", w: 3, desc: "Monitor SG topology node health and auto-rebalance" },

    // ─── BENEFICIAL BUNDLE (from merged beneficial-bundle-tasks.json) ─────────────
    { id: "bundle-001", name: "Bundle watchdog + hallucination detector", cat: "beneficial-bundle", pool: "hot", w: 5, desc: "Package watchdog + hallucination detector as standalone quality module" },
    { id: "bundle-002", name: "Bundle vector adapter + memory layer", cat: "beneficial-bundle", pool: "warm", w: 4, desc: "Package pg-vector-adapter + vector-memory as portable memory module" },
    { id: "bundle-003", name: "Bundle event bus + bridge as messaging kit", cat: "beneficial-bundle", pool: "warm", w: 4, desc: "Package heady-event-bus + hcfp-event-bridge as standalone messaging layer" },
    { id: "bundle-004", name: "Bundle budget + governance as compliance kit", cat: "beneficial-bundle", pool: "warm", w: 4, desc: "Package budgetMonitor + governance-engine as enterprise compliance module" },
    { id: "bundle-005", name: "Bundle CI engine + patent tracker as IP kit", cat: "beneficial-bundle", pool: "warm", w: 3, desc: "Package competitive-intelligence + patentTracker for IP management" },
    { id: "bundle-006", name: "Bundle agents (argus+hermes+kronos) as swarm kit", cat: "beneficial-bundle", pool: "warm", w: 4, desc: "Package v2 agents as deployable multi-agent swarm module" },
    { id: "bundle-007", name: "Bundle CSL + benchmark as quality SDK", cat: "beneficial-bundle", pool: "warm", w: 3, desc: "Package cslBenchmark + changeClassifier as quality assurance SDK" },
    { id: "bundle-008", name: "Generate npm package.json per bundle", cat: "beneficial-bundle", pool: "warm", w: 3, desc: "Create scoped @heady/ package manifests for each bundle" },
    { id: "bundle-009", name: "Generate bundle documentation", cat: "beneficial-bundle", pool: "cold", w: 2, desc: "Auto-generate README + API docs for each module bundle" },
    { id: "bundle-010", name: "Validate bundle cross-dependency isolation", cat: "beneficial-bundle", pool: "warm", w: 4, desc: "Ensure bundles can be deployed independently without leaking deps" },

    // ─── UNIMPLEMENTED ARCHITECTURE (from merged unimplemented-arch-tasks.json) ───
    { id: "unimpl-001", name: "Implement real WebSocket transport layer", cat: "unimplemented-arch", pool: "hot", w: 5, desc: "Replace stub WS connections with real socket.io/ws transport" },
    { id: "unimpl-002", name: "Implement persistent task queue", cat: "unimplemented-arch", pool: "hot", w: 5, desc: "Replace in-memory task queues with Redis/BullMQ persistence" },
    { id: "unimpl-003", name: "Implement real metrics collection", cat: "unimplemented-arch", pool: "warm", w: 4, desc: "Wire OpenTelemetry metrics to actual collector endpoint" },
    { id: "unimpl-004", name: "Implement distributed lock manager", cat: "unimplemented-arch", pool: "hot", w: 5, desc: "Add Redis-backed distributed locks for multi-instance safety" },
    { id: "unimpl-005", name: "Implement real secret rotation", cat: "unimplemented-arch", pool: "hot", w: 5, desc: "Connect to GCP Secret Manager for automatic credential rotation" },
    { id: "unimpl-006", name: "Implement circuit breaker for external APIs", cat: "unimplemented-arch", pool: "warm", w: 4, desc: "Add circuit breaker pattern to all external API calls (LLM, trading, etc.)" },
    { id: "unimpl-007", name: "Implement real-time dashboard WebSocket feed", cat: "unimplemented-arch", pool: "warm", w: 4, desc: "Live dashboard data via WebSocket instead of polling" },
    { id: "unimpl-008", name: "Implement multi-region failover", cat: "unimplemented-arch", pool: "cold", w: 3, desc: "Active-passive failover between us-east1 and us-central1" },
    { id: "unimpl-009", name: "Implement audit log immutable storage", cat: "unimplemented-arch", pool: "warm", w: 4, desc: "Store governance audit trail in append-only immutable storage" },
    { id: "unimpl-010", name: "Implement canary deployment pipeline", cat: "unimplemented-arch", pool: "warm", w: 3, desc: "Gradual traffic shifting for new Cloud Run revisions" },

    // ─── NEW MODULE HEALTH CHECKS ────────────────────────────────────────────────
    { id: "mod-health-001", name: "Health check: pg-vector-adapter", cat: "module-health", pool: "hot", w: 5, desc: "Validate pg-vector-adapter.js connects to Neon and responds to vector queries" },
    { id: "mod-health-002", name: "Health check: hallucination-watchdog", cat: "module-health", pool: "hot", w: 5, desc: "Validate heady-hallucination-watchdog.js detects test hallucinations" },
    { id: "mod-health-003", name: "Health check: webhook-dispatcher", cat: "module-health", pool: "warm", w: 4, desc: "Validate heady-webhook-dispatcher.js sends and confirms webhooks" },
    { id: "mod-health-004", name: "Health check: budget-monitor", cat: "module-health", pool: "warm", w: 4, desc: "Validate budgetMonitor.js tracks spend and fires alerts at thresholds" },
    { id: "mod-health-005", name: "Health check: competitive-intel", cat: "module-health", pool: "warm", w: 3, desc: "Validate competitive-intelligence-engine.js loads and parses market data" },
    { id: "mod-health-006", name: "Health check: patent-tracker", cat: "module-health", pool: "cold", w: 2, desc: "Validate patentTracker.js claim registry loads and persists" },
    { id: "mod-health-007", name: "Health check: argus-v2 agent", cat: "module-health", pool: "warm", w: 4, desc: "Validate argus-v2.js initializes, observes, and reports correctly" },
    { id: "mod-health-008", name: "Health check: hermes-v2 agent", cat: "module-health", pool: "warm", w: 4, desc: "Validate hermes-v2.js inter-agent message routing works" },
    { id: "mod-health-009", name: "Health check: kronos-v2 agent", cat: "module-health", pool: "warm", w: 4, desc: "Validate kronos-v2.js temporal scheduling is accurate" },
    { id: "mod-health-010", name: "Health check: change-classifier", cat: "module-health", pool: "warm", w: 3, desc: "Validate changeClassifier.js categorizes diffs correctly" },
    { id: "mod-health-011", name: "Health check: csl-benchmark", cat: "module-health", pool: "warm", w: 3, desc: "Validate cslBenchmark.js runs and produces valid quality reports" },
    { id: "mod-health-012", name: "Health check: auto-commit-deploy", cat: "module-health", pool: "hot", w: 5, desc: "Validate auto-commit-deploy.js dry-run commit + deploy sequence" },
    { id: "mod-health-013", name: "Health check: heady-event-bus", cat: "module-health", pool: "hot", w: 5, desc: "Validate heady-event-bus.js pub/sub, wildcard, and replay work" },
    { id: "mod-health-014", name: "Health check: hcfp-event-bridge", cat: "module-health", pool: "hot", w: 5, desc: "Validate hcfp-event-bridge.js connects HCFPRunner events to global bus" },
    { id: "mod-health-015", name: "Health check: engine-wiring bootstrap", cat: "module-health", pool: "hot", w: 5, desc: "Validate engine-wiring.js initializes all engines without errors" },

    // ─── EVENT BUS + PIPELINE BRIDGE ─────────────────────────────────────────────
    { id: "evt-pipe-001", name: "Boot heady-event-bus on startup", cat: "event-bus-pipeline", pool: "hot", w: 5, desc: "Initialize global.eventBus from heady-event-bus.js in bootstrap" },
    { id: "evt-pipe-002", name: "Activate HCFP event bridge", cat: "event-bus-pipeline", pool: "hot", w: 5, desc: "Wire hcfp-event-bridge.js so HCFPRunner events flow to global bus" },
    { id: "evt-pipe-003", name: "Register all pipeline stages with event bus", cat: "event-bus-pipeline", pool: "hot", w: 5, desc: "Emit stage:start/stage:complete events for all 8 pipeline stages" },
    { id: "evt-pipe-004", name: "Connect auto-success to pipeline completions", cat: "event-bus-pipeline", pool: "hot", w: 5, desc: "Auto-success triggers on pipeline:completed events via bridge" },
    { id: "evt-pipe-005", name: "Implement event replay for missed completions", cat: "event-bus-pipeline", pool: "warm", w: 4, desc: "Replay missed pipeline events to auto-success on reconnect" },
    { id: "evt-pipe-006", name: "Wire governance decisions to event bus", cat: "event-bus-pipeline", pool: "warm", w: 4, desc: "Emit governance:allow/deny/escalate events for audit dashboard" },
    { id: "evt-pipe-007", name: "Wire kill-switch events to webhook dispatcher", cat: "event-bus-pipeline", pool: "hot", w: 5, desc: "Trading kill-switch fires webhooks to Slack/Discord/PagerDuty" },
    { id: "evt-pipe-008", name: "Implement event bus health heartbeat", cat: "event-bus-pipeline", pool: "warm", w: 3, desc: "60s heartbeat pulse on event bus to verify liveness" },

    // ─── COMPETITIVE INTELLIGENCE ────────────────────────────────────────────────
    { id: "ci-001", name: "Activate competitor tracking feeds", cat: "competitive-intel", pool: "warm", w: 4, desc: "Enable scheduled competitor data ingestion in CI engine" },
    { id: "ci-002", name: "Build market position heatmap", cat: "competitive-intel", pool: "warm", w: 3, desc: "Generate visual market position map from CI engine data" },
    { id: "ci-003", name: "Track AI agent framework releases", cat: "competitive-intel", pool: "warm", w: 3, desc: "Monitor releases of LangChain, AutoGen, CrewAI, etc." },
    { id: "ci-004", name: "Analyze competitor pricing models", cat: "competitive-intel", pool: "warm", w: 3, desc: "Track SaaS pricing of competing AI platforms" },
    { id: "ci-005", name: "Benchmark Heady vs competitors on latency", cat: "competitive-intel", pool: "warm", w: 4, desc: "Run latency benchmarks against OpenAI, Anthropic API gateways" },
    { id: "ci-006", name: "Generate weekly competitive digest", cat: "competitive-intel", pool: "cold", w: 2, desc: "Auto-generate weekly competitor intelligence summary" },
    { id: "ci-007", name: "Alert on competitive threat signals", cat: "competitive-intel", pool: "hot", w: 5, desc: "Fire alerts when competitors announce features in Heady's domain" },

    // ═══════════════════════════════════════════════════════════════════════
    // PERPETUAL OPTIMIZATION LOOP — NEVER STOPS
    // Standing directive: continuously audit → fix → optimize → monetize → learn
    // These tasks cycle infinitely through the auto-success scheduler.
    // Every completion re-queues the next pass at higher standards.
    // Directive: .heady/directives/full-spectrum-optimization.md
    // ═══════════════════════════════════════════════════════════════════════
    { id: "perp-opt-001", name: "∞ Boot integrity audit — cold-start <5s", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Trace all require() chains in heady-manager.js. Fix circular deps, missing modules, dead imports. Re-run every cycle." },
    { id: "perp-opt-002", name: "∞ Pipeline 22-stage end-to-end validation", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Run HCFullPipeline all 22 stages. Verify every stage emits stage:complete or stage:failed. Fix any silent failures." },
    { id: "perp-opt-003", name: "∞ Data layer RLS + vector benchmark", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Test neon-db + pg-vector-adapter + tenant-isolation RLS. Benchmark: <100ms p95 vector query latency." },
    { id: "perp-opt-004", name: "∞ Security sweep — secrets, eval, CORS, XSS", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Scan for hardcoded secrets, eval(), wildcard CORS, missing auth, XSS, prototype pollution. Fix all findings." },
    { id: "perp-opt-005", name: "∞ Service mesh health — all endpoints", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Hit every /health endpoint. Verify CORS for 11 domains. Test webhook-dispatcher, hallucination-watchdog, agents." },
    { id: "perp-opt-006", name: "∞ Performance hot-path profiling", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Profile request → LLM routing → response. Fix top 3 bottlenecks. Target: 200ms p50 response time." },
    { id: "perp-opt-007", name: "∞ Auto-success task validation sweep", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Load all tasks, execute one per category, identify stubs vs functional. Fix top 10 highest-weight stubs." },
    { id: "perp-opt-008", name: "∞ Kill-switch governance test", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Feed governance engine 51% daily loss. Confirm flatten-and-sever fires. Verify audit trail immutability." },
    { id: "perp-opt-009", name: "∞ Event bus liveness + bridge validation", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Verify heady-event-bus pub/sub, hcfp-event-bridge connection, and event replay all function." },
    { id: "perp-opt-010", name: "∞ Monetization product readiness check", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Check Vector Memory API, HeadyGuard, HeadyRouter, HeadyMesh, HeadyAutoPilot — all must have working endpoints." },
    { id: "perp-opt-011", name: "∞ Colab intelligence + session persistence", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Verify Colab runtime saves state on disconnect, restores on reconnect. Test continuous-learner ingestion." },
    { id: "perp-opt-012", name: "∞ Code dojo — generate + solve challenge", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Generate 1 coding challenge, solve, run through cslBenchmark. Log skill improvement. Never stop." },
    { id: "perp-opt-013", name: "∞ Training service — close #1 skill gap", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Identify weakest area from benchmarks + failure rates. Generate curriculum. Train. Produce working code." },
    { id: "perp-opt-014", name: "∞ Competitive intel scan", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Run competitive-intelligence-engine scan. Track competitor releases. Alert on threat signals." },
    { id: "perp-opt-015", name: "∞ Full re-audit — raise the bar 10%", cat: "perpetual-optimization", pool: "hot", w: 5, desc: "Complete cycle. Increase all thresholds by 10%. Re-queue all perp-opt tasks. The bar always rises. NEVER ENDS." },

    // ─── CODING MASTERY (continuous practice) ────────────────────────────────
    { id: "code-master-001", name: "Practice: Node.js async patterns", cat: "coding-mastery", pool: "hot", w: 5, desc: "Generate + solve async/await, Promise.all, stream challenges. Benchmark against cslBenchmark." },
    { id: "code-master-002", name: "Practice: SQL + pgvector optimization", cat: "coding-mastery", pool: "hot", w: 5, desc: "Write and optimize vector queries. Practice RLS policies, indexes, EXPLAIN ANALYZE." },
    { id: "code-master-003", name: "Practice: Cloud Run deployment", cat: "coding-mastery", pool: "warm", w: 4, desc: "Practice multi-stage Docker builds, health checks, graceful shutdown, scaling." },
    { id: "code-master-004", name: "Practice: Cloudflare Workers", cat: "coding-mastery", pool: "warm", w: 4, desc: "Build and test edge functions, KV storage patterns, Durable Objects." },
    { id: "code-master-005", name: "Practice: MCP protocol", cat: "coding-mastery", pool: "warm", w: 4, desc: "Implement MCP tools, resources, prompts. Test with stdio + SSE transports." },
    { id: "code-master-006", name: "Practice: Multi-agent orchestration", cat: "coding-mastery", pool: "warm", w: 4, desc: "Build agent communication, consensus, task delegation patterns." },
    { id: "code-master-007", name: "Practice: Security hardening", cat: "coding-mastery", pool: "hot", w: 5, desc: "Practice CSP headers, CORS, rate limiting, input sanitization, secret rotation." },
    { id: "code-master-008", name: "Practice: Trading algorithm logic", cat: "coding-mastery", pool: "warm", w: 4, desc: "Implement and backtest trading strategies. Practice risk management patterns." },
    { id: "code-master-009", name: "Practice: Real GitHub issue fixing", cat: "coding-mastery", pool: "hot", w: 5, desc: "Pull actual HeadyMe repo issues. Attempt fix. Submit draft PR. Track success rate." },
    { id: "code-master-010", name: "Practice: LLM prompt engineering", cat: "coding-mastery", pool: "warm", w: 4, desc: "Design, test, and optimize prompts for all Heady LLM integrations." },

    // ─── INTELLIGENCE TRAINING (skill gap closure) ───────────────────────────
    { id: "intel-train-001", name: "Train: pgvector query optimization", cat: "intelligence-training", pool: "hot", w: 5, desc: "Deep-dive pgvector indexing (IVFFlat vs HNSW), query planning, cost analysis." },
    { id: "intel-train-002", name: "Train: Stripe metered billing", cat: "intelligence-training", pool: "hot", w: 5, desc: "Implement Stripe usage records, metered subscriptions, webhook handling." },
    { id: "intel-train-003", name: "Train: SOC 2 compliance patterns", cat: "intelligence-training", pool: "warm", w: 4, desc: "Study SOC 2 Type II. Implement audit logging, access controls, encryption at rest." },
    { id: "intel-train-004", name: "Train: WebSocket streaming", cat: "intelligence-training", pool: "warm", w: 4, desc: "Implement real WebSocket transport. Heartbeat, reconnection, binary frames, backpressure." },
    { id: "intel-train-005", name: "Train: Sacred geometry proofs", cat: "intelligence-training", pool: "warm", w: 3, desc: "Formalize Fibonacci, phi-ratio, torus topology foundations. Strengthen IP claims." },
    { id: "intel-train-006", name: "Train: Multi-agent consensus", cat: "intelligence-training", pool: "warm", w: 4, desc: "Study Raft, PBFT, gossip protocols. Implement consensus for swarm decisions." },
    { id: "intel-train-007", name: "Train: OpenTelemetry observability", cat: "intelligence-training", pool: "warm", w: 4, desc: "Wire traces, metrics, logs to OTel. Span context propagation, custom metrics." },
    { id: "intel-train-008", name: "Train: Knowledge distillation", cat: "intelligence-training", pool: "warm", w: 4, desc: "Compress session learnings into vectors. Embedding fine-tuning, recall optimization." },
    { id: "intel-train-009", name: "Train: Spaced repetition testing", cat: "intelligence-training", pool: "warm", w: 3, desc: "Re-test trained topics at Fibonacci intervals (1,2,3,5,8,13 days). Verify retention." },
    { id: "intel-train-010", name: "Train: Skill gap re-analysis", cat: "intelligence-training", pool: "hot", w: 5, desc: "Re-run skill gap analysis. Compare against last cycle. Verify improvement. Next curriculum." },

    // ─── DEVOPS (20 tasks) ──────────────────────────────────────────────────────
    { id: "devops-001", name: "CI pipeline validation", cat: "devops", pool: "hot", w: 5, desc: "Verify GitHub Actions / Cloud Build pipelines pass on latest commit" },
    { id: "devops-002", name: "Container image freshness", cat: "devops", pool: "warm", w: 4, desc: "Check all Docker images are built from latest source, no stale layers" },
    { id: "devops-003", name: "DNS record validation", cat: "devops", pool: "warm", w: 4, desc: "Verify all 16 Heady domains resolve correctly to expected IPs/CNAMEs" },
    { id: "devops-004", name: "SSL certificate expiry check", cat: "devops", pool: "hot", w: 5, desc: "Check SSL certs across all domains, warn if expiry < 30 days" },
    { id: "devops-005", name: "Cloud Run revision health", cat: "devops", pool: "hot", w: 5, desc: "Verify latest Cloud Run revisions are serving traffic with healthy instances" },
    { id: "devops-006", name: "Render service status", cat: "devops", pool: "hot", w: 4, desc: "Check all Render.com services are deployed and responding" },
    { id: "devops-007", name: "Database backup verification", cat: "devops", pool: "warm", w: 4, desc: "Confirm Neon Postgres backups completed within last 24h" },
    { id: "devops-008", name: "Log aggregation health", cat: "devops", pool: "warm", w: 3, desc: "Verify log pipeline is collecting from all services without gaps" },
    { id: "devops-009", name: "Environment variable audit", cat: "devops", pool: "cold", w: 3, desc: "Compare env vars across dev/staging/production for drift" },
    { id: "devops-010", name: "Dependency vulnerability scan", cat: "devops", pool: "hot", w: 5, desc: "Run npm audit across all packages, flag critical vulnerabilities" },
    { id: "devops-011", name: "Resource quota check", cat: "devops", pool: "warm", w: 3, desc: "Verify GCP resource quotas have sufficient headroom (>20%)" },
    { id: "devops-012", name: "CDN cache hit ratio", cat: "devops", pool: "warm", w: 3, desc: "Check Cloudflare cache hit ratio, optimize if below 80%" },
    { id: "devops-013", name: "Artifact registry cleanup", cat: "devops", pool: "cold", w: 2, desc: "Remove old container images and build artifacts older than 30 days" },
    { id: "devops-014", name: "Infrastructure as Code drift", cat: "devops", pool: "warm", w: 4, desc: "Compare render.yaml and cloudbuild.yaml against actual deployed state" },
    { id: "devops-015", name: "Service mesh connectivity", cat: "devops", pool: "hot", w: 4, desc: "Verify all internal service-to-service calls succeed with <100ms latency" },
    { id: "devops-016", name: "Secrets rotation status", cat: "devops", pool: "warm", w: 4, desc: "Check GCP Secret Manager for secrets approaching rotation deadline" },
    { id: "devops-017", name: "Auto-scaling validation", cat: "devops", pool: "warm", w: 3, desc: "Verify Cloud Run auto-scaling triggers at correct thresholds" },
    { id: "devops-018", name: "Monitoring alert coverage", cat: "devops", pool: "warm", w: 3, desc: "Ensure all critical services have alerting rules configured" },
    { id: "devops-019", name: "Uptime SLA calculation", cat: "devops", pool: "hot", w: 4, desc: "Calculate rolling 30-day uptime per service, flag below 99.9%" },
    { id: "devops-020", name: "Cost optimization scan", cat: "devops", pool: "cold", w: 3, desc: "Identify over-provisioned resources and recommend rightsizing" },

    // ─── TRADING (20 tasks) ─────────────────────────────────────────────────────
    { id: "trading-001", name: "Strategy backtest execution", cat: "trading", pool: "hot", w: 5, desc: "Run backtests on active trading strategies against last 30 days of data" },
    { id: "trading-002", name: "Risk limit validation", cat: "trading", pool: "hot", w: 5, desc: "Verify position sizes, max drawdown, and daily loss limits are enforced" },
    { id: "trading-003", name: "Kill-switch threshold check", cat: "trading", pool: "hot", w: 5, desc: "Confirm governance kill-switch fires at 45% daily loss (5% safety buffer)" },
    { id: "trading-004", name: "API token health", cat: "trading", pool: "hot", w: 5, desc: "Validate trading API tokens are active and have correct permissions" },
    { id: "trading-005", name: "Order execution latency", cat: "trading", pool: "warm", w: 4, desc: "Measure order-to-fill latency, alert if p95 exceeds 500ms" },
    { id: "trading-006", name: "Position reconciliation", cat: "trading", pool: "hot", w: 5, desc: "Compare internal position tracking vs broker-reported positions" },
    { id: "trading-007", name: "P&L calculation accuracy", cat: "trading", pool: "warm", w: 4, desc: "Verify P&L calculations match broker statements within 0.01% tolerance" },
    { id: "trading-008", name: "Market data feed health", cat: "trading", pool: "hot", w: 5, desc: "Check market data websocket connections are live with <1s staleness" },
    { id: "trading-009", name: "Strategy correlation check", cat: "trading", pool: "warm", w: 3, desc: "Calculate correlation matrix between active strategies, flag >0.8" },
    { id: "trading-010", name: "Drawdown recovery analysis", cat: "trading", pool: "warm", w: 4, desc: "Analyze drawdown events and recovery times, compare vs historical avg" },
    { id: "trading-011", name: "Slippage monitoring", cat: "trading", pool: "warm", w: 4, desc: "Track execution slippage per instrument, alert if avg exceeds 2bps" },
    { id: "trading-012", name: "Margin utilization check", cat: "trading", pool: "hot", w: 4, desc: "Monitor margin utilization, warn if above 70% of available" },
    { id: "trading-013", name: "EOD session boundary", cat: "trading", pool: "hot", w: 5, desc: "Verify EOD flatten at 4:59 PM ET executes correctly per governance rules" },
    { id: "trading-014", name: "Strategy parameter drift", cat: "trading", pool: "warm", w: 3, desc: "Detect if live strategy parameters have drifted from backtested optima" },
    { id: "trading-015", name: "Trade journal generation", cat: "trading", pool: "cold", w: 2, desc: "Auto-generate daily trade journal with entry/exit analysis" },
    { id: "trading-016", name: "Compliance rule validation", cat: "trading", pool: "warm", w: 4, desc: "Verify all trades comply with Apex PA rules and regulatory requirements" },
    { id: "trading-017", name: "Monte Carlo simulation", cat: "trading", pool: "warm", w: 4, desc: "Run Monte Carlo on current portfolio to estimate VaR and max drawdown" },
    { id: "trading-018", name: "Benchmark comparison", cat: "trading", pool: "cold", w: 3, desc: "Compare portfolio returns vs SPY/QQQ benchmarks on risk-adjusted basis" },
    { id: "trading-019", name: "Fee impact analysis", cat: "trading", pool: "cold", w: 2, desc: "Calculate total fees paid, compare vs expected, flag anomalies" },
    { id: "trading-020", name: "Data quality validation", cat: "trading", pool: "warm", w: 4, desc: "Check historical data for gaps, outliers, and corporate actions" },

    // ─── TESTING (20 tasks) ─────────────────────────────────────────────────────
    { id: "testing-001", name: "Unit test suite execution", cat: "testing", pool: "hot", w: 5, desc: "Run full Jest/Vitest test suite, report pass/fail/coverage" },
    { id: "testing-002", name: "Integration test validation", cat: "testing", pool: "hot", w: 5, desc: "Execute integration tests against live service endpoints" },
    { id: "testing-003", name: "Code coverage analysis", cat: "testing", pool: "warm", w: 4, desc: "Calculate code coverage, flag files below 60% threshold" },
    { id: "testing-004", name: "API contract testing", cat: "testing", pool: "warm", w: 4, desc: "Validate all API endpoints match their OpenAPI/Swagger schemas" },
    { id: "testing-005", name: "Snapshot test freshness", cat: "testing", pool: "cold", w: 2, desc: "Check snapshot tests are up-to-date, regenerate stale snapshots" },
    { id: "testing-006", name: "E2E smoke tests", cat: "testing", pool: "hot", w: 5, desc: "Run critical path E2E tests: auth flow, API gateway, pipeline trigger" },
    { id: "testing-007", name: "Load test execution", cat: "testing", pool: "cold", w: 3, desc: "Run load tests at 2x expected traffic, verify response times" },
    { id: "testing-008", name: "Regression test sweep", cat: "testing", pool: "warm", w: 4, desc: "Execute regression suite against recently changed files" },
    { id: "testing-009", name: "Test flakiness detection", cat: "testing", pool: "warm", w: 3, desc: "Identify flaky tests by running suite 3x, flag inconsistent results" },
    { id: "testing-010", name: "Security test execution", cat: "testing", pool: "hot", w: 5, desc: "Run OWASP ZAP or equivalent against API endpoints" },
    { id: "testing-011", name: "Mutation testing", cat: "testing", pool: "cold", w: 3, desc: "Run mutation tests to validate test quality and catch weak assertions" },
    { id: "testing-012", name: "Performance benchmark", cat: "testing", pool: "warm", w: 4, desc: "Run CSL benchmark suite, compare against baseline scores" },
    { id: "testing-013", name: "Memory leak detection", cat: "testing", pool: "warm", w: 4, desc: "Profile memory usage over 1000 requests, flag growing heap" },
    { id: "testing-014", name: "Event bus test coverage", cat: "testing", pool: "warm", w: 3, desc: "Verify all event bus topics have at least one test subscriber" },
    { id: "testing-015", name: "Database migration test", cat: "testing", pool: "warm", w: 4, desc: "Run migrations up and down on test database, verify idempotency" },
    { id: "testing-016", name: "Config validation tests", cat: "testing", pool: "warm", w: 3, desc: "Validate all YAML configs parse correctly and match schemas" },
    { id: "testing-017", name: "Agent behavior tests", cat: "testing", pool: "warm", w: 4, desc: "Test argus/hermes/kronos v2 agent lifecycle: init, execute, shutdown" },
    { id: "testing-018", name: "WebSocket connection tests", cat: "testing", pool: "warm", w: 3, desc: "Test SSE/WebSocket endpoints for connection stability and message delivery" },
    { id: "testing-019", name: "CORS validation tests", cat: "testing", pool: "warm", w: 3, desc: "Verify CORS headers correct for all 16 whitelisted domains" },
    { id: "testing-020", name: "Rate limit tests", cat: "testing", pool: "warm", w: 3, desc: "Test rate limiter enforces 100 req/min per IP correctly" },

    // ─── DEPLOYMENT (20 tasks) ──────────────────────────────────────────────────
    { id: "deploy-001", name: "Canary deployment analysis", cat: "deployment", pool: "hot", w: 5, desc: "Monitor canary deployment error rate vs baseline, auto-rollback if >2x" },
    { id: "deploy-002", name: "Rollback readiness check", cat: "deployment", pool: "hot", w: 5, desc: "Verify previous known-good revision is available for instant rollback" },
    { id: "deploy-003", name: "Blue-green switch validation", cat: "deployment", pool: "warm", w: 4, desc: "Confirm blue-green deployment switch completes with zero dropped requests" },
    { id: "deploy-004", name: "Post-deploy health gates", cat: "deployment", pool: "hot", w: 5, desc: "After deploy, verify all health endpoints return 200 within 30s" },
    { id: "deploy-005", name: "Database migration status", cat: "deployment", pool: "hot", w: 5, desc: "Confirm all pending migrations applied successfully before traffic shift" },
    { id: "deploy-006", name: "Feature flag status", cat: "deployment", pool: "warm", w: 3, desc: "Audit active feature flags, remove stale flags older than 30 days" },
    { id: "deploy-007", name: "Deployment frequency tracking", cat: "deployment", pool: "cold", w: 2, desc: "Track deployment frequency per service, target daily deploys" },
    { id: "deploy-008", name: "Change failure rate", cat: "deployment", pool: "warm", w: 4, desc: "Calculate change failure rate (rollbacks/total deploys), target <5%" },
    { id: "deploy-009", name: "Mean time to recovery", cat: "deployment", pool: "warm", w: 4, desc: "Track MTTR per incident, target <15 minutes" },
    { id: "deploy-010", name: "Lead time for changes", cat: "deployment", pool: "cold", w: 3, desc: "Measure commit-to-production lead time, target <1 hour" },
    { id: "deploy-011", name: "Dependency update check", cat: "deployment", pool: "warm", w: 3, desc: "Check for outdated npm dependencies with known security patches" },
    { id: "deploy-012", name: "Build artifact integrity", cat: "deployment", pool: "warm", w: 4, desc: "Verify build artifact checksums match expected hashes" },
    { id: "deploy-013", name: "Multi-region readiness", cat: "deployment", pool: "cold", w: 3, desc: "Verify service can be deployed to secondary region within 5 minutes" },
    { id: "deploy-014", name: "Smoke test post-deploy", cat: "deployment", pool: "hot", w: 5, desc: "Run critical path smoke tests immediately after every deployment" },
    { id: "deploy-015", name: "Config drift detection", cat: "deployment", pool: "warm", w: 4, desc: "Compare deployed config vs repo config, flag any drift" },
    { id: "deploy-016", name: "Service discovery update", cat: "deployment", pool: "warm", w: 3, desc: "Verify service registry reflects latest deployed versions" },
    { id: "deploy-017", name: "Traffic shift validation", cat: "deployment", pool: "hot", w: 4, desc: "Confirm traffic routing updated to new revision across all regions" },
    { id: "deploy-018", name: "Webhook notification", cat: "deployment", pool: "warm", w: 3, desc: "Send deploy notification to Slack/Discord with version and changelog" },
    { id: "deploy-019", name: "Resource scaling verification", cat: "deployment", pool: "warm", w: 3, desc: "Verify auto-scaling rules active on newly deployed revision" },
    { id: "deploy-020", name: "Deployment audit log", cat: "deployment", pool: "cold", w: 2, desc: "Record deployment event in immutable audit log with actor and diff" },

    // ─── DOCUMENTATION (15 tasks) ───────────────────────────────────────────────
    { id: "docs-001", name: "API docs freshness check", cat: "documentation", pool: "warm", w: 4, desc: "Compare API endpoint implementations vs documented endpoints, flag gaps" },
    { id: "docs-002", name: "Changelog generation", cat: "documentation", pool: "warm", w: 3, desc: "Generate changelog from conventional commits since last release" },
    { id: "docs-003", name: "README accuracy audit", cat: "documentation", pool: "cold", w: 2, desc: "Verify README instructions work when followed step-by-step" },
    { id: "docs-004", name: "Architecture diagram sync", cat: "documentation", pool: "cold", w: 3, desc: "Check architecture diagrams match current service topology" },
    { id: "docs-005", name: "Doc ownership freshness", cat: "documentation", pool: "warm", w: 3, desc: "Check DOC_OWNERS.yaml for overdue reviews per ownership policy" },
    { id: "docs-006", name: "Colab notebook validation", cat: "documentation", pool: "warm", w: 4, desc: "Verify all Colab notebooks parse and reference correct API endpoints" },
    { id: "docs-007", name: "Config documentation sync", cat: "documentation", pool: "warm", w: 3, desc: "Ensure all YAML configs have corresponding documentation entries" },
    { id: "docs-008", name: "Error message catalog", cat: "documentation", pool: "cold", w: 2, desc: "Catalog all user-facing error messages, ensure they are helpful and consistent" },
    { id: "docs-009", name: "SDK usage examples", cat: "documentation", pool: "warm", w: 3, desc: "Verify Sacred Geometry SDK and Agent SDK have working usage examples" },
    { id: "docs-010", name: "Runbook completeness", cat: "documentation", pool: "warm", w: 4, desc: "Verify runbooks exist for all critical incident scenarios" },
    { id: "docs-011", name: "TypeScript type coverage", cat: "documentation", pool: "cold", w: 2, desc: "Check JSDoc type annotations cover all exported functions" },
    { id: "docs-012", name: "Migration guide currency", cat: "documentation", pool: "cold", w: 2, desc: "Ensure upgrade/migration guides cover latest breaking changes" },
    { id: "docs-013", name: "Environment setup guide", cat: "documentation", pool: "cold", w: 2, desc: "Validate dev environment setup guide works on fresh machine" },
    { id: "docs-014", name: "Glossary maintenance", cat: "documentation", pool: "cold", w: 1, desc: "Update Heady glossary with new terms (CSL, HCFP, ORS, etc.)" },
    { id: "docs-015", name: "Compliance documentation", cat: "documentation", pool: "warm", w: 4, desc: "Verify SOC 2, GDPR, and data handling docs are current" },

    // ─── BILLING (16 tasks) ─────────────────────────────────────────────────────
    { id: "billing-001", name: "Stripe webhook health", cat: "billing", pool: "hot", w: 5, desc: "Verify Stripe webhooks are delivering and being processed correctly" },
    { id: "billing-002", name: "Usage metering accuracy", cat: "billing", pool: "hot", w: 5, desc: "Compare metered usage vs actual resource consumption, flag >5% drift" },
    { id: "billing-003", name: "Invoice generation test", cat: "billing", pool: "warm", w: 4, desc: "Generate test invoice for each billing model, verify line items" },
    { id: "billing-004", name: "Subscription lifecycle check", cat: "billing", pool: "warm", w: 4, desc: "Test create/upgrade/downgrade/cancel subscription flows end-to-end" },
    { id: "billing-005", name: "Revenue recognition audit", cat: "billing", pool: "warm", w: 3, desc: "Verify MRR/ARR calculations match actual Stripe data" },
    { id: "billing-006", name: "Platform fee calculation", cat: "billing", pool: "warm", w: 4, desc: "Verify 20% marketplace platform fee is calculated correctly" },
    { id: "billing-007", name: "Discount code validation", cat: "billing", pool: "cold", w: 2, desc: "Test discount code application and expiry enforcement" },
    { id: "billing-008", name: "Payment failure handling", cat: "billing", pool: "hot", w: 5, desc: "Verify dunning flow: retry logic, grace period, suspension" },
    { id: "billing-009", name: "Tier upgrade triggers", cat: "billing", pool: "warm", w: 3, desc: "Verify automatic tier upgrades trigger at correct usage thresholds" },
    { id: "billing-010", name: "Tax calculation accuracy", cat: "billing", pool: "warm", w: 3, desc: "Verify tax calculations for different jurisdictions" },
    { id: "billing-011", name: "Refund processing test", cat: "billing", pool: "cold", w: 2, desc: "Test refund flow: partial refund, full refund, credit application" },
    { id: "billing-012", name: "Usage dashboard accuracy", cat: "billing", pool: "warm", w: 3, desc: "Verify tenant-facing usage dashboard matches internal metering" },
    { id: "billing-013", name: "Free tier enforcement", cat: "billing", pool: "warm", w: 4, desc: "Verify free tier limits enforced: API calls, vector storage, pipeline runs" },
    { id: "billing-014", name: "Multi-currency support", cat: "billing", pool: "cold", w: 2, desc: "Verify pricing displays correctly in USD, EUR, GBP" },
    { id: "billing-015", name: "Revenue metrics dashboard", cat: "billing", pool: "warm", w: 3, desc: "Verify revenue metrics: ARPU, LTV, churn rate calculations" },
    { id: "billing-016", name: "Billing API rate limits", cat: "billing", pool: "warm", w: 3, desc: "Verify billing API endpoints have appropriate rate limits" },

    // ─── MARKETPLACE (15 tasks) ─────────────────────────────────────────────────
    { id: "mktplace-001", name: "Agent listing validation", cat: "marketplace", pool: "hot", w: 5, desc: "Verify all marketplace agent listings have valid manifests and bundles" },
    { id: "mktplace-002", name: "Agent install flow test", cat: "marketplace", pool: "hot", w: 5, desc: "Test end-to-end agent install: browse, select, install, verify running" },
    { id: "mktplace-003", name: "Usage tracking accuracy", cat: "marketplace", pool: "warm", w: 4, desc: "Verify per-agent usage metering matches actual invocations" },
    { id: "mktplace-004", name: "Revenue share calculation", cat: "marketplace", pool: "warm", w: 4, desc: "Verify 20% platform fee split is calculated correctly per transaction" },
    { id: "mktplace-005", name: "Agent version management", cat: "marketplace", pool: "warm", w: 3, desc: "Test agent version upgrade flow: publish new version, notify users" },
    { id: "mktplace-006", name: "Agent sandbox isolation", cat: "marketplace", pool: "hot", w: 5, desc: "Verify marketplace agents run in isolated sandbox, no cross-tenant access" },
    { id: "mktplace-007", name: "Rating system integrity", cat: "marketplace", pool: "warm", w: 3, desc: "Verify agent ratings can only be submitted by users who installed the agent" },
    { id: "mktplace-008", name: "Agent search relevance", cat: "marketplace", pool: "warm", w: 3, desc: "Test marketplace search returns relevant results for common queries" },
    { id: "mktplace-009", name: "Agent uninstall cleanup", cat: "marketplace", pool: "warm", w: 3, desc: "Verify agent uninstall removes all resources and stops billing" },
    { id: "mktplace-010", name: "Publisher onboarding flow", cat: "marketplace", pool: "cold", w: 2, desc: "Test agent publisher registration and submission review flow" },
    { id: "mktplace-011", name: "Agent health monitoring", cat: "marketplace", pool: "hot", w: 4, desc: "Monitor installed agent health, auto-disable if crash rate >10%" },
    { id: "mktplace-012", name: "Marketplace API rate limits", cat: "marketplace", pool: "warm", w: 3, desc: "Verify marketplace API endpoints have per-tenant rate limits" },
    { id: "mktplace-013", name: "Agent bundle security scan", cat: "marketplace", pool: "hot", w: 5, desc: "Scan agent bundles for malicious code patterns before listing approval" },
    { id: "mktplace-014", name: "Featured agent rotation", cat: "marketplace", pool: "cold", w: 2, desc: "Rotate featured agents on marketplace homepage weekly" },
    { id: "mktplace-015", name: "Developer documentation", cat: "marketplace", pool: "cold", w: 2, desc: "Verify agent developer docs cover SDK, submission, and billing" },

    // ─── SACRED GEOMETRY (10 tasks) ─────────────────────────────────────────────
    { id: "sacred-001", name: "PHI constant precision", cat: "sacred-geometry", pool: "hot", w: 5, desc: "Verify PHI=1.618033988749895 used consistently across all modules" },
    { id: "sacred-002", name: "Fibonacci sequence accuracy", cat: "sacred-geometry", pool: "warm", w: 4, desc: "Test fibonacci() function against known values up to fib(50)" },
    { id: "sacred-003", name: "CSS breakpoint validation", cat: "sacred-geometry", pool: "warm", w: 3, desc: "Verify phi-breakpoints render correctly at 320/518/838/1356/2194" },
    { id: "sacred-004", name: "Typography scale harmony", cat: "sacred-geometry", pool: "warm", w: 3, desc: "Validate phi-typography scale produces harmonious size ratios" },
    { id: "sacred-005", name: "Golden spiral rendering", cat: "sacred-geometry", pool: "cold", w: 2, desc: "Render golden spiral coordinates, verify visual accuracy" },
    { id: "sacred-006", name: "Torus layout integrity", cat: "sacred-geometry", pool: "cold", w: 2, desc: "Verify torus layout produces valid 3D coordinates with no collisions" },
    { id: "sacred-007", name: "Metatron grid accuracy", cat: "sacred-geometry", pool: "cold", w: 2, desc: "Validate Metatron's Cube grid generates correct connection patterns" },
    { id: "sacred-008", name: "PHI timing consistency", cat: "sacred-geometry", pool: "warm", w: 4, desc: "Verify all phi-backoff and phi-timing values match expected φ^n calculations" },
    { id: "sacred-009", name: "CSS custom properties export", cat: "sacred-geometry", pool: "warm", w: 3, desc: "Verify generateCSSCustomProperties() outputs valid CSS with all variables" },
    { id: "sacred-010", name: "SDK cross-platform test", cat: "sacred-geometry", pool: "cold", w: 3, desc: "Test sacred-geometry-sdk works in Node.js, browser, and Colab environments" },

    // ─── GOVERNANCE (15 tasks) ──────────────────────────────────────────────────
    { id: "gov-001", name: "Kill-switch fire drill", cat: "governance", pool: "hot", w: 5, desc: "Simulate 51% daily loss, verify flatten-and-sever executes correctly" },
    { id: "gov-002", name: "Audit trail immutability", cat: "governance", pool: "hot", w: 5, desc: "Verify audit log entries cannot be modified or deleted after creation" },
    { id: "gov-003", name: "Role-based access check", cat: "governance", pool: "warm", w: 4, desc: "Test RBAC: admin bypass, sensitive action blocking, least privilege" },
    { id: "gov-004", name: "Budget limit enforcement", cat: "governance", pool: "hot", w: 5, desc: "Verify per-session token/USD consumption limits trigger correctly" },
    { id: "gov-005", name: "Content safety filters", cat: "governance", pool: "warm", w: 4, desc: "Test content safety regex blocks SSN, credit card, password patterns" },
    { id: "gov-006", name: "Mission alignment check", cat: "governance", pool: "warm", w: 3, desc: "Verify anti-mission phrase blocking is active and up-to-date" },
    { id: "gov-007", name: "Policy engine evaluation", cat: "governance", pool: "warm", w: 4, desc: "Test custom policy evaluation with various action/actor/domain combos" },
    { id: "gov-008", name: "Trading consistency rule", cat: "governance", pool: "hot", w: 5, desc: "Verify 50% daily profit cap with 45% safety buffer enforced" },
    { id: "gov-009", name: "Hallucination watchdog test", cat: "governance", pool: "hot", w: 5, desc: "Feed known false claim to watchdog, verify BLOCK disposition" },
    { id: "gov-010", name: "Data residency compliance", cat: "governance", pool: "warm", w: 3, desc: "Verify tenant data stays in declared geographic region" },
    { id: "gov-011", name: "Access log completeness", cat: "governance", pool: "warm", w: 4, desc: "Verify all API requests are logged with actor, action, and timestamp" },
    { id: "gov-012", name: "Encryption at rest check", cat: "governance", pool: "warm", w: 4, desc: "Verify all stored data (Neon, GCS, vectors) is encrypted at rest" },
    { id: "gov-013", name: "Encryption in transit check", cat: "governance", pool: "warm", w: 4, desc: "Verify all inter-service communication uses TLS 1.2+" },
    { id: "gov-014", name: "SOC 2 control validation", cat: "governance", pool: "cold", w: 3, desc: "Validate SOC 2 Type II controls are operational and documented" },
    { id: "gov-015", name: "Incident response readiness", cat: "governance", pool: "warm", w: 4, desc: "Verify incident response runbook is current and contacts are valid" },
];

// ─── DYNAMIC JSON TASK LOADER ──────────────────────────────────────────────────
const JSON_TASK_FILES = [
  'architecture-fix-tasks.json',
  'autocontext-integration-tasks.json',
  'autonomy-enhancement-tasks.json',
  'beneficial-bundle-tasks.json',
  'unimplemented-arch-tasks.json',
];

let JSON_TASKS = [];
try {
  const path = require('path');
  for (const file of JSON_TASK_FILES) {
    const filePath = path.join(__dirname, '..', 'orchestration', file);
    try {
      const data = require(filePath);
      const tasks = Array.isArray(data) ? data : (data.tasks || data.categories || []);
      JSON_TASKS = JSON_TASKS.concat(tasks);
    } catch (e) {
      console.warn(`[auto-success-catalog] Failed to load JSON task file "${file}": ${e.message}`);
    }
  }
} catch (e) { /* Fallback — no dynamic loading in non-Node environments */ }

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION DEFAULTS — MAX EFFORT UNLESS USER OVERRIDES
// HCFullPipeline and Auto-Success always run at maximum effort by default.
// Set effortLevel to 'standard' or 'minimal' only via explicit user request.
// ═══════════════════════════════════════════════════════════════════════════════
const EXECUTION_CONFIG = {
  effortLevel: 'max',                // DEFAULT: max | standard | minimal
  perpetualLoop: true,               // perp-opt tasks always re-queue on completion
  perpetualThresholdIncrease: 0.10,  // raise bar 10% each cycle
  maxRetriesPerTask: 3,              // retry failed tasks up to 3x before cold pool
  hotPoolPriority: 'fifo-weighted',  // weight 5 tasks run first
  idleCycleUtilization: 1.0,         // use 100% of idle cycles for auto-success
  codingPracticeMinDaily: 20,        // minimum coding challenges per day
  skillGapClosureTarget: '48h',      // close #1 skill gap every 48 hours
  standingDirective: '.heady/directives/full-spectrum-optimization.md',
};

// ─── EXPORTS ────────────────────────────────────────────────────────────────────
module.exports = { TASK_CATALOG, JSON_TASKS, JSON_TASK_FILES, EXECUTION_CONFIG };

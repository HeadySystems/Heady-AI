/**
 * Heady Latent OS — Maximum Potential Build (Wave 3)
 * Central module registry and export aggregator
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */

// ── Shared Foundation ────────────────────────────────────────────
export { default as PhiMath } from './shared/phi-math-v2.js';
export { default as CslEngine } from './shared/csl-engine-v2.js';
export { default as SacredGeometry } from './shared/sacred-geometry-v2.js';

// ── Core ─────────────────────────────────────────────────────────
export { default as EvolutionEngine } from './core/evolution-engine.js';
export { default as PersonaRouter } from './core/persona-router.js';
export { default as WisdomStore } from './core/wisdom-store.js';
export { default as BudgetTracker } from './core/budget-tracker.js';
export { default as HeadyLens } from './core/heady-lens.js';
export { default as CouncilMode } from './core/council-mode.js';
export { default as AutoSuccessEngine } from './core/auto-success-engine.js';
export { default as HeadyBrains } from './core/heady-brains.js';
export { default as HeadyAutobiographer } from './core/heady-autobiographer.js';
export { default as HeadyManagerKernel } from './core/heady-manager-kernel.js';

// ── Auth ─────────────────────────────────────────────────────────
export { default as AuthGateway } from './auth/auth-gateway.js';

// ── Agents ───────────────────────────────────────────────────────
export { default as BeeFactory } from './agents/bee-factory.js';
export { default as HiveCoordinator } from './agents/hive-coordinator.js';
export { default as FederationManager } from './agents/federation-manager.js';

// ── Memory ───────────────────────────────────────────────────────
export { default as VectorStore } from './memory/vector-store.js';
export { default as EmbeddingPipeline } from './memory/embedding-pipeline.js';
export { default as ProjectionEngine } from './memory/projection-engine.js';
export { default as MemoryCache } from './memory/memory-cache.js';

// ── Services ─────────────────────────────────────────────────────
export { default as ServiceRegistry } from './services/service-registry.js';
export { default as ServiceMesh } from './services/service-mesh.js';
export { default as AuthSessionServer } from './services/auth-session-server.js';
export { default as NotificationService } from './services/notification-service.js';
export { default as AnalyticsService } from './services/analytics-service.js';
export { default as BillingService } from './services/billing-service.js';
export { default as SearchService } from './services/search-service.js';
export { default as SchedulerService } from './services/scheduler-service.js';
export { default as MigrationService } from './services/migration-service.js';
export { default as AssetPipeline } from './services/asset-pipeline.js';

// ── Security ─────────────────────────────────────────────────────
export { default as RbacEngine } from './security/rbac-engine.js';
export { default as CryptoAuditTrail } from './security/crypto-audit-trail.js';
export { default as SecretManager } from './security/secret-manager.js';
export { default as CspMiddleware } from './security/csp-middleware.js';
export { default as PromptInjectionGuard } from './security/prompt-injection-guard.js';
export { default as WebsocketAuth } from './security/websocket-auth.js';
export { default as SbomGenerator } from './security/sbom-generator.js';
export { default as AutonomyGuardrails } from './security/autonomy-guardrails.js';
export { default as OWASPAIDefense } from './security/owasp-ai-defense.js';
export { default as StructuredLogger } from './security/structured-logger.js';
export { default as RequestSigner } from './security/request-signer.js';
export { default as CorsStrict } from './security/cors-strict.js';

// ── Monitoring ───────────────────────────────────────────────────
export { default as HealthProbeSystem } from './monitoring/health-probe-system.js';
export { default as DriftDetector } from './monitoring/drift-detector.js';
export { default as TelemetryCollector } from './monitoring/telemetry-collector.js';
export { default as IncidentResponder } from './monitoring/incident-responder.js';

// ── Scaling ──────────────────────────────────────────────────────
export { default as AutoScaler } from './scaling/auto-scaler.js';
export { default as ResourceAllocator } from './scaling/resource-allocator.js';
export { default as JitLoader } from './scaling/jit-loader.js';
export { default as CqrsManager } from './scaling/cqrs-manager.js';
export { default as SagaCoordinator } from './scaling/saga-coordinator.js';
export { default as FeatureFlags } from './scaling/feature-flags.js';
export { default as DeadLetterQueue } from './scaling/dead-letter-queue.js';
export { default as ApiContracts } from './scaling/api-contracts.js';
export { default as ErrorCodes } from './scaling/error-codes.js';
export { default as HeadyServicesProto } from './scaling/heady-services.proto.js';
export { default as EventBusNATS } from './scaling/event-bus-nats.js';
export { default as PgBouncerPool } from './scaling/pgbouncer-pool.js';
export { default as HNSWTuner } from './scaling/hnsw-tuner.js';
export { default as CloudRunOptimizer } from './scaling/cloud-run-optimizer.js';
export { default as GrpcBridge } from './scaling/grpc-bridge.js';

// ── Deploy ───────────────────────────────────────────────────────
export { default as UniversalContainer } from './deploy/universal-container.js';
export { default as CloudRunDeployer } from './deploy/cloud-run-deployer.js';
export { default as CloudflareDeployer } from './deploy/cloudflare-deployer.js';

// ── Config ───────────────────────────────────────────────────────
export { default as HeadyConfig } from './config/heady-config.js';
export { default as PipelineCanonical } from './config/pipeline-canonical.js';
export { default as EnvironmentConfig } from './config/environment-config.js';

// ── Websites ─────────────────────────────────────────────────────
export { default as WebsiteRegistry } from './websites/website-registry.js';

// ── Orchestration ────────────────────────────────────────────────
export { default as HcfpRunner } from './orchestration/hcfp-runner.js';
export { default as ArenaModeEnhanced } from './orchestration/arena-mode-enhanced.js';
export { default as SwarmDefinitions } from './orchestration/swarm-definitions.js';
export { default as SocraticLoop } from './orchestration/socratic-loop.js';

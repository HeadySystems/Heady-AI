# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Codeflow API — distroless Node 22 (Cloud Run)             ║
# ║  Build context = repo root (relative import of packages/phi-math). ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
# ╚══════════════════════════════════════════════════════════════════╝
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
# Dependency-free ESM — copy only the two source trees + status snapshots.
COPY packages/phi-math/src ./packages/phi-math/src
COPY packages/codeflow/src ./packages/codeflow/src
COPY .data/coherence/coherence-report.json ./.data/coherence/coherence-report.json
COPY .data/coherence/variable-registry.json ./.data/coherence/variable-registry.json
COPY .data/decomposition/decomposition-report.json ./.data/decomposition/decomposition-report.json
ENV NODE_ENV=production
# Cloud Run injects PORT; FIREBASE_PROJECT_ID + CODEFLOW_ORIGIN come from --set-env-vars.
CMD ["packages/codeflow/src/server.mjs"]

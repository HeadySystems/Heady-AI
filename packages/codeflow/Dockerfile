# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Codeflow API container — dependency-free ESM on Node 22    ║
# ║  Build context = repo root. The server imports sibling packages    ║
# ║  via relative paths (phi-math, csl-engine, consistency-bus,        ║
# ║  perspective) — all pure ESM, no node_modules required.            ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
# ╚══════════════════════════════════════════════════════════════════╝
FROM node:22-slim

WORKDIR /app

# Source-only copy (node_modules / .env / dropzone excluded by .gcloudignore).
COPY packages ./packages
COPY tooling ./tooling
COPY facts.yaml lexicon.yaml ./

# Recreate the pnpm-workspace resolution: symlink every @heady/* package by its
# package.json name into node_modules so bare specifiers (e.g. @heady/phi-math
# imported by @heady/csl-engine) resolve without a full install. Pure ESM, no deps.
RUN mkdir -p node_modules/@heady && \
    for d in packages/*/; do \
      name=$(node -e "try{process.stdout.write(require('./${d}package.json').name)}catch{}"); \
      case "$name" in \
        @heady/*) ln -sfn "/app/${d%/}" "/app/node_modules/${name}" ;; \
      esac; \
    done

ENV NODE_ENV=production
# Cloud Run injects PORT (8080); server.mjs reads process.env.PORT.

USER node
CMD ["node", "packages/codeflow/src/server.mjs"]

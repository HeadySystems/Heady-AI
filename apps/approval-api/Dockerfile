# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Approval API Container v1.0.0                           ║
# ║  Reproducible, non-root Cloud Run runtime for the control plane.║
# ║  Made with ❤️ by HeadySystems Inc.                              ║
# ╚══════════════════════════════════════════════════════════════════╝

FROM --platform=linux/amd64 docker.io/library/node:22.22.0-bookworm-slim@sha256:7cc56ef285a8568121537d17b05e72128f01b89c54607b51acf084a50ef483f3

ENV NODE_ENV=production
WORKDIR /workspace

COPY apps/approval-api/runtime/package.json apps/approval-api/runtime/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY apps/approval-api/package.json apps/approval-api/package.json
COPY apps/approval-api/src apps/approval-api/src
COPY packages/approvals/package.json node_modules/@heady/approvals/package.json
COPY packages/approvals/src node_modules/@heady/approvals/src
COPY packages/approvals/policy node_modules/@heady/approvals/policy
COPY packages/logger/package.json node_modules/@heady/logger/package.json
COPY packages/logger/src node_modules/@heady/logger/src
COPY packages/phi-math/package.json node_modules/@heady/phi-math/package.json
COPY packages/phi-math/src node_modules/@heady/phi-math/src
COPY packages/secrets/package.json node_modules/@heady/secrets/package.json
COPY packages/secrets/src node_modules/@heady/secrets/src
COPY packages/shared/package.json node_modules/@heady/shared/package.json
COPY packages/shared/src node_modules/@heady/shared/src
COPY policies/approval.rego node_modules/policies/approval.rego

USER node

CMD ["node", "apps/approval-api/src/index.mjs"]

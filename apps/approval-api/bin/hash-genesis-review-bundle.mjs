// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Genesis Review Bundle Hasher v1.0.0                    ║
// ║  Emits the externally reviewable executor source digest.      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { buildGenesisReviewDigest } from "../src/genesis-review-digest.mjs";

process.stdout.write(`${JSON.stringify(buildGenesisReviewDigest(), null, 2)}\n`);

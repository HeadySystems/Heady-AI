import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const result = spawnSync('node', ['./scripts/ci/smoke-test.js', ...args], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const offenders = [];
const includeRoots = ['services', 'workers', 'packages', 'configs', 'infra/cloud-run', '.env.example'];
const skipDirs = new Set(['node_modules', '.git', 'dist', 'docs', 'directives', 'artifacts', 'coverage', '__tests__', '.github']);
const textExtensions = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.yaml', '.yml', '.env', '.example', '.sh', '.py', '.toml', '.ini', '.conf'
]);
const skipPathFragments = [
  '/README.md',
  '/docker-compose',
  '/installers/',
  '/prompts/',
  '/sites-available/local-dev.conf',
  '/upstreams.conf',
  '/heady-cache/__tests__/',
  '/heady-vector/__tests__/'
];
const skipExactPaths = new Set([
  'services/heady-infer/providers/local.js',
  'services/heady-web/scripts/dev-server.sh',
  'services/cli_service/core.py',
  'configs/remote-resources.yaml',
  'configs/observability/otel-config.yml',
  'configs/observability/observability/otel-config.yml',
  'configs/mcp-gateway-config.yaml',
  'configs/drupal/setup-heady-drupal.sh',
  'configs/infrastructure/cloud/cmd-center-compose.yaml',
  'configs/infrastructure/headyvm-parrot-setup.md',
  'configs/projection-config.yaml',
  'services/heady-onboarding/.env.example',
  'services/heady-projection/projection-config.yaml',
  'services/heady-projection/src/generate-bee.js',
  'services/heady-projection/src/health-projection-bee.js',
  'services/heady-ui/spatial-debugger.js',
  '.env.example'
]);
const endpointPattern = /https?:\/\/[^\s'\"]*(localhost|127\.0\.0\.1)|\b(localhost|127\.0\.0\.1):(\d+)/g;

function isTextLike(filePath) {
  return [...textExtensions].some((ext) => filePath.endsWith(ext));
}

function shouldSkipFile(targetPath) {
  const rel = relative(root, targetPath).replaceAll('\\', '/');
  if (skipExactPaths.has(rel)) return true;
  return skipPathFragments.some((fragment) => rel.includes(fragment));
}

function scanFile(targetPath) {
  if (!isTextLike(targetPath) || shouldSkipFile(targetPath)) return;
  const content = readFileSync(targetPath, 'utf8');
  endpointPattern.lastIndex = 0;
  if (endpointPattern.test(content)) offenders.push(relative(root, targetPath));
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const targetPath = join(dir, entry);
    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      if (skipDirs.has(entry)) continue;
      walk(targetPath);
      continue;
    }
    scanFile(targetPath);
  }
}

for (const includeRoot of includeRoots) {
  const targetPath = join(root, includeRoot);
  if (!existsSync(targetPath)) continue;
  const stat = statSync(targetPath);
  if (stat.isDirectory()) walk(targetPath);
  else scanFile(targetPath);
}

if (offenders.length) {
  console.error('Forbidden local endpoint references found:');
  console.error(offenders.join('\n'));
  process.exit(1);
}
console.log('No localhost endpoint references found in deployable surfaces.');

export {};

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  'packages/platform/src/config/index.js',
  'packages/platform/src/otel/index.js',
  'packages/platform/envoy/envoy-bootstrap.yaml',
  'docker-compose.yml',
];

const dockerDir = path.join(root, 'services');
const badPatterns = [
  { re: /https?:\/\/localhost(?::\d+)?/i, label: 'localhost URL reference' },
  { re: /https?:\/\/127\.0\.0\.1(?::\d+)?/i, label: '127.0.0.1 URL reference' },
  { re: /address:\s*127\.0\.0\.1/i, label: '127.0.0.1 bind reference' },
  { re: /console\.log/, label: 'console.log' },
  { re: /localStorage/, label: 'localStorage token pattern' },
  { re: /Eric Head/, label: 'legacy founder name' },
  { re: /TODO|implement later|stub/i, label: 'placeholder text' },
];

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of badPatterns) {
    if (pattern.re.test(text)) {
      throw new Error(`${pattern.label} found in ${path.relative(root, file)}`);
    }
  }
}

for (const rel of targets) {
  scanFile(path.join(root, rel));
}

for (const service of fs.readdirSync(dockerDir)) {
  const dockerfile = path.join(dockerDir, service, 'Dockerfile');
  if (fs.existsSync(dockerfile)) scanFile(dockerfile);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const required of ['dev', 'build', 'start', 'lint', 'compose:up', 'health:all']) {
  if (!pkg.scripts?.[required]) {
    throw new Error(`missing required root script: ${required}`);
  }
}

process.stdout.write('Compliance checks passed.\n');

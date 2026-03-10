import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'services', 'SERVICE_INDEX.json');
const baseHost = process.env.HEALTHCHECK_HOST ?? '0.0.0.0';
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS ?? 5000);
const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

const controllerTimeout = (controller) => setTimeout(() => controller.abort(), timeoutMs);

async function checkService(service) {
  const url = `http://${baseHost}:${service.port}/health/live`;
  const controller = new AbortController();
  const timer = controllerTimeout(controller);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return {
      service: service.id,
      port: service.port,
      ok: res.ok,
      status: res.status,
      url,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      service: service.id,
      port: service.port,
      ok: false,
      status: 'ERR',
      url,
      error: error.message,
    };
  }
}

const results = [];
for (const service of data.services) {
  results.push(await checkService(service));
}

const failures = results.filter((r) => !r.ok);
for (const result of results) {
  const suffix = result.error ? ` ${result.error}` : '';
  process.stdout.write(`${result.service.padEnd(28)} ${String(result.status).padEnd(4)} ${result.url}${suffix}\n`);
}

if (failures.length) {
  process.stderr.write(`Health validation failed for ${failures.length} service(s).\n`);
  process.exit(1);
}

process.stdout.write(`Validated ${results.length} services.\n`);

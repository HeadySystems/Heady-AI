// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Document Hydrator v1.1.0                                   ║
// ║  Compiles Handlebars-style templates using live ecosystem data.     ║
// ║  v1.1.0: pure template core exported for tests (resolvePath /       ║
// ║  renderTemplate), CLI entry behind the argv guard (importing this   ║
// ║  module no longer executes it), structured JSON log lines.          ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const BINDINGS_PATH = new URL('./bindings.json', import.meta.url);
const TEMPLATES_DIR = new URL('./templates/', import.meta.url);
const OUTPUT_DIR = new URL('../../docs/compendium/', import.meta.url);

const logLine = (level, msg, fields = {}) => process.stdout.write(`${JSON.stringify({ t: 'doc-hydrator', level, msg, ...fields })}\n`);

/** Simple dot-notation resolver (e.g. "infra.services.count"). Pure. */
export function resolvePath(obj, pathStr) {
  return pathStr.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Replace {{foo.bar}} placeholders from dataContext. Pure — unknown keys are
 * left untouched and reported through the injected onMissing callback.
 */
export function renderTemplate(content, dataContext, onMissing = () => {}) {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const val = resolvePath(dataContext, key);
    if (val === undefined) { onMissing(key); return match; }
    return String(val);
  });
}

async function loadBindings() {
  const content = await fs.readFile(BINDINGS_PATH, 'utf-8');
  return JSON.parse(content);
}

async function fetchBindingData(namespace, config) {
  if (config.type === 'exec') {
    logLine('info', 'fetching binding data', { namespace, command: config.command });
    const { stdout } = await execAsync(config.command, { cwd: new URL('.', import.meta.url) });
    try {
      return JSON.parse(stdout.trim());
    } catch (err) {
      throw new Error(`Failed to parse JSON output from binding '${namespace}': ${err.message}\nOutput: ${stdout}`);
    }
  }
  throw new Error(`Unknown binding type: ${config.type}`);
}

async function hydrateTemplates(dataContext) {
  const files = await fs.readdir(TEMPLATES_DIR);

  for (const file of files) {
    if (!file.endsWith('.hbs')) continue;

    const templatePath = new URL(file, TEMPLATES_DIR);
    const raw = await fs.readFile(templatePath, 'utf-8');
    const rendered = renderTemplate(raw, dataContext, (key) => {
      logLine('warn', 'missing value for template key', { key, file });
    });

    const warningHeader = `<!-- \n  ⚠️ GENERATED FILE — DO NOT EDIT DIRECTLY \n  This file is compiled from tooling/doc-hydrator/templates/${file}.\n  Run \`pnpm run hydrate\` to update it.\n-->\n\n`;
    const outFilename = file.replace(/\.hbs$/, '.md');
    const outPath = new URL(outFilename, OUTPUT_DIR);

    await fs.writeFile(outPath, warningHeader + rendered, 'utf-8');
    logLine('info', 'wrote hydrated output', { out: `docs/compendium/${outFilename}` });
  }
}

async function main() {
  logLine('info', 'document hydrator starting');
  const bindings = await loadBindings();
  const dataContext = {};

  // Fetch all bound data in parallel
  await Promise.all(Object.entries(bindings).map(async ([ns, config]) => {
    dataContext[ns] = await fetchBindingData(ns, config);
  }));
  logLine('info', 'live data fetched');

  await hydrateTemplates(dataContext);
  logLine('info', 'document hydrator finished');
}

// CLI entry only — importing this module must never hydrate (tests import the pure core).
if (process.argv[1] && process.argv[1].endsWith('hydrate.mjs')) {
  main().catch((err) => {
    logLine('error', 'hydrator failed', { error: String(err?.message ?? err) });
    process.exit(1);
  });
}

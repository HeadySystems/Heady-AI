// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Document Hydrator v1.0.0                                ║
// ║  Compiles Handlebars-style templates using live ecosystem data. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const BINDINGS_PATH = new URL('./bindings.json', import.meta.url);
const TEMPLATES_DIR = new URL('./templates/', import.meta.url);
const OUTPUT_DIR = new URL('../../docs/compendium/', import.meta.url);

async function loadBindings() {
  const content = await fs.readFile(BINDINGS_PATH, 'utf-8');
  return JSON.parse(content);
}

async function fetchBindingData(namespace, config) {
  if (config.type === 'exec') {
    console.log(`[Hydrator] Fetching data for '${namespace}' via: ${config.command}`);
    const { stdout } = await execAsync(config.command, { cwd: new URL('.', import.meta.url) });
    try {
      return JSON.parse(stdout.trim());
    } catch (err) {
      throw new Error(`Failed to parse JSON output from binding '${namespace}': ${err.message}\nOutput: ${stdout}`);
    }
  }
  throw new Error(`Unknown binding type: ${config.type}`);
}

// Simple dot-notation resolver (e.g. "infra.services.count")
function resolvePath(obj, pathStr) {
  return pathStr.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, obj);
}

async function hydrateTemplates(dataContext) {
  const files = await fs.readdir(TEMPLATES_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.hbs')) continue;
    
    const templatePath = new URL(file, TEMPLATES_DIR);
    let content = await fs.readFile(templatePath, 'utf-8');
    
    // Replace {{foo.bar}} with values from dataContext
    content = content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
      const val = resolvePath(dataContext, key);
      if (val === undefined) {
        console.warn(`[Hydrator] Warning: missing value for template key '${key}' in ${file}`);
        return match; // leave untouched if not found
      }
      return String(val);
    });

    // Add a generated warning header
    const warningHeader = `<!-- \n  ⚠️ GENERATED FILE — DO NOT EDIT DIRECTLY \n  This file is compiled from tooling/doc-hydrator/templates/${file}.\n  Run \`pnpm run hydrate\` to update it.\n-->\n\n`;
    content = warningHeader + content;

    const outFilename = file.replace(/\.hbs$/, '.md');
    const outPath = new URL(outFilename, OUTPUT_DIR);
    
    await fs.writeFile(outPath, content, 'utf-8');
    console.log(`[Hydrator] Wrote hydrated output: docs/compendium/${outFilename}`);
  }
}

async function main() {
  console.log("HEADY™ Document Hydrator starting...");
  const bindings = await loadBindings();
  const dataContext = {};

  // Fetch all bound data in parallel
  const fetchPromises = Object.entries(bindings).map(async ([ns, config]) => {
    dataContext[ns] = await fetchBindingData(ns, config);
  });
  
  await Promise.all(fetchPromises);
  console.log("[Hydrator] Live data fetched successfully.");
  
  await hydrateTemplates(dataContext);
  console.log("HEADY™ Document Hydrator finished.");
}

main().catch(err => {
  console.error("Hydrator failed:", err);
  process.exit(1);
});

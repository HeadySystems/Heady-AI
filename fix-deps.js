const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function walkFiles(dir, ext) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkFiles(fullPath, ext));
      else if (entry.name.endsWith(ext)) results.push(fullPath);
    }
  } catch {}
  return results;
}

const allFiles = [...walkFiles(path.join(ROOT, 'src'), '.js'), ...walkFiles(path.join(ROOT, 'shared'), '.js'), ...walkFiles(path.join(ROOT, 'mcp-servers'), '.js')];

const fileCache = new Map();
allFiles.forEach(f => {
  const base = path.basename(f, '.js');
  if (!fileCache.has(base)) fileCache.set(base, []);
  fileCache.get(base).push(f);
});

let missingDeps = [];
for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  const requireMatches = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
  for (const m of requireMatches) {
    const dep = m.match(/['"]([^'"]+)['"]/)[1];
    if (dep.startsWith('.') || dep.startsWith('/')) {
      const dir = path.dirname(file);
      try {
        require.resolve(path.resolve(dir, dep));
      } catch {
        const baseDep = path.basename(dep, '.js');
        const options = fileCache.get(baseDep) || [];
        if (options.length === 1) {
          let newRel = path.relative(dir, options[0]);
          if (!newRel.startsWith('.')) newRel = './' + newRel;
          if (newRel.endsWith('.js')) newRel = newRel.slice(0, -3);
          content = content.replace(m, `require('${newRel}')`);
          changed = true;
          console.log(`Fixed in ${path.relative(ROOT, file)}: ${dep} -> ${newRel}`);
        } else {
          missingDeps.push({ file: path.relative(ROOT, file), dep, options: options.length });
        }
      }
    }
  }
  if (changed) fs.writeFileSync(file, content);
}
console.log("Unresolved:", missingDeps);

const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

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

const allFiles = [
  ...walkFiles(path.join(ROOT, 'src'), '.js'),
  ...walkFiles(path.join(ROOT, 'shared'), '.js'),
  ...walkFiles(path.join(ROOT, 'mcp-servers'), '.js')
];

const fileCache = new Map(); // basename -> [fullPath]
allFiles.forEach(f => {
  const base = path.basename(f, '.js');
  if (!fileCache.has(base)) fileCache.set(base, []);
  fileCache.get(base).push(f);
});

// Special cases for common utilities
const PRIORITIES = ['src/utils/', 'src/shared/', 'shared/', 'src/core/'];

function findBestMatch(base, currentDir) {
  const options = fileCache.get(base) || [];
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];
  
  // Prioritize matches in the same directory
  const sameDirMatch = options.find(o => path.dirname(o) === currentDir);
  if (sameDirMatch) return sameDirMatch;

  // Prioritize common paths
  for (const p of PRIORITIES) {
    const match = options.find(o => o.includes(p));
    if (match) return match;
  }
  
  // Otherwise pick the shortest path (likely closest to root)
  return options.sort((a, b) => a.length - b.length)[0];
}

let missingCount = 0;
let fixedCount = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const requireMatches = cleanContent.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
  
  let changed = false;
  for (const m of requireMatches) {
    const dep = m.match(/['"]([^'"]+)['"]/)[1];
    if (dep.startsWith('.') || dep.startsWith('/')) {
      const dir = path.dirname(file);
      try {
        require.resolve(path.resolve(dir, dep));
      } catch {
        // Try to fix
        const baseDep = path.basename(dep, '.js');
        const bestMatch = findBestMatch(baseDep, dir);
        if (bestMatch) {
          let newRel = path.relative(dir, bestMatch);
          if (!newRel.startsWith('.')) newRel = './' + newRel;
          if (newRel.endsWith('.js')) newRel = newRel.slice(0, -3);
          
          // Use a regex with lookbehind/lookahead to only replace the actual string in the actual code
          // But since we have the match m, we can just replace the first instance of it in the content
          // that matches the original line.
          content = content.replace(m, `require('${newRel}')`);
          changed = true;
          fixedCount++;
        } else {
          missingCount++;
        }
      }
    }
  }
  if (changed) fs.writeFileSync(file, content);
}

console.log(`Fixed: ${fixedCount}`);
console.log(`Still Missing: ${missingCount}`);
